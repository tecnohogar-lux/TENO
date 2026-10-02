// Importar dependencias
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

// Sin JWT_SECRET no se pueden firmar/verificar sesiones: mejor no arrancar que fallar en cada request.
if (!process.env.JWT_SECRET) {
  console.error('❌ Falta JWT_SECRET en las variables de entorno');
  process.exit(1);
}

// Importar rutas
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const salesRoutes = require('./routes/sales');
const dashboardRoutes = require('./routes/dashboard');
const preferencesRoutes = require('./routes/preferences');
const productsRoutes = require('./routes/products');
const cajaRoutes = require('./routes/caja');
const auditRoutes = require('./routes/audit');
const noticiasRoutes = require('./routes/noticias');
const preguntasRoutes = require('./routes/preguntas');
const anotacionesRoutes = require('./routes/anotaciones');
const shippingCostsRoutes = require('./routes/shippingCosts');
const cashRegisterRoutes = require('./routes/cashRegister');
const gastosRoutes = require('./routes/gastos');
const ingresosRoutes = require('./routes/ingresos');
const settingsRoutes = require('./routes/settings');
const retirosTiendaRoutes = require('./routes/retirosTienda');
const couriersRoutes = require('./routes/couriers');

// Crear aplicación
const app = express();

// Detrás de un proxy (Render, Railway, nginx...) define TRUST_PROXY=1 para que el límite de
// intentos de login use la IP real del cliente.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);

// Middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());
// CORS_ORIGIN (opcional): dominios del frontend permitidos, separados por coma. Sin definir, se permite cualquiera (desarrollo).
const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors(allowedOrigins.length > 0 ? { origin: allowedOrigins } : undefined));
app.use(express.json({ limit: '1mb' }));

// Variables
const PORT = process.env.PORT || 3000;

// ============================================
// RUTAS DE API
// ============================================

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/preferences', preferencesRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/caja', cajaRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/noticias', noticiasRoutes);
app.use('/api/preguntas', preguntasRoutes);
app.use('/api/anotaciones', anotacionesRoutes);
app.use('/api/shipping-costs', shippingCostsRoutes);
app.use('/api/cash-register', cashRegisterRoutes);
app.use('/api/gastos', gastosRoutes);
app.use('/api/ingresos', ingresosRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/retiros-tienda', retirosTiendaRoutes);
app.use('/api/couriers', couriersRoutes);

// ============================================
// RUTAS DE PRUEBA
// ============================================

app.get('/', (req, res) => {
  res.json({ message: 'TENO Backend funcionando ✓' });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date(),
    database: 'PostgreSQL conectado'
  });
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
  console.log(`✓ TENO Backend en http://localhost:${PORT}`);
});