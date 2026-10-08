// backend/routes/recepcionPagos.js
// Recepción de Pagos: cuentas pendientes por pagar (deudas de TecnoHogar) y por cobrar (deudas que
// le deben a la empresa), con sus abonos. Es un registro aparte: no toca la caja ni el cierre de caja.
// Solo admin.
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLog');

const requireAdmin = requireRole(['admin'], 'Solo un admin puede usar Recepción de Pagos');
router.use(authenticateToken, requireAdmin);

const TIPOS = ['por_pagar', 'por_cobrar'];
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const ESTADOS = ['pendiente', 'parcial', 'pagada', 'anulada', 'vencida', 'abiertas'];
const EPS = 0.005;

// ---------- validaciones ----------
function fechaValida(v) {
  if (!FECHA_RE.test(String(v || ''))) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

// Fecha opcional: '' / null / undefined => null; si viene debe ser YYYY-MM-DD real.
function fechaOpcional(v, label) {
  if (v === undefined || v === null || v === '') return { value: null };
  if (!fechaValida(v)) return { error: `${label} no es una fecha válida` };
  return { value: v };
}

// El período que cubre un pago/cuenta es opcional, pero si se indica deben venir ambas fechas y en orden.
function periodo(desdeRaw, hastaRaw) {
  const desde = fechaOpcional(desdeRaw, 'La fecha "desde" del período');
  if (desde.error) return desde;
  const hasta = fechaOpcional(hastaRaw, 'La fecha "hasta" del período');
  if (hasta.error) return hasta;
  if ((desde.value === null) !== (hasta.value === null)) return { error: 'Para indicar el período que cubre, completa las dos fechas (desde y hasta)' };
  if (desde.value && desde.value > hasta.value) return { error: 'El período "desde" no puede ser posterior al "hasta"' };
  return { desde: desde.value, hasta: hasta.value };
}

function texto(v, max, label, { required = false } = {}) {
  const t = typeof v === 'string' ? v.trim() : '';
  if (!t && required) return { error: `${label} es requerido` };
  if (t.length > max) return { error: `${label} no puede superar ${max} caracteres` };
  return { value: t || null };
}

function monto(v, label) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return { error: `${label} debe ser un número mayor a 0` };
  if (n > 9999999999) return { error: `${label} es demasiado grande` };
  return { value: Math.round(n * 100) / 100 };
}

// ---------- consulta base: cuenta + pagado + saldo + estado ----------
const CUENTAS_SQL = `
  SELECT c.id, c.tipo, c.contraparte_id, p.nombre AS contraparte_nombre, c.concepto, c.monto_total,
         to_char(c.fecha_emision, 'YYYY-MM-DD') AS fecha_emision,
         to_char(c.fecha_vencimiento, 'YYYY-MM-DD') AS fecha_vencimiento,
         to_char(c.periodo_desde, 'YYYY-MM-DD') AS periodo_desde,
         to_char(c.periodo_hasta, 'YYYY-MM-DD') AS periodo_hasta,
         c.notas, c.anulada_at, c.created_by, u.name AS creada_por, c.created_at, c.updated_at,
         COALESCE(a.pagado, 0) AS pagado,
         c.monto_total - COALESCE(a.pagado, 0) AS saldo,
         COALESCE(a.cantidad_abonos, 0) AS cantidad_abonos,
         to_char(a.ultimo_pago, 'YYYY-MM-DD') AS ultimo_pago,
         CASE
           WHEN c.anulada_at IS NOT NULL THEN 'anulada'
           WHEN c.monto_total - COALESCE(a.pagado, 0) <= 0.005 THEN 'pagada'
           WHEN COALESCE(a.pagado, 0) > 0 THEN 'parcial'
           ELSE 'pendiente'
         END AS estado,
         (c.anulada_at IS NULL AND c.monto_total - COALESCE(a.pagado, 0) > 0.005
            AND c.fecha_vencimiento IS NOT NULL AND c.fecha_vencimiento < CURRENT_DATE) AS vencida
  FROM pago_cuentas c
  JOIN pago_contrapartes p ON p.id = c.contraparte_id
  LEFT JOIN users u ON u.id = c.created_by
  LEFT JOIN (
    SELECT cuenta_id, SUM(monto) AS pagado, MAX(fecha_pago) AS ultimo_pago, COUNT(*) AS cantidad_abonos
    FROM pago_abonos GROUP BY cuenta_id
  ) a ON a.cuenta_id = c.id
`;

