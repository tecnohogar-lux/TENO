import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import NuevaVentaAnimacion from './components/NuevaVentaAnimacion';
import LoginPage from './pages/LoginPage';
import useAuth from './hooks/useAuth';
import apiClient from './api/client';
import { applyTheme } from './utils/theme';
import { defaultRouteFor } from './utils/routes';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const SalesPage = lazy(() => import('./pages/SalesPage'));
const CajaPage = lazy(() => import('./pages/CajaPage'));
const RetiroTiendaPage = lazy(() => import('./pages/RetiroTiendaPage'));
const ShippingPage = lazy(() => import('./pages/ShippingPage'));
const BlueExpressPage = lazy(() => import('./pages/BlueExpressPage'));
const CouriersPage = lazy(() => import('./pages/CouriersPage'));
const FotosEntregasPage = lazy(() => import('./pages/FotosEntregasPage'));
const ScanPage = lazy(() => import('./pages/ScanPage'));
const RecepcionPagosPage = lazy(() => import('./pages/RecepcionPagosPage'));
const TrashPage = lazy(() => import('./pages/TrashPage'));
const AuditPage = lazy(() => import('./pages/AuditPage'));
const ProductsPage = lazy(() => import('./pages/ProductsPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const PreferencesPage = lazy(() => import('./pages/PreferencesPage'));
const NoticiasPage = lazy(() => import('./pages/NoticiasPage'));
const PreguntasPage = lazy(() => import('./pages/PreguntasPage'));
const AnotacionesPage = lazy(() => import('./pages/AnotacionesPage'));
const ReglasPage = lazy(() => import('./pages/ReglasPage'));
const ShippingCostsPage = lazy(() => import('./pages/ShippingCostsPage'));
const CashRegisterPage = lazy(() => import('./pages/CashRegisterPage'));
const GastosPage = lazy(() => import('./pages/GastosPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

function PageLoader() {
  return (
    <div className="page-loading" style={{ minHeight: '100vh' }}>
      <div className="spinner" />
    </div>
  );
}

const STAFF_ROLES = ['vendedor', 'operador', 'admin', 'caja'];
const ADMIN_OPERADOR = ['operador', 'admin', 'caja'];

function DefaultRedirect() {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to={defaultRouteFor(user?.role)} replace />;
}

export default function App() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;
    apiClient.get('/api/preferences')
      .then(({ data }) => applyTheme(data.theme || 'light'))
      .catch(() => {});
  }, [isAuthenticated]);

  return (
    <BrowserRouter>
      <NuevaVentaAnimacion />
      <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route path="/dashboard" element={<ProtectedRoute roles={STAFF_ROLES}><DashboardPage /></ProtectedRoute>} />
        <Route path="/sales" element={<ProtectedRoute roles={STAFF_ROLES}><SalesPage /></ProtectedRoute>} />
        <Route path="/caja" element={<ProtectedRoute roles={ADMIN_OPERADOR}><CajaPage /></ProtectedRoute>} />
        <Route path="/retiro-tienda" element={<ProtectedRoute roles={STAFF_ROLES}><RetiroTiendaPage /></ProtectedRoute>} />
        <Route path="/shipping" element={<ProtectedRoute roles={[...STAFF_ROLES, 'escaneo']}><ShippingPage /></ProtectedRoute>} />
        <Route path="/envios-regiones" element={<ProtectedRoute roles={STAFF_ROLES}><BlueExpressPage /></ProtectedRoute>} />
        <Route path="/couriers" element={<ProtectedRoute roles={ADMIN_OPERADOR}><CouriersPage /></ProtectedRoute>} />
        <Route path="/fotos-entregas" element={<ProtectedRoute roles={['admin']}><FotosEntregasPage /></ProtectedRoute>} />
        <Route path="/scan" element={<ProtectedRoute roles={['operador', 'admin', 'escaneo', 'caja']}><ScanPage /></ProtectedRoute>} />
        <Route path="/products" element={<ProtectedRoute roles={STAFF_ROLES}><ProductsPage /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute roles={STAFF_ROLES}><ReportsPage /></ProtectedRoute>} />
        <Route path="/noticias" element={<ProtectedRoute roles={STAFF_ROLES}><NoticiasPage /></ProtectedRoute>} />
        <Route path="/preguntas" element={<ProtectedRoute roles={STAFF_ROLES}><PreguntasPage /></ProtectedRoute>} />
        <Route path="/anotaciones" element={<ProtectedRoute roles={ADMIN_OPERADOR}><AnotacionesPage /></ProtectedRoute>} />
        <Route path="/reglas" element={<ProtectedRoute roles={STAFF_ROLES}><ReglasPage /></ProtectedRoute>} />
        <Route path="/shipping-costs" element={<ProtectedRoute roles={STAFF_ROLES}><ShippingCostsPage /></ProtectedRoute>} />
        <Route path="/cash-register" element={<ProtectedRoute roles={ADMIN_OPERADOR}><CashRegisterPage /></ProtectedRoute>} />
        <Route path="/gastos" element={<ProtectedRoute roles={ADMIN_OPERADOR}><GastosPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute roles={['admin']}><SettingsPage /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute roles={['admin']}><UsersPage /></ProtectedRoute>} />
        <Route path="/recepcion-pagos" element={<ProtectedRoute roles={['admin']}><RecepcionPagosPage /></ProtectedRoute>} />
        <Route path="/trash" element={<ProtectedRoute roles={['admin']}><TrashPage /></ProtectedRoute>} />
        <Route path="/audit" element={<ProtectedRoute roles={['admin']}><AuditPage /></ProtectedRoute>} />
        <Route path="/preferences" element={<ProtectedRoute roles={STAFF_ROLES}><PreferencesPage /></ProtectedRoute>} />

        <Route path="/" element={<DefaultRedirect />} />
        <Route path="*" element={<DefaultRedirect />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
