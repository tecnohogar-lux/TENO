// backend/utils/diaChile.js
// "Hoy" medido en hora de Chile. El servidor corre en UTC: sin esto el día se reiniciaría a las
// 21:00 hora chilena. Las columnas created_at/delivered_at son TIMESTAMP sin zona, guardadas en la
// hora de la sesión de la base; se pasan a hora de Chile para compararlas.
const TZ_CHILE = 'America/Santiago';

// Fecha de hoy en Chile (SQL).
const HOY = `(NOW() AT TIME ZONE '${TZ_CHILE}')::date`;

// Día calendario (en Chile) de una columna TIMESTAMP (SQL).
const diaChile = (col) => `((${col} AT TIME ZONE current_setting('TimeZone')) AT TIME ZONE '${TZ_CHILE}')::date`;

module.exports = { TZ_CHILE, HOY, diaChile };