const ABONOS_SQL = `
  SELECT b.id, b.cuenta_id, b.monto, to_char(b.fecha_pago, 'YYYY-MM-DD') AS fecha_pago, b.motivo,
         to_char(b.periodo_desde, 'YYYY-MM-DD') AS periodo_desde, to_char(b.periodo_hasta, 'YYYY-MM-DD') AS periodo_hasta,
         b.notas, b.created_by, u.name AS registrado_por, b.created_at
  FROM pago_abonos b
  LEFT JOIN users u ON u.id = b.created_by
`;

async function obtenerCuenta(db, id) {
  const r = await db.query(`${CUENTAS_SQL} WHERE c.id = $1`, [id]);
  return r.rows[0] || null;
}

// ============================================
// CONTRAPARTES (a quién se le paga / quién nos paga)
// ============================================
router.get('/contrapartes', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT p.id, p.nombre, p.notas, p.created_at,
              COUNT(c.id) AS cuentas
       FROM pago_contrapartes p
       LEFT JOIN pago_cuentas c ON c.contraparte_id = p.id
       GROUP BY p.id
       ORDER BY LOWER(p.nombre)`
    );
    res.json({ contrapartes: r.rows.map((x) => ({ ...x, cuentas: parseInt(x.cuentas) })) });
  } catch (err) {
    console.error('Error al listar contrapartes:', err);
    res.status(500).json({ error: 'Error al obtener las contrapartes' });
  }
});

router.post('/contrapartes', async (req, res) => {
  try {
    const nombre = texto(req.body.nombre, 150, 'El nombre', { required: true });
    if (nombre.error) return res.status(400).json({ error: nombre.error });
    const notas = texto(req.body.notas, 1000, 'Las notas');
    if (notas.error) return res.status(400).json({ error: notas.error });

    const dup = await pool.query('SELECT id, nombre FROM pago_contrapartes WHERE LOWER(nombre) = LOWER($1)', [nombre.value]);
    if (dup.rows.length > 0) {
      return res.status(409).json({ error: `Ya existe "${dup.rows[0].nombre}"`, existente: dup.rows[0] });
    }
    const r = await pool.query('INSERT INTO pago_contrapartes (nombre, notas, created_by) VALUES ($1, $2, $3) RETURNING *', [nombre.value, notas.value, req.user.id]);
    await logAudit({ userId: req.user.id, action: 'crear_contraparte_pago', tableName: 'pago_contrapartes', recordId: r.rows[0].id, newValues: r.rows[0] });
    res.status(201).json({ message: 'Contraparte guardada', contraparte: r.rows[0] });
  } catch (err) {
    console.error('Error al crear contraparte:', err);
    res.status(500).json({ error: 'Error al guardar la contraparte' });
  }
});

router.put('/contrapartes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const before = await pool.query('SELECT * FROM pago_contrapartes WHERE id = $1', [id]);
    if (before.rows.length === 0) return res.status(404).json({ error: 'Contraparte no encontrada' });

    const nombre = texto(req.body.nombre, 150, 'El nombre', { required: true });
    if (nombre.error) return res.status(400).json({ error: nombre.error });
    const notas = texto(req.body.notas, 1000, 'Las notas');
    if (notas.error) return res.status(400).json({ error: notas.error });

    const dup = await pool.query('SELECT id FROM pago_contrapartes WHERE LOWER(nombre) = LOWER($1) AND id <> $2', [nombre.value, id]);
    if (dup.rows.length > 0) return res.status(409).json({ error: `Ya existe otra contraparte llamada "${nombre.value}"` });

    const r = await pool.query('UPDATE pago_contrapartes SET nombre = $1, notas = $2 WHERE id = $3 RETURNING *', [nombre.value, notas.value, id]);
    await logAudit({ userId: req.user.id, action: 'editar_contraparte_pago', tableName: 'pago_contrapartes', recordId: Number(id), oldValues: before.rows[0], newValues: r.rows[0] });
    res.json({ message: 'Contraparte actualizada', contraparte: r.rows[0] });
  } catch (err) {
    console.error('Error al editar contraparte:', err);
    res.status(500).json({ error: 'Error al actualizar la contraparte' });
  }
});

router.delete('/contrapartes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const usos = await pool.query('SELECT COUNT(*) AS n FROM pago_cuentas WHERE contraparte_id = $1', [id]);
    if (parseInt(usos.rows[0].n) > 0) {
      return res.status(409).json({ error: 'No se puede eliminar: tiene cuentas registradas. Puedes renombrarla en su lugar.' });
    }
    const r = await pool.query('DELETE FROM pago_contrapartes WHERE id = $1 RETURNING *', [id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Contraparte no encontrada' });
    await logAudit({ userId: req.user.id, action: 'eliminar_contraparte_pago', tableName: 'pago_contrapartes', recordId: Number(id), oldValues: r.rows[0] });
    res.json({ message: 'Contraparte eliminada' });
  } catch (err) {
    console.error('Error al eliminar contraparte:', err);
    res.status(500).json({ error: 'Error al eliminar la contraparte' });
  }
});

// ============================================
// CUENTAS
// ============================================

// Resumen global (sin filtros): lo que se debe y lo que nos deben, y lo vencido.
async function resumenGlobal() {
  const r = await pool.query(
    `SELECT tipo,
            COUNT(*) FILTER (WHERE saldo > 0.005) AS abiertas,
            COALESCE(SUM(saldo) FILTER (WHERE saldo > 0.005), 0) AS saldo,
            COUNT(*) FILTER (WHERE vencida) AS vencidas,
            COALESCE(SUM(saldo) FILTER (WHERE vencida), 0) AS saldo_vencido
     FROM (${CUENTAS_SQL}) x
     WHERE anulada_at IS NULL
     GROUP BY tipo`
  );
  const base = () => ({ abiertas: 0, saldo: 0, vencidas: 0, saldo_vencido: 0 });
  const out = { por_pagar: base(), por_cobrar: base() };
  for (const row of r.rows) {
    out[row.tipo] = { abiertas: parseInt(row.abiertas), saldo: Number(row.saldo), vencidas: parseInt(row.vencidas), saldo_vencido: Number(row.saldo_vencido) };
  }
  return out;
}

router.get('/cuentas', async (req, res) => {
  try {
    const { tipo, estado, contraparte_id, usuario_id, desde, hasta, q, page, limit } = req.query;
    const conditions = [];
    const params = [];

    if (TIPOS.includes(tipo)) { params.push(tipo); conditions.push(`tipo = $${params.length}`); }
    if (/^\d+$/.test(String(contraparte_id || ''))) { params.push(Number(contraparte_id)); conditions.push(`contraparte_id = $${params.length}`); }
    if (/^\d+$/.test(String(usuario_id || ''))) { params.push(Number(usuario_id)); conditions.push(`created_by = $${params.length}`); }
    if (fechaValida(desde)) { params.push(desde); conditions.push(`fecha_emision::date >= $${params.length}::date`); }
    if (fechaValida(hasta)) { params.push(hasta); conditions.push(`fecha_emision::date <= $${params.length}::date`); }
    if (q && String(q).trim()) {
      params.push(`%${String(q).trim()}%`);
      const i = params.length;
      conditions.push(`(concepto ILIKE $${i} OR contraparte_nombre ILIKE $${i} OR notas ILIKE $${i})`);
    }

    // Por defecto no se muestran las anuladas (se ven pidiendo ese estado).
    if (estado === 'abiertas') conditions.push(`estado IN ('pendiente', 'parcial')`);
    else if (estado === 'vencida') conditions.push('vencida');
    else if (ESTADOS.includes(estado)) { params.push(estado); conditions.push(`estado = $${params.length}`); }
    else conditions.push(`estado <> 'anulada'`);

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const total = parseInt((await pool.query(`SELECT COUNT(*) AS n FROM (${CUENTAS_SQL}) x ${where}`, params)).rows[0].n);

    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const pageNum = Math.max(parseInt(page) || 1, 1);
    const listParams = [...params, limitNum, (pageNum - 1) * limitNum];
    const result = await pool.query(
      `SELECT * FROM (${CUENTAS_SQL}) x ${where}
       ORDER BY (estado IN ('pagada', 'anulada')) ASC, vencida DESC, fecha_vencimiento ASC NULLS LAST, id DESC
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams
    );

    res.json({
      total, page: pageNum, limit: limitNum, totalPages: Math.max(Math.ceil(total / limitNum), 1),
      cuentas: result.rows,
      resumen: await resumenGlobal(),
    });
  } catch (err) {
    console.error('Error al listar cuentas de pago:', err);
    res.status(500).json({ error: 'Error al obtener las cuentas' });
  }
});

