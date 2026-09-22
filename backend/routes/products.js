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
    const { title, sku, price, cover_image_url, caracteristicas } = req.body;

    if (!title || !price) {
      return res.status(400).json({ error: 'Título y precio requeridos' });
    }

    const result = await pool.query(
      `INSERT INTO products (title, sku, price, cover_image_url, caracteristicas, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [title, sku || null, price, cover_image_url || null, caracteristicas || null, user.id]
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

// Encabezado esperado del Excel de importación (mismo orden mostrado al
// usuario en el pop-up del frontend antes de subir el archivo).
const IMPORT_HEADER = ['Título', 'SKU', 'Precio', 'URL Imagen'];

function normalizarEncabezado(value) {
  return String(value ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita tildes
    .trim()
    .toLowerCase();
}

// ============================================
// POST - Importar productos desde Excel
// ============================================
router.post('/import/excel', authenticateToken, requireManage('No tienes permiso para importar productos'), upload.single('file'), async (req, res) => {
  const filePath = req.file?.path;
  try {
    const user = req.user;

    if (!req.file) {
      return res.status(400).json({ error: 'Archivo no proporcionado' });
    }

    // Leer archivo Excel
    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    if (data.length < 1) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'El archivo Excel está vacío' });
    }

    // La primera fila debe ser exactamente el encabezado esperado, en orden.
    const headerRow = data[0] || [];
    const headerValido = IMPORT_HEADER.every((col, idx) => normalizarEncabezado(headerRow[idx]) === normalizarEncabezado(col));
    if (!headerValido) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        error: `El archivo no tiene el formato esperado. La primera fila debe ser exactamente: ${IMPORT_HEADER.join(' | ')} (en ese orden, sin columnas de más o de menos).`,
      });
    }

    if (data.length < 2) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'El archivo no tiene filas de productos, solo el encabezado.' });
    }

    // Primero se valida TODO el archivo; si hay algún error no se importa nada.
    const filas = [];
    const errors = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i] || [];
      const isBlankRow = row.every((cell) => cell === undefined || cell === null || String(cell).trim() === '');
      if (isBlankRow) continue;

      const title = row[0] ? String(row[0]).trim() : null;
      const sku = row[1] ? String(row[1]).trim() : null;
      const priceRaw = row[2];
      const price = priceRaw !== undefined && priceRaw !== null && String(priceRaw).trim() !== '' ? parseFloat(priceRaw) : null;
      const cover_image_url = row[3] ? String(row[3]).trim() : null;

      if (!title) {
        errors.push(`Fila ${i + 1}: falta el título`);
        continue;
      }
      if (price === null || isNaN(price)) {
        errors.push(`Fila ${i + 1}: falta el precio o no es un número`);
        continue;
      }
      if (price <= 0) {
        errors.push(`Fila ${i + 1}: el precio debe ser mayor a 0`);
        continue;
      }

      filas.push({ title, sku, price, cover_image_url });
    }

    if (errors.length > 0) {
      fs.unlinkSync(filePath);
      const MAX_ERRORS_SHOWN = 15;
      const listado = errors.slice(0, MAX_ERRORS_SHOWN).join('\n');
      const resto = errors.length > MAX_ERRORS_SHOWN ? `\n... y ${errors.length - MAX_ERRORS_SHOWN} error(es) más` : '';
      return res.status(400).json({
        error: `El archivo tiene errores y no se importó ningún producto. Corrígelos y vuelve a subirlo:\n${listado}${resto}`,
      });
    }

    if (filas.length === 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'El archivo no tiene filas de productos con datos.' });
    }

    // Todas las filas son válidas: se insertan de forma atómica.
    const dbClient = await pool.connect();
    let productsCreated = 0;
    try {
      await dbClient.query('BEGIN');
      for (const fila of filas) {
        await dbClient.query(
          `INSERT INTO products (title, sku, price, cover_image_url, created_by)
           VALUES ($1, $2, $3, $4, $5)`,
          [fila.title, fila.sku || null, fila.price, fila.cover_image_url || null, user.id]
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

    res.json({
      message: 'Importación completada',
      products_created: productsCreated,
      errors: [],
      total_rows_processed: filas.length,
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
// PUT - Actualizar producto
// ============================================
router.put('/:id', authenticateToken, requireManage('No tienes permiso para editar productos'), async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const { title, sku, price, cover_image_url, caracteristicas } = req.body;

    const result = await pool.query(
      `UPDATE products
       SET title = COALESCE($1, title),
           sku = COALESCE($2, sku),
           price = COALESCE($3, price),
           cover_image_url = COALESCE($4, cover_image_url),
           caracteristicas = COALESCE($5, caracteristicas),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [title, sku, price, cover_image_url, caracteristicas, id]
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