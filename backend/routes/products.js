// backend/routes/products.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { crearNoticia } = require('./noticias');
const fs = require('fs');
const path = require('path');

const requireManage = (message) => requireRole(['admin', 'operador'], message);

// Configurar multer para archivos Excel
const upload = multer({ 
  dest: 'uploads/temp',
  fileFilter: (req, file, cb) => {
    // Solo aceptar archivos Excel
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se aceptan archivos Excel (.xlsx, .xls)'));
    }
  }
});

// Calcula los 3 campos derivados de cada producto a partir de costo y precio.
// Nunca se leen de un Excel: siempre se recalculan aquí, en el servidor.
// rentabilidad = precio - costo; margen_75 = 75% de eso; comision_venta = 25% de eso.
function computeDerived(costo, precio) {
  if (costo === null || costo === undefined || precio === null || precio === undefined) {
    return { rentabilidad: null, margen_75: null, comision_venta: null };
  }
  const rentabilidad = Math.round((precio - costo) * 100) / 100;
  return {
    rentabilidad,
    margen_75: Math.round(rentabilidad * 0.75 * 100) / 100,
    comision_venta: Math.round(rentabilidad * 0.25 * 100) / 100,
  };
}

// ============================================
// GET - Obtener todos los productos
// ============================================
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page, limit, search } = req.query;
    const conditions = [];
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      conditions.push(`(p.title ILIKE $${idx} OR p.sku ILIKE $${idx})`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM products p ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    let query = `
      SELECT p.*, u.name as created_by_name
      FROM products p
      JOIN users u ON p.created_by = u.id
      ${whereClause}
      ORDER BY p.created_at DESC
    `;

    let pageNum = null;
    let limitNum = null;
    if (page || limit) {
      limitNum = Math.min(parseInt(limit) || 50, 200);
      pageNum = Math.max(parseInt(page) || 1, 1);
      params.push(limitNum, (pageNum - 1) * limitNum);
      query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    }

    const result = await pool.query(query, params);

    res.json({
      total,
      page: pageNum || 1,
      limit: limitNum || total,
      totalPages: limitNum ? Math.max(Math.ceil(total / limitNum), 1) : 1,
      products: result.rows
    });

  } catch (err) {
    console.error('Error al obtener productos:', err);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

// ============================================
// GET - Obtener producto por ID
// ============================================
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT p.*, u.name as created_by_name 
       FROM products p
       JOIN users u ON p.created_by = u.id
       WHERE p.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error('Error al obtener producto:', err);
    res.status(500).json({ error: 'Error al obtener producto' });
  }
});