router.get('/cuentas/:id', async (req, res) => {
  try {
    const cuenta = await obtenerCuenta(pool, req.params.id);
    if (!cuenta) return res.status(404).json({ error: 'Cuenta no encontrada' });
    const abonos = await pool.query(`${ABONOS_SQL} WHERE b.cuenta_id = $1 ORDER BY b.fecha_pago DESC, b.id DESC`, [req.params.id]);
    res.json({ cuenta, abonos: abonos.rows });
  } catch (err) {
    console.error('Error al obtener la cuenta:', err);
    res.status(500).json({ error: 'Error al obtener la cuenta' });
  }
});

// Lee y valida los campos de una cuenta del body. `parcial` = edición (solo valida lo que llega).
function leerCuenta(body, { parcial = false } = {}) {
  const out = {};
  const has = (k) => body[k] !== undefined;

  if (!parcial || has('tipo')) {
    if (!TIPOS.includes(body.tipo)) return { error: `Tipo inválido. Opciones: ${TIPOS.join(', ')}` };
    out.tipo = body.tipo;
  }
  if (!parcial || has('contraparte_id')) {
    if (!/^\d+$/.test(String(body.contraparte_id || ''))) return { error: 'Selecciona a quién corresponde la cuenta' };
    out.contraparte_id = Number(body.contraparte_id);
  }
  if (!parcial || has('concepto')) {
    const c = texto(body.concepto, 255, 'El motivo o concepto', { required: true });
    if (c.error) return c;
    out.concepto = c.value;
  }
  if (!parcial || has('monto_total')) {
    const m = monto(body.monto_total, 'El monto total');
    if (m.error) return m;
    out.monto_total = m.value;
  }
  if (!parcial || has('fecha_emision')) {
    const f = body.fecha_emision ? fechaOpcional(body.fecha_emision, 'La fecha') : { value: null };
    if (f.error) return f;
    out.fecha_emision = f.value; // null => hoy (en el alta)
  }
  if (!parcial || has('fecha_vencimiento')) {
    const f = fechaOpcional(body.fecha_vencimiento, 'La fecha de vencimiento');
    if (f.error) return f;
    out.fecha_vencimiento = f.value;
  }
  if (!parcial || has('periodo_desde') || has('periodo_hasta')) {
    const p = periodo(body.periodo_desde, body.periodo_hasta);
    if (p.error) return p;
    out.periodo_desde = p.desde;
    out.periodo_hasta = p.hasta;
  }
  if (!parcial || has('notas')) {
    const n = texto(body.notas, 2000, 'Las notas');
    if (n.error) return n;
    out.notas = n.value;
  }
  return { value: out };
}

