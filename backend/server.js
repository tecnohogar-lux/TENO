// Importar dependencias
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./config/database');

// Importar rutas
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const salesRoutes = require('./routes/sales');
const clientsRoutes = require('./routes/clients');
const labelsRoutes = require('./routes/labels');
const dashboardRoutes = require('./routes/dashboard');
const preferencesRoutes = require('./routes/preferences');
const productsRoutes = require('./routes/products');

// Crear aplicación
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Variables
const PORT = process.env.PORT || 3000;

// ============================================
// RUTAS DE API
// ============================================

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/labels', labelsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/preferences', preferencesRoutes);
app.use('/api/products', productsRoutes);

// ============================================
// RUTAS DE PRUEBA
// ============================================

app.get('/', (req, res) => {
  res.json({ 
    message: 'TENO Backend funcionando ✓',
    version: '1.0.0',
    environment: process.env.NODE_ENV,
    endpoints: {
      auth: '/api/auth/login',
      users: '/api/users',
      sales: '/api/sales',
      clients: '/api/clients',
      labels: '/api/labels',
      dashboard: '/api/dashboard',
      preferences: '/api/preferences',
      products: '/api/products'
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date(),
    database: 'PostgreSQL conectado'
  });
});

app.get('/api/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ 
      message: 'Conexión a BD exitosa',
      time: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({ 
      error: 'Error al conectar a BD',
      details: err.message
    });
  }
});

// ============================================
// MANEJO DE ERRORES
// ============================================

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Algo salió mal en el servidor' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// ============================================
// INICIAR SERVIDOR
// ============================================

app.listen(PORT, () => {
  console.log(`\n✓ TENO Backend - Versión COMPLETA`);
  console.log(`✓ URL: http://localhost:${PORT}`);
  console.log(`✓ Endpoints disponibles:`);
  console.log(`  • POST /api/auth/login`);
  console.log(`  • GET /api/users`);
  console.log(`  • POST /api/users`);
  console.log(`  • GET /api/sales`);
  console.log(`  • POST /api/sales`);
  console.log(`  • GET /api/clients`);
  console.log(`  • POST /api/clients`);
  console.log(`  • GET /api/labels`);
  console.log(`  • POST /api/labels`);
  console.log(`  • GET /api/products`);
  console.log(`  • POST /api/products/import`);
  console.log(`  • GET /api/dashboard`);
  console.log(`  • GET /api/preferences`);
  console.log(`  • PUT /api/preferences\n`);
});