// Enlaza ventas antiguas con su producto, según el Excel que genera database/generar_ventas_sin_producto.js
// y que se completó a mano en la columna "ID correcto (completar)".
// Por cada fila con un ID: las ventas (y líneas de ventas con varios productos) con ese nombre y sin producto
// pasan a apuntar a ese producto, y el nombre queda guardado como nombre anterior del producto.
// Por defecto solo SIMULA (no cambia nada); con --aplicar ejecuta los cambios en una transacción.
// Uso: node database/aplicar_mapeo_productos.js "<connectionString>" archivo.xlsx [--aplicar]
const path = require('path');
const { Client } = require(path.join(__dirname, '..', 'backend', 'node_modules', 'pg'));
const XLSX = require(path.join(__dirname, '..', 'frontend', 'node_modules', 'xlsx'));

(async () => {
  const [cs, archivo] = process.argv.slice(2);
  const aplicar = process.argv.includes('--aplicar');
  if (!cs || !archivo) { console.error('Uso: node database/aplicar_mapeo_productos.js "<connectionString>" archivo.xlsx [--aplicar]'); process.exit(1); }

  const wb = XLSX.readFile(archivo);
  const filas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  const mapeo = [];
  for (const f of filas) {
    const nombre = String(f['Nombre en la venta'] || '').trim();
    const idTxt = String(f['ID correcto (completar)'] ?? '').trim();
    if (!nombre || !idTxt) continue;
    if (!/^\d+$/.test(idTxt)) { console.error(`ID inválido para "${nombre}": ${idTxt}`); process.exit(1); }
    mapeo.push({ nombre, id: Number(idTxt) });
  }
  console.log(`${mapeo.length} nombres con ID en el Excel (${filas.length - mapeo.length} sin completar se ignoran).`);

  const c = new Client({ connectionString: cs, ssl: cs.includes('render.com') ? { rejectUnauthorized: false } : undefined });
  await c.connect();
  await c.query('BEGIN');
  try {
    const existentes = new Set((await c.query('SELECT id FROM products')).rows.map((r) => r.id));
    const inexistentes = mapeo.filter((m) => !existentes.has(m.id));
    if (inexistentes.length) {
      console.error('Estos IDs no existen en Productos:', inexistentes.map((m) => `${m.id} (${m.nombre})`).join(', '));
      throw new Error('IDs inexistentes');
    }
    let simples = 0; let lineas = 0; let nombresGuardados = 0;
    for (const m of mapeo) {
      const r1 = await c.query(
        'UPDATE sales SET product_id = $1 WHERE items IS NULL AND product_id IS NULL AND LOWER(TRIM(product_name)) = LOWER(TRIM($2))',
        [m.id, m.nombre]);
      simples += r1.rowCount;
      const r2 = await c.query(
        `UPDATE sales s SET items = (
           SELECT json_agg(CASE WHEN (t.l->>'product_id') IS NULL AND LOWER(TRIM(t.l->>'product_name')) = LOWER(TRIM($2))
                                THEN (t.l::jsonb || jsonb_build_object('product_id', $1::int))::json ELSE t.l END ORDER BY t.ord)
           FROM json_array_elements(s.items) WITH ORDINALITY AS t(l, ord))
         WHERE s.items IS NOT NULL AND json_typeof(s.items) = 'array'
           AND EXISTS (SELECT 1 FROM json_array_elements(s.items) x
                       WHERE (x->>'product_id') IS NULL AND LOWER(TRIM(x->>'product_name')) = LOWER(TRIM($2)))`,
        [m.id, m.nombre]);
      lineas += r2.rowCount;
      const r3 = await c.query(
        'INSERT INTO producto_nombres_anteriores (product_id, nombre) VALUES ($1, $2) ON CONFLICT DO NOTHING', [m.id, m.nombre]);
      nombresGuardados += r3.rowCount;
    }
    console.log(`Ventas de un producto enlazadas: ${simples}`);
    console.log(`Ventas con varios productos actualizadas: ${lineas}`);
    console.log(`Nombres guardados en el historial: ${nombresGuardados}`);
    if (aplicar) { await c.query('COMMIT'); console.log('APLICADO.'); }
    else { await c.query('ROLLBACK'); console.log('SIMULACIÓN: no se cambió nada. Agrega --aplicar para ejecutar.'); }
  } catch (e) {
    await c.query('ROLLBACK'); console.error('Error, se revirtió todo:', e.message); process.exitCode = 1;
  }
  await c.end();
})();