router.post('/cuentas', async (req, res) => {
  try {
    const leido = leerCuenta(req.body);
    if (leido.error) return res.status(400).json({ error: leido.error });
    const c = leido.value;

    const contraparte = await pool.query('SELECT id FROM pago_contrapartes WHERE id = $1', [c.contraparte_id]);
    if (contraparte.rows.length === 0) return res.status(400).json({ error: 'La contraparte seleccionada no existe' });

    const r = await pool.query(
      `INSERT INTO pago_cuentas (tipo, contraparte_id, concepto, monto_total, fecha_emision, fecha_vencimiento, periodo_desde, periodo_hasta, notas, created_by)
       VALUES ($1, $2, $3, $4, COALESCE($5::date, CURRENT_DATE), $6, $7, $8, $9, $10)
       RETURNING id`,
      [c.tipo, c.contraparte_id, c.concepto, c.monto_total, c.fecha_emision, c.fecha_vencimiento, c.periodo_desde, c.periodo_hasta, c.notas, req.user.id]
    );
    const cuenta = await obtenerCuenta(pool, r.rows[0].id);
    await logAudit({ userId: req.user.id, action: 'crear_cuenta_pago', tableName: 'pago_cuentas', recordId: cuenta.id, newValues: cuenta });
    res.status(201).json({ message: 'Cuenta registrada', cuenta });
  } catch (err) {
    console.error('Error al crear la cuenta:', err);
    res.status(500).json({ error: 'Error al registrar la cuenta' });
  }
});