// ============================================
// POST - Crear producto individual
// ============================================
router.post('/', authenticateToken, requireManage('No tienes permiso para crear productos'), async (req, res) => {
  try {
    const user = req.user;
    const { title, sku, price, cover_image_url, caracteristicas, costo } = req.body;

    if (!title || !price) {
      return res.status(400).json({ error: 'Título y precio requeridos' });
    }

    const costoNum = costo !== undefined && costo !== null && String(costo).trim() !== '' ? parseFloat(costo) : null;
    if (costo !== undefined && costo !== null && String(costo).trim() !== '' && isNaN(costoNum)) {
      return res.status(400).json({ error: 'El costo debe ser un número' });
    }
    const derived = computeDerived(costoNum, parseFloat(price));

    const result = await pool.query(
      `INSERT INTO products (title, sku, price, cover_image_url, caracteristicas, costo, rentabilidad, margen_75, comision_venta, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [title, sku || null, price, cover_image_url || null, caracteristicas || null, costoNum, derived.rentabilidad, derived.margen_75, derived.comision_venta, user.id]
    );

    const product = result.rows[0];
    await crearNoticia({ texto: `Se creó el producto "${product.title}"`, tipo: 'producto_creado', producto_id: product.id, userId: user.id });

    res.status(201).json({
      message: 'Producto creado exitosamente',
      product
    });

  } catch (err) {
    console.error('Error al crear producto:', err);
    res.status(500).json({ error: 'Error al crear producto' });
  }
});

// Encabezado esperado del Excel de importación / exportación (mismo orden
// mostrado al usuario en el pop-up del frontend antes de subir el archivo).
// Rentabilidad / Menos 75% / Menos 25% (Comisión de venta) son columnas
// informativas: el sistema SIEMPRE las recalcula, nunca las lee del archivo.
const IMPORT_HEADER = ['Producto', 'SKU', 'Costo', 'Precio', 'Rentabilidad', 'Menos 75%', 'Menos 25% (Comision de venta)', 'URL Imagen', 'Descripcion'];

function normalizarEncabezado(value) {
  return String(value ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita tildes
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Interpreta una celda de monto: '' / null / undefined = "sin dato" (blank:true,
// usado por la edición masiva para significar "no cambiar"); acepta "$1.234"/"1,234".
function parseMoneyCell(raw) {
  if (raw === undefined || raw === null) return { blank: true, value: null };
  const str = String(raw).trim();
  if (str === '') return { blank: true, value: null };
  let cleaned = str.replace(/[^0-9.,-]/g, '');
  if (cleaned.includes(',') && cleaned.includes('.')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    cleaned = cleaned.replace(',', '.');
  }
  const num = parseFloat(cleaned);
  return { blank: false, value: isNaN(num) ? NaN : num };
}

function leerExcelSubido(filePath) {
  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return xlsx.utils.sheet_to_json(sheet, { header: 1 });
}

function headerValido(data) {
  const headerRow = data[0] || [];
  return IMPORT_HEADER.every((col, idx) => normalizarEncabezado(headerRow[idx]) === normalizarEncabezado(col));
}

const MAX_ERRORS_SHOWN = 30;

function formatearErrores(errors) {
  const listado = errors.slice(0, MAX_ERRORS_SHOWN).join('\n');
  const resto = errors.length > MAX_ERRORS_SHOWN ? `\n... y ${errors.length - MAX_ERRORS_SHOWN} fila(s) más con errores` : '';
  return `${listado}${resto}`;
}

// ============================================
// POST - Importar productos NUEVOS desde Excel
// (crea productos; una fila cuyo nombre ya existe se omite y se reporta)
// ============================================
router.post('/import/excel', authenticateToken, requireManage('No tienes permiso para importar productos'), upload.single('file'), async (req, res) => {
  const filePath = req.file?.path;
  try {
    const user = req.user;

    if (!req.file) {
      return res.status(400).json({ error: 'Archivo no proporcionado' });
    }

    const data = leerExcelSubido(filePath);

    if (data.length < 1) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'El archivo Excel está vacío' });
    }

    if (!headerValido(data)) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        error: `El archivo no tiene el formato esperado. La primera fila debe ser exactamente: ${IMPORT_HEADER.join(' | ')} (en ese orden, sin columnas de más o de menos).`,
      });
    }

    if (data.length < 2) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'El archivo no tiene filas de productos, solo el encabezado.' });
    }

    const existingTitles = new Set(
      (await pool.query('SELECT LOWER(title) as t FROM products')).rows.map((r) => r.t)
    );

    // Se valida fila por fila: las válidas se importan, las inválidas se
    // omiten y se reportan (no se rechaza el archivo completo).
    const filas = [];
    const errors = [];
    const seenInFile = new Set();
    for (let i = 1; i < data.length; i++) {
      const row = data[i] || [];
      const isBlankRow = row.every((cell) => cell === undefined || cell === null || String(cell).trim() === '');
      if (isBlankRow) continue;

      const numFila = i + 1;
      const title = row[0] ? String(row[0]).trim() : null;
      const sku = row[1] ? String(row[1]).trim() : null;
      const costoCell = parseMoneyCell(row[2]);
      const precioCell = parseMoneyCell(row[3]);
      const cover_image_url = row[7] ? String(row[7]).trim() : null;
      const caracteristicas = row[8] ? String(row[8]).trim() : null;

      if (!title) {
        errors.push(`Fila ${numFila}: falta el nombre del producto`);
        continue;
      }
      const titleKey = title.toLowerCase();
      if (existingTitles.has(titleKey) || seenInFile.has(titleKey)) {
        errors.push(`Fila ${numFila}: ya existe un producto llamado "${title}", se omitió`);
        continue;
      }
      if (costoCell.blank || isNaN(costoCell.value)) {
        errors.push(`Fila ${numFila}: falta el costo o no es un número`);
        continue;
      }
      if (precioCell.blank || isNaN(precioCell.value)) {
        errors.push(`Fila ${numFila}: falta el precio o no es un número`);
        continue;
      }
      if (costoCell.value <= 0 || precioCell.value <= 0) {
        errors.push(`Fila ${numFila}: el costo y el precio deben ser mayores a 0`);
        continue;
      }
      if (precioCell.value < costoCell.value) {
        errors.push(`Fila ${numFila}: el precio (${precioCell.value}) es menor al costo (${costoCell.value})`);
        continue;
      }

      seenInFile.add(titleKey);
      filas.push({ title, sku, costo: costoCell.value, price: precioCell.value, cover_image_url, caracteristicas });
    }

    if (filas.length === 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        error: `No se importó ningún producto. Errores encontrados:\n${formatearErrores(errors)}`,
      });
    }

    const dbClient = await pool.connect();
    let productsCreated = 0;
    try {
      await dbClient.query('BEGIN');
      for (const fila of filas) {
        const derived = computeDerived(fila.costo, fila.price);
        await dbClient.query(
          `INSERT INTO products (title, sku, price, cover_image_url, caracteristicas, costo, rentabilidad, margen_75, comision_venta, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [fila.title, fila.sku || null, fila.price, fila.cover_image_url || null, fila.caracteristicas || null, fila.costo, derived.rentabilidad, derived.margen_75, derived.comision_venta, user.id]
        );
        productsCreated++;
      }
      await dbClient.query('COMMIT');
    } catch (dbErr) {
      await dbClient.query('ROLLBACK');
      throw dbErr;
    } finally {
      dbClient.release();
    }

    fs.unlinkSync(filePath);

    if (productsCreated > 0) {
      await crearNoticia({ texto: `Se importaron ${productsCreated} producto(s) desde Excel`, tipo: 'manual', userId: user.id });
    }

    res.json({
      message: errors.length > 0 ? 'Importación completada con algunas filas omitidas' : 'Importación completada',
      products_created: productsCreated,
      skipped_count: errors.length,
      errors,
      total_rows_processed: filas.length + errors.length,
    });

  } catch (err) {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    console.error('Error al importar Excel:', err);
    res.status(500).json({ error: 'Error al importar archivo Excel' });
  }
});

