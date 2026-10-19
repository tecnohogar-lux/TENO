// SOLO LECTURA. Genera un Excel con los nombres de producto de las ventas que no coinciden con ningún
// producto del catálogo (ni con un nombre anterior registrado en las Noticias), con una sugerencia del
// producto más parecido. Se completa a mano la columna "ID correcto" y luego se aplica con
// database/aplicar_mapeo_productos.js.
// Uso: node database/generar_ventas_sin_producto.js "<connectionString>" [salida.xlsx]
const path = require('path');
const backend = path.join(__dirname, '..', 'backend', 'node_modules');
const { Client } = require(path.join(backend, 'pg'));
const XLSX = require(path.join(__dirname, '..', 'frontend', 'node_modules', 'xlsx'));

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ ]+/g, ' ').trim();
const tokens = (s) => new Set(norm(s).split(/\s+/).filter((t) => t.length > 1));
function similitud(a, b) {
  const A = tokens(a); const B = tokens(b);
  if (A.size === 0 || B.size === 0) return 0;
  let comun = 0; for (const t of A) if (B.has(t)) comun++;
  return comun / Math.sqrt(A.size * B.size);
}

(async () => {
  const cs = process.argv[2];
  const out = process.argv[3] || path.join(__dirname, 'backups', 'ventas_sin_producto.xlsx');
  if (!cs) { console.error('Falta la connection string'); process.exit(1); }
  const c = new Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query('BEGIN TRANSACTION READ ONLY');

  const sinMatch = await c.query(`
    WITH lineas AS (
      SELECT s.id AS venta_id, s.created_at, TRIM(l->>'product_name') AS nombre
      FROM sales s, json_array_elements(s.items) l WHERE s.deleted_at IS NULL AND s.items IS NOT NULL
      UNION ALL
      SELECT s.id, s.created_at, TRIM(s.product_name) FROM sales s WHERE s.deleted_at IS NULL AND s.items IS NULL
    )
    SELECT MIN(nombre) AS nombre, COUNT(DISTINCT venta_id) AS ventas, MIN(created_at) AS primera, MAX(created_at) AS ultima
    FROM lineas l
    WHERE NOT EXISTS (SELECT 1 FROM products p WHERE LOWER(TRIM(p.title)) = LOWER(l.nombre))
      AND NOT EXISTS (
        SELECT 1 FROM noticias n CROSS JOIN LATERAL jsonb_array_elements(COALESCE(n.datos->'cambios','[]'::jsonb)) ch
        JOIN products p ON p.id = n.producto_id
        WHERE n.tipo = 'producto_editado' AND ch->>'campo' = 'titulo' AND LOWER(TRIM(ch->>'de')) = LOWER(l.nombre))
    GROUP BY LOWER(nombre) ORDER BY ventas DESC, nombre`);
  const productos = (await c.query('SELECT id, title FROM products')).rows;
  await c.query('ROLLBACK'); await c.end();

  const fecha = (d) => new Date(d).toISOString().slice(0, 10);
  const filas = sinMatch.rows.map((r) => {
    let mejor = null; let puntaje = 0;
    for (const p of productos) { const s = similitud(r.nombre, p.title); if (s > puntaje) { puntaje = s; mejor = p; } }
    return {
      'Nombre en la venta': r.nombre,
      'N° de ventas': Number(r.ventas),
      'Primera venta': fecha(r.primera),
      'Última venta': fecha(r.ultima),
      'Producto sugerido': mejor && puntaje >= 0.5 ? mejor.title : '',
      'ID sugerido': mejor && puntaje >= 0.5 ? mejor.id : '',
      'Parecido': mejor && puntaje >= 0.5 ? Math.round(puntaje * 100) + '%' : '',
      'ID correcto (completar)': '',
    };
  });
  const ws = XLSX.utils.json_to_sheet(filas);
  ws['!cols'] = [{ wch: 50 }, { wch: 12 }, { wch: 13 }, { wch: 13 }, { wch: 50 }, { wch: 11 }, { wch: 10 }, { wch: 22 }];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Sin producto');
  require('fs').mkdirSync(path.dirname(out), { recursive: true });
  XLSX.writeFile(wb, out);
  console.log(`${filas.length} nombres sin producto -> ${out}`);
  console.log(`Con sugerencia: ${filas.filter((f) => f['ID sugerido'] !== '').length}`);
})().catch((e) => { console.error('Error:', e.message); process.exit(1); });