router.put('/cuentas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const antes = await obtenerCuenta(pool, id);
    if (!antes) return res.status(404).json({ error: 'Cuenta no encontrada' });
    if (antes.anulada_at) return res.status(400).json({ error: 'La cuenta está anulada: reactívala para poder editarla' });

    const leido = leerCuenta(req.body, { parcial: true });
    if (leido.error) return res.status(400).json({ error: leido.error });
    const c = leido.value;

    if (c.tipo && c.tipo !== antes.tipo && antes.cantidad_abonos > 0) {
      return res.status(400).json({ error: 'No se puede cambiar entre "por pagar" y "por cobrar" una cuenta que ya tiene abonos' });
    }
    if (c.monto_total !== undefined && c.monto_total + EPS < Number(antes.pagado)) {
      return res.status(400).json({ error: `El monto total no puede ser menor a lo ya pagado ($${Number(antes.pagado)})` });
    }
    if (c.contraparte_id !== undefined) {
      const ct = await pool.query('SELECT id FROM pago_contrapartes WHERE id = $1', [c.contraparte_id]);
      if (ct.rows.length === 0) return res.status(400).json({ error: 'La contraparte seleccionada no existe' });
    }

    const sets = []; const params = [];
    for (const [k, v] of Object.entries(c)) {
      if (k === 'fecha_emision' && v === null) continue; // la fecha de emisión no puede quedar vacía
      params.push(v);
      sets.push(`${k} = $${params.length}`);
    }
    if (sets.length === 0) return res.json({ message: 'Sin cambios', cuenta: antes });
    params.push(id);
    await pool.query(`UPDATE pago_cuentas SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${params.length}`, params);

    const cuenta = await obtenerCuenta(pool, id);
    await logAudit({ userId: req.user.id, action: 'editar_cuenta_pago', tableName: 'pago_cuentas', recordId: Number(id), oldValues: antes, newValues: cuenta });
    res.json({ message: 'Cuenta actualizada', cuenta });
  } catch (err) {
    console.error('Error al editar la cuenta:', err);
    res.status(500).json({ error: 'Error al actualizar la cuenta' });
  }
});

