// backend/utils/sessionExpiry.js
// Las sesiones no duran "24 horas desde el login": vencen todos los días a una hora fija
// (por defecto las 3:00 AM, hora de Chile), cuando casi nadie está trabajando.
// Si alguien inicia sesión muy cerca de esa hora, la sesión vence en el 3:00 AM siguiente
// para no echarlo a los pocos minutos (mínimo MIN_SESSION_MS de duración).

const TZ = process.env.SESSION_TIMEZONE || 'America/Santiago';
const MIN_SESSION_MS = 60 * 60 * 1000;

function sessionResetHour() {
  const h = Number(process.env.SESSION_RESET_HOUR);
  return Number.isInteger(h) && h >= 0 && h <= 23 ? h : 3;
}

// Fecha y hora "de pared" de un instante en la zona dada.
function zonedParts(date, tz) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') };
}

// Diferencia (ms) entre la hora de pared de la zona y UTC en ese instante (incluye horario de verano).
function offsetMs(date, tz) {
  const p = zonedParts(date, tz);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(date.getTime() / 1000) * 1000;
}

// Instante UTC en que la hora de pared de la zona es año-mes-día hora:00 (el día puede desbordar el mes).
function zonedTimeToUtc(year, month, day, hour, tz) {
  const guess = Date.UTC(year, month - 1, day, hour);
  const first = guess - offsetMs(new Date(guess), tz);
  return new Date(guess - offsetMs(new Date(first), tz));
}

// Próximo vencimiento de sesión para un login hecho en `now`.
function nextSessionExpiry(now = new Date(), { hour = sessionResetHour(), tz = TZ, minMs = MIN_SESSION_MS } = {}) {
  const p = zonedParts(now, tz);
  for (let k = 0; k < 3; k++) {
    const candidate = zonedTimeToUtc(p.year, p.month, p.day + k, hour, tz);
    if (candidate.getTime() - now.getTime() >= minMs) return candidate;
  }
  return new Date(now.getTime() + 24 * 60 * 60 * 1000); // no debería pasar
}

module.exports = { nextSessionExpiry, sessionResetHour };