// ============================================
// GET - Exportar todos los productos a Excel para edición masiva
// (orden SIEMPRE por id ASC: es la base para el re-subida por posición)
// ============================================
router.get('/export/excel', authenticateToken, requireManage('No tienes permiso para exportar productos'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY id ASC');

    const rows = [IMPORT_HEADER];
    for (const p of result.rows) {
      rows.push([
        p.title,
        p.sku || '',
        p.costo !== null ? Number(p.costo) : '',
        Number(p.price),
        p.rentabilidad !== null ? Number(p.rentabilidad) : '',
        p.margen_75 !== null ? Number(p.margen_75) : '',
        p.comision_venta !== null ? Number(p.comision_venta) : '',
        p.cover_image_url || '',
        p.caracteristicas || '',
      ]);
    }

    const sheet = xlsx.utils.aoa_to_sheet(rows);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, sheet, 'Productos');
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="productos.xlsx"');
    res.send(buffer);

  } catch (err) {
    console.error('Error al exportar productos:', err);
    res.status(500).json({ error: 'Error al exportar productos' });
  }
});

// ============================================
// POST - Edición masiva: sube el Excel exportado (editado) y actualiza
// cada producto por POSICIÓN de fila, no por ID ni por nombre: la fila N
// de datos corresponde siempre al producto N-ésimo en orden `id ASC`
// (el mismo orden que usa la exportación). Una celda vacía significa
// "no cambiar" ese campo; el archivo debe tener la misma cantidad de
// filas que productos existen (si no, se rechaza para evitar desalinear).
// ============================================
router.post('/bulk-edit/excel', authenticateToken, requireManage('No tienes permiso para editar productos masivamente'), upload.single('file'), async (req, res) => {
  const filePath = req.file?.path;
  try {
    const user = req.user;

    if (!req.file) {
      return res.status(400).json({ error: 'Archivo no proporcionado' });
    }

    const data = leerExcelSubido(filePath);

    if (data.length < 1 || !headerValido(data)) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        error: `El archivo no tiene el formato esperado. La primera fila debe ser exactamente: ${IMPORT_HEADER.join(' | ')} (en ese orden). Usa "Exportar para editar" y no cambies las columnas.`,
      });
    }

    const productos = (await pool.query('SELECT * FROM products ORDER BY id ASC')).rows;
    const dataRows = data.slice(1);

    if (dataRows.length !== productos.length) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        error: `El archivo tiene ${dataRows.length} fila(s) de productos, pero el sistema tiene ${productos.length}. Deben coincidir exactamente (no agregues ni borres filas): vuelve a exportar, edita solo los valores, y vuelve a subirlo.`,
      });
    }

    const errors = [];
    const updates = [];
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i] || [];
      const numFila = i + 2;
      const producto = productos[i];

      const titleCell = row[0] !== undefined && row[0] !== null && String(row[0]).trim() !== '' ? String(row[0]).trim() : null;
      const skuCell = row[1] !== undefined && row[1] !== null && String(row[1]).trim() !== '' ? String(row[1]).trim() : null;
      const costoCell = parseMoneyCell(row[2]);
      const precioCell = parseMoneyCell(row[3]);
      const urlCell = row[7] !== undefined && row[7] !== null && String(row[7]).trim() !== '' ? String(row[7]).trim() : null;
      const descCell = row[8] !== undefined && row[8] !== null && String(row[8]).trim() !== '' ? String(row[8]).trim() : null;

      if (!costoCell.blank && isNaN(costoCell.value)) {
        errors.push(`Fila ${numFila} (${producto.title}): el costo no es un número válido`);
        continue;
      }
      if (!precioCell.blank && isNaN(precioCell.value)) {
        errors.push(`Fila ${numFila} (${producto.title}): el precio no es un número válido`);
        continue;
      }

      const finalCosto = costoCell.blank ? (producto.costo !== null ? Number(producto.costo) : null) : costoCell.value;
      const finalPrecio = precioCell.blank ? Number(producto.price) : precioCell.value;

      if (finalPrecio <= 0) {
        errors.push(`Fila ${numFila} (${producto.title}): el precio debe ser mayor a 0`);
        continue;
      }
      if (finalCosto !== null && finalCosto < 0) {
        errors.push(`Fila ${numFila} (${producto.title}): el costo no puede ser negativo`);
        continue;
      }

      const derived = computeDerived(finalCosto, finalPrecio);
      updates.push({
        id: producto.id,
        title: titleCell || producto.title,
        sku: skuCell !== null ? skuCell : producto.sku,
        price: finalPrecio,
        cover_image_url: urlCell !== null ? urlCell : producto.cover_image_url,
        caracteristicas: descCell !== null ? descCell : producto.caracteristicas,
        costo: finalCosto,
        ...derived,
      });
    }

    if (updates.length === 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        error: `No se actualizó ningún producto. Errores encontrados:\n${formatearErrores(errors)}`,
      });
    }

    const dbClient = await pool.connect();
    try {
      await dbClient.query('BEGIN');
      for (const u of updates) {
        await dbClient.query(
          `UPDATE products
           SET title = $1, sku = $2, price = $3, cover_image_url = $4, caracteristicas = $5,
               costo = $6, rentabilidad = $7, margen_75 = $8, comision_venta = $9, updated_at = CURRENT_TIMESTAMP
           WHERE id = $10`,
          [u.title, u.sku, u.price, u.cover_image_url, u.caracteristicas, u.costo, u.rentabilidad, u.margen_75, u.comision_venta, u.id]
        );
      }
      await dbClient.query('COMMIT');
    } catch (dbErr) {
      await dbClient.query('ROLLBACK');
      throw dbErr;
    } finally {
      dbClient.release();
    }

    fs.unlinkSync(filePath);

    await crearNoticia({ texto: `Se actualizaron ${updates.length} producto(s) vía edición masiva`, tipo: 'manual', userId: user.id });

    res.json({
      message: errors.length > 0 ? 'Edición masiva completada con algunas filas omitidas' : 'Edición masiva completada',
      products_updated: updates.length,
      skipped_count: errors.length,
      errors,
    });

  } catch (err) {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    console.error('Error en edición masiva de Excel:', err);
    res.status(500).json({ error: 'Error al procesar la edición masiva' });
  }
});