// Anular (la cuenta deja de contar en los totales, pero queda registrada) y reactivar.
async function cambiarAnulacion(req, res, anular) {
  try {
    const { id } = req.params;
    const antes = await obtenerCuenta(pool, id);
    if (!antes) return res.status(404).json({ error: 'Cuenta no encontrada' });
    if (anular === !!antes.anulada_at) return res.status(400).json({ error: anular ? 'La cuenta ya está anulada' : 'La cuenta no está anulada' });

    await pool.query(`UPDATE pago_cuentas SET anulada_at = ${anular ? 'CURRENT_TIMESTAMP' : 'NULL'}, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [id]);
    const cuenta = await obtenerCuenta(pool, id);
    await logAudit({ userId: req.user.id, action: anular ? 'anular_cuenta_pago' : 'reactivar_cuenta_pago', tableName: 'pago_cuentas', recordId: Number(id), oldValues: antes, newValues: cuenta });
    res.json({ message: anular ? 'Cuenta anulada' : 'Cuenta reactivada', cuenta });
  } catch (err) {
    console.error('Error al cambiar el estado de la cuenta:', err);
    res.status(500).json({ error: 'Error al actualizar la cuenta' });
  }
}
router.post('/cuentas/:id/anular', (req, res) => cambiarAnulacion(req, res, true));
router.post('/cuentas/:id/reactivar', (req, res) => cambiarAnulacion(req, res, false));

// ============================================
// ABONOS (pagos registrados contra una cuenta)
// ============================================
function leerAbono(body) {
  const m = monto(body.monto, 'El monto');
  if (m.error) return m;
  const f = body.fecha_pago ? fechaOpcional(body.fecha_pago, 'La fecha del pago') : { value: null };
  if (f.error) return f;
  const motivo = texto(body.motivo, 255, 'El motivo');
  if (motivo.error) return motivo;
  const p = periodo(body.periodo_desde, body.periodo_hasta);
  if (p.error) return p;
  const notas = texto(body.notas, 2000, 'Las notas');
  if (notas.error) return notas;
  return { value: { monto: m.value, fecha_pago: f.value, motivo: motivo.value, periodo_desde: p.desde, periodo_hasta: p.hasta, notas: notas.value } };
}

router.post('/cuentas/:id/abonos', async (req, res) => {
  const leido = leerAbono(req.body);
  if (leido.error) return res.status(400).json({ error: leido.error });
  const a = leido.value;

  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    // Se bloquea la cuenta para que dos abonos simultáneos no se pasen del total.
    const lock = await db.query('SELECT id, monto_total, anulada_at FROM pago_cuentas WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (lock.rows.length === 0) throw { status: 404, message: 'Cuenta no encontrada' };
    if (lock.rows[0].anulada_at) throw { status: 400, message: 'La cuenta está anulada: no se pueden registrar pagos' };

    const pagado = Number((await db.query('SELECT COALESCE(SUM(monto), 0) AS s FROM pago_abonos WHERE cuenta_id = $1', [req.params.id])).rows[0].s);
    const saldo = Number(lock.rows[0].monto_total) - pagado;
    if (saldo <= EPS) throw { status: 400, message: 'Esta cuenta ya está pagada por completo' };
    if (a.monto > saldo + EPS) throw { status: 400, message: `El pago ($${a.monto}) supera el saldo pendiente ($${saldo})` };

    const r = await db.query(
      `INSERT INTO pago_abonos (cuenta_id, monto, fecha_pago, motivo, periodo_desde, periodo_hasta, notas, created_by)
       VALUES ($1, $2, COALESCE($3::date, CURRENT_DATE), $4, $5, $6, $7, $8) RETURNING id`,
      [req.params.id, a.monto, a.fecha_pago, a.motivo, a.periodo_desde, a.periodo_hasta, a.notas, req.user.id]
    );
    await db.query('COMMIT');

    const abono = (await pool.query(`${ABONOS_SQL} WHERE b.id = $1`, [r.rows[0].id])).rows[0];
    await logAudit({ userId: req.user.id, action: 'registrar_pago_cuenta', tableName: 'pago_abonos', recordId: abono.id, newValues: abono });
    res.status(201).json({ message: 'Pago registrado', abono, cuenta: await obtenerCuenta(pool, req.params.id) });

  } catch (err) {
    await db.query('ROLLBACK');
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('Error al registrar el pago:', err);
    res.status(500).json({ error: 'Error al registrar el pago' });
  } finally {
    db.release();
  }
});

router.put('/abonos/:id', async (req, res) => {
  const leido = leerAbono(req.body);
  if (leido.error) return res.status(400).json({ error: leido.error });
  const a = leido.value;

  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const antes = (await db.query(`${ABONOS_SQL} WHERE b.id = $1`, [req.params.id])).rows[0];
    if (!antes) throw { status: 404, message: 'Pago no encontrado' };
    const cuenta = (await db.query('SELECT monto_total, anulada_at FROM pago_cuentas WHERE id = $1 FOR UPDATE', [antes.cuenta_id])).rows[0];
    if (cuenta.anulada_at) throw { status: 400, message: 'La cuenta está anulada: reactívala para corregir sus pagos' };

    const otros = Number((await db.query('SELECT COALESCE(SUM(monto), 0) AS s FROM pago_abonos WHERE cuenta_id = $1 AND id <> $2', [antes.cuenta_id, req.params.id])).rows[0].s);
    if (otros + a.monto > Number(cuenta.monto_total) + EPS) {
      throw { status: 400, message: `Con este monto los pagos sumarían $${otros + a.monto}, más que el total de la cuenta ($${Number(cuenta.monto_total)})` };
    }

    await db.query(
      `UPDATE pago_abonos SET monto = $1, fecha_pago = COALESCE($2::date, fecha_pago), motivo = $3, periodo_desde = $4, periodo_hasta = $5, notas = $6 WHERE id = $7`,
      [a.monto, a.fecha_pago, a.motivo, a.periodo_desde, a.periodo_hasta, a.notas, req.params.id]
    );
    await db.query('COMMIT');

    const abono = (await pool.query(`${ABONOS_SQL} WHERE b.id = $1`, [req.params.id])).rows[0];
    await logAudit({ userId: req.user.id, action: 'editar_pago_cuenta', tableName: 'pago_abonos', recordId: abono.id, oldValues: antes, newValues: abono });
    res.json({ message: 'Pago corregido', abono, cuenta: await obtenerCuenta(pool, antes.cuenta_id) });

  } catch (err) {
    await db.query('ROLLBACK');
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('Error al editar el pago:', err);
    res.status(500).json({ error: 'Error al corregir el pago' });
  } finally {
    db.release();
  }
});

router.delete('/abonos/:id', async (req, res) => {
  try {
    const antes = (await pool.query(`${ABONOS_SQL} WHERE b.id = $1`, [req.params.id])).rows[0];
    if (!antes) return res.status(404).json({ error: 'Pago no encontrado' });
    const cuenta = await obtenerCuenta(pool, antes.cuenta_id);
    if (cuenta.anulada_at) return res.status(400).json({ error: 'La cuenta está anulada: reactívala para corregir sus pagos' });

    await pool.query('DELETE FROM pago_abonos WHERE id = $1', [req.params.id]);
    await logAudit({ userId: req.user.id, action: 'eliminar_pago_cuenta', tableName: 'pago_abonos', recordId: antes.id, oldValues: antes });
    res.json({ message: 'Pago eliminado', cuenta: await obtenerCuenta(pool, antes.cuenta_id) });
  } catch (err) {
    console.error('Error al eliminar el pago:', err);
    res.status(500).json({ error: 'Error al eliminar el pago' });
  }
});

module.exports = router;
