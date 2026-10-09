// backend/routes/fotosEntregas.js
// Fotos de entregas: cuántas fotos de paquetes entregados mandaron los repartidores al grupo de
// Telegram, por día. Las fotos se leen del bot al pulsar "Actualizar" o con la tarea automática
// diaria (POST /cron, protegida con FOTOS_CRON_SECRET). Solo admin.
const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLog');
const { actualizar, configurado, diaChile, sumarDias } = require('../utils/fotosEntregas');

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

function fechaValida(v) {
  if (!FECHA_RE.test(String(v || ''))) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

function responderError(res, err, accion) {
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(`Error al ${accion} fotos de entregas:`, err);
  res.status(500).json({ error: `Error al ${accion} las fotos de entregas` });
}

// ============================================
// POST - Tarea automática diaria (GitHub Actions). Va antes del login: usa una clave propia.
// ============================================
router.post('/cron', async (req, res) => {
  const secreto = process.env.FOTOS_CRON_SECRET || '';
  const recibido = String(req.headers['x-cron-secret'] || '');
  const ok = secreto.length >= 16 && recibido.length === secreto.length
    && crypto.timingSafeEqual(Buffer.from(recibido), Buffer.from(secreto));
  if (!ok) return res.status(401).json({ error: 'Clave de tarea automática inválida' });
  try {
    res.json(await actualizar({ origen: 'automatica' }));
  } catch (err) {
    responderError(res, err, 'actualizar');
  }
});

router.use(authenticateToken, requireRole(['admin'], 'Solo un admin puede ver las fotos de entregas'));

// ============================================
// GET - Totales por día y por persona en un rango (por defecto, los últimos 30 días)
// ============================================
router.get('/', async (req, res) => {
  try {
    const hoy = diaChile(Date.now() / 1000);
    const hasta = fechaValida(req.query.hasta) ? req.query.hasta : hoy;
    const desde = fechaValida(req.query.desde) ? req.query.desde : sumarDias(hasta, -29);
    if (desde > hasta) return res.status(400).json({ error: 'La fecha "desde" no puede ser posterior a "hasta"' });

    const [dias, personas, resumen, estado] = await Promise.all([
      pool.query(
        `SELECT to_char(fecha, 'YYYY-MM-DD') AS fecha, COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE fecha_envio > fecha)::int AS tarde
         FROM fotos_entregas WHERE fecha BETWEEN $1 AND $2
         GROUP BY fecha ORDER BY fecha DESC`,
        [desde, hasta]
      ),
      pool.query(
        `SELECT to_char(fecha, 'YYYY-MM-DD') AS fecha, enviado_por, COUNT(*)::int AS total
         FROM fotos_entregas WHERE fecha BETWEEN $1 AND $2
         GROUP BY fecha, enviado_por ORDER BY total DESC, enviado_por`,
        [desde, hasta]
      ),
      pool.query(
        `SELECT COUNT(*) FILTER (WHERE fecha = $1::date)::int AS hoy,
                COUNT(*) FILTER (WHERE fecha >= $1::date - 6)::int AS semana,
                COUNT(*) FILTER (WHERE fecha >= date_trunc('month', $1::date))::int AS mes
         FROM fotos_entregas WHERE fecha >= LEAST($1::date - 6, date_trunc('month', $1::date)::date) AND fecha <= $1::date`,
        [hoy]
      ),
      pool.query(
        `SELECT ultima_actualizacion, ultima_actualizacion_origen AS origen, ultimo_resultado AS resultado
         FROM fotos_entregas_estado WHERE id = 1`
      ),
    ]);

    const porDia = new Map(dias.rows.map((d) => [d.fecha, { ...d, personas: [] }]));
    for (const p of personas.rows) porDia.get(p.fecha)?.personas.push({ nombre: p.enviado_por, total: p.total });

    res.json({
      hoy, desde, hasta,
      configurado: configurado(),
      revisaBorradas: Boolean(process.env.TELEGRAM_CHECK_CHAT_ID),
      resumen: resumen.rows[0],
      estado: estado.rows[0] || null,
      dias: [...porDia.values()],
    });
  } catch (err) {
    responderError(res, err, 'obtener');
  }
});

// ============================================
// GET - Envíos de un día (un álbum = un envío), para revisar o mover fotos de día
// ============================================
router.get('/dia/:fecha', async (req, res) => {
  if (!fechaValida(req.params.fecha)) return res.status(400).json({ error: 'Fecha inválida' });
  try {
    const result = await pool.query(
      `SELECT array_agg(id ORDER BY message_id) AS ids, COUNT(*)::int AS total,
              MIN(enviado_por) AS enviado_por, MIN(enviado_at) AS enviado_at,
              to_char(MIN(fecha_envio), 'YYYY-MM-DD') AS fecha_envio,
              CASE WHEN bool_or(fecha_origen = 'manual') THEN 'manual'
                   WHEN bool_or(fecha_origen = 'descripcion') THEN 'descripcion' ELSE 'envio' END AS origen,
              MAX(descripcion) AS descripcion
       FROM fotos_entregas WHERE fecha = $1
       GROUP BY chat_id, COALESCE(media_group_id, 'm' || message_id)
       ORDER BY MIN(enviado_at)`,
      [req.params.fecha]
    );
    res.json({ fecha: req.params.fecha, envios: result.rows });
  } catch (err) {
    responderError(res, err, 'obtener');
  }
});

// ============================================
// POST - Actualizar ahora: leer fotos nuevas y revisar borradas (de hoy y ayer, y del día indicado)
// ============================================
router.post('/actualizar', async (req, res) => {
  const fecha = req.body?.fecha || null;
  if (fecha && !fechaValida(fecha)) return res.status(400).json({ error: 'Fecha inválida' });
  try {
    res.json(await actualizar({ origen: 'manual', userId: req.user.id, fecha }));
  } catch (err) {
    responderError(res, err, 'actualizar');
  }
});

// ============================================
// POST - Mover fotos a otro día (cuando el repartidor se equivocó o no indicó el día)
// ============================================
router.post('/mover', async (req, res) => {
  const { ids, fecha } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500 || !ids.every((id) => Number.isInteger(id) && id > 0)) {
    return res.status(400).json({ error: 'Indica qué fotos mover' });
  }
  if (!fechaValida(fecha)) return res.status(400).json({ error: 'Fecha inválida' });
  if (fecha > diaChile(Date.now() / 1000)) return res.status(400).json({ error: 'No se pueden mover fotos a un día futuro' });

  try {
    const antes = await pool.query(
      `SELECT id, to_char(fecha, 'YYYY-MM-DD') AS fecha, fecha_origen FROM fotos_entregas WHERE id = ANY($1::int[])`, [ids]
    );
    if (antes.rows.length === 0) return res.status(404).json({ error: 'No se encontraron las fotos' });
    await pool.query(
      `UPDATE fotos_entregas SET fecha = $2, fecha_origen = 'manual', movida_por = $3 WHERE id = ANY($1::int[])`,
      [ids, fecha, req.user.id]
    );
    for (const f of antes.rows) {
      await logAudit({
        userId: req.user.id, action: 'UPDATE', tableName: 'fotos_entregas', recordId: f.id,
        oldValues: { fecha: f.fecha, fecha_origen: f.fecha_origen }, newValues: { fecha, fecha_origen: 'manual' },
      });
    }
    res.json({ movidas: antes.rows.length });
  } catch (err) {
    responderError(res, err, 'mover');
  }
});

module.exports = router;