// ============================================
// PUT - Actualizar producto
// ============================================
router.put('/:id', authenticateToken, requireManage('No tienes permiso para editar productos'), async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const { title, sku, price, cover_image_url, caracteristicas, costo } = req.body;

    const existing = await pool.query('SELECT price, costo FROM products WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const costoProvided = costo !== undefined;
    const costoNum = costoProvided ? (costo === null || String(costo).trim() === '' ? null : parseFloat(costo)) : existing.rows[0].costo;
    if (costoProvided && costo !== null && String(costo).trim() !== '' && isNaN(costoNum)) {
      return res.status(400).json({ error: 'El costo debe ser un número' });
    }
    const finalPrice = price !== undefined && price !== null && String(price).trim() !== '' ? parseFloat(price) : parseFloat(existing.rows[0].price);
    const derived = computeDerived(costoNum, finalPrice);

    const result = await pool.query(
      `UPDATE products
       SET title = COALESCE($1, title),
           sku = COALESCE($2, sku),
           price = COALESCE($3, price),
           cover_image_url = COALESCE($4, cover_image_url),
           caracteristicas = COALESCE($5, caracteristicas),
           costo = $6,
           rentabilidad = $7,
           margen_75 = $8,
           comision_venta = $9,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $10
       RETURNING *`,
      [title, sku, price, cover_image_url, caracteristicas, costoNum, derived.rentabilidad, derived.margen_75, derived.comision_venta, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const product = result.rows[0];
    await crearNoticia({ texto: `Se editó el producto "${product.title}"`, tipo: 'producto_editado', producto_id: product.id, userId: user.id });

    res.json({
      message: 'Producto actualizado',
      product
    });

  } catch (err) {
    console.error('Error al actualizar producto:', err);
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
});

// ============================================
// PUT - Marcar/desmarcar producto como agotado
// ============================================
router.put('/:id/agotado', authenticateToken, requireManage('No tienes permiso para editar productos'), async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const { agotado } = req.body;

    const result = await pool.query(
      `UPDATE products SET agotado = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [!!agotado, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const product = result.rows[0];
    await crearNoticia({
      texto: product.agotado ? `Producto "${product.title}" marcado como agotado` : `Producto "${product.title}" nuevamente disponible`,
      tipo: product.agotado ? 'producto_agotado' : 'producto_disponible',
      producto_id: product.id,
      userId: user.id
    });

    res.json({ message: 'Estado de stock actualizado', product });

  } catch (err) {
    console.error('Error al actualizar estado de agotado:', err);
    res.status(500).json({ error: 'Error al actualizar estado de agotado' });
  }
});

// ============================================
// DELETE - Eliminar producto
// ============================================
router.delete('/:id', authenticateToken, requireManage('No tienes permiso para eliminar productos'), async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const existing = await pool.query('SELECT title FROM products WHERE id = $1', [id]);

    const result = await pool.query(
      'DELETE FROM products WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const titulo = existing.rows[0]?.title || `#${id}`;
    await crearNoticia({ texto: `Se eliminó el producto "${titulo}"`, tipo: 'producto_eliminado', userId: user.id });

    res.json({ message: 'Producto eliminado' });

  } catch (err) {
    console.error('Error al eliminar producto:', err);
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
});

module.exports = router;