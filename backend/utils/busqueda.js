// backend/utils/busqueda.js
// Búsquedas que no distinguen mayúsculas ni tildes: "camara" encuentra "Cámara" y al revés.
// No usa la extensión unaccent de PostgreSQL (no hace falta migración): las tildes se quitan con
// translate() en la consulta y con normalize() en el texto buscado.
const CON_TILDE = 'áàäâãÁÀÄÂÃéèëêÉÈËÊíìïîÍÌÏÎóòöôõÓÒÖÔÕúùüûÚÙÜÛñÑçÇ';
const SIN_TILDE = 'aaaaaAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUnNcC';

// Texto buscado, listo para comparar (minúsculas y sin tildes).
function normalizarBusqueda(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Expresión SQL de una columna (o expresión) sin tildes y en minúsculas.
function sqlSinTildes(expr) {
  return `lower(translate(${expr}, '${CON_TILDE}', '${SIN_TILDE}'))`;
}

// Agrega el parámetro "%texto%" y devuelve la condición `(col1 LIKE $n OR col2 LIKE $n ...)`.
function condicionBusqueda(columnas, texto, params) {
  params.push(`%${normalizarBusqueda(texto)}%`);
  const i = params.length;
  return `(${columnas.map((c) => `${sqlSinTildes(c)} LIKE $${i}`).join(' OR ')})`;
}

module.exports = { normalizarBusqueda, sqlSinTildes, condicionBusqueda };
