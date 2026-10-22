// backend/utils/reprogramacion.js
// Reprogramar un envío de Delivery Santiago: se elige una fecha y ese día el envío vuelve solo al estado
// "impreso" (listo para ponerse en camino otra vez). Mientras siga pendiente conserva la marca
// "Delivery Reprogramado" (sales.reprogramado_para) para que no se lo salten.
// No hay tareas programadas en el servidor (Render gratis se duerme): los envíos cuya fecha llegó se activan
// al consultar el sistema (listados, dashboard) y apenas se reprograma para hoy.
const pool = require('../config/database');
const { logAudit } = require('./auditLog');
const { TZ_CHILE } = require('./diaChile');

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

// Hoy en Chile, "YYYY-MM-DD".
function hoyChile() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ_CHILE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function fechaValida(s) {
  if (!FECHA_RE.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// Fecha elegida al reprogramar. Devuelve { fecha } ("YYYY-MM-DD" o null) o { error }.
// Solo aplica al estado "reprogramado"; para otros estados no se toca la fecha. `exigir`: envíos de Santiago.
function resolveFecha(status, rawFecha, exigir) {
  if (status !== 'reprogramado') return { fecha: null };
  const fecha = typeof rawFecha === 'string' ? rawFecha.trim() : '';
  if (!fecha) return exigir ? { error: 'Indica para qué fecha se reprograma el envío' } : { fecha: null };
  if (!fechaValida(fecha)) return { error: 'La fecha de reprogramación no es válida' };
  if (fecha < hoyChile()) return { error: 'La fecha de reprogramación no puede ser anterior a hoy' };
  return { fecha };
}

let ultimaActivacion = 0;

// Pasa a "impreso" los envíos reprogramados cuya fecha ya llegó. Con `forzar` ignora el límite de frecuencia.
async function activarReprogramados({ forzar = false } = {}) {
  const ahora = Date.now();
  if (!forzar && ahora - ultimaActivacion < 15000) return 0;
  ultimaActivacion = ahora;
  const r = await pool.query(
    `UPDATE sales
     SET delivery_status = 'impreso', motivo_estado = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE delivery_status = 'reprogramado' AND reprogramado_para IS NOT NULL
       AND reprogramado_para <= (NOW() AT TIME ZONE '${TZ_CHILE}')::date AND deleted_at IS NULL
     RETURNING id, to_char(reprogramado_para, 'YYYY-MM-DD') AS fecha`
  );
  for (const v of r.rows) {
    await logAudit({
      userId: null, action: 'reprogramado_activado', tableName: 'sales', recordId: v.id,
      oldValues: { delivery_status: 'reprogramado' }, newValues: { delivery_status: 'impreso', reprogramado_para: v.fecha },
    });
  }
  return r.rows.length;
}

module.exports = { hoyChile, resolveFecha, activarReprogramados };
