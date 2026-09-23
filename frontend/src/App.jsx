import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import SalesPage from './pages/SalesPage';
import CajaPage from './pages/CajaPage';
import RetiroTiendaPage from './pages/RetiroTiendaPage';
import ShippingPage from './pages/ShippingPage';
import BlueExpressPage from './pages/BlueExpressPage';
import CouriersPage from './pages/CouriersPage';
import ScanPage from './pages/ScanPage';
import TrashPage from './pages/TrashPage';
import AuditPage from './pages/AuditPage';
import ClientsPage from './pages/ClientsPage';
import ProductsPage from './pages/ProductsPage';
import ReportsPage from './pages/ReportsPage';
import UsersPage from './pages/UsersPage';
import PreferencesPage from './pages/PreferencesPage';
import NoticiasPage from './pages/NoticiasPage';
import AnotacionesPage from './pages/AnotacionesPage';
import ShippingCostsPage from './pages/ShippingCostsPage';
import RegionShippingPage from './pages/RegionShippingPage';
import CashRegisterPage from './pages/CashRegisterPage';
import GastosPage from './pages/GastosPage';
import SettingsPage from './pages/SettingsPage';
import useAuth from './hooks/useAuth';
import apiClient from './api/client';
import { applyTheme } from './utils/theme';
import { defaultRouteFor } from './utils/routes';

const STAFF_ROLES = ['vendedor', 'operador', 'admin'];
const ADMIN_OPERADOR = ['operador', 'admin'];

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
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route path="/dashboard" element={<ProtectedRoute roles={STAFF_ROLES}><DashboardPage /></ProtectedRoute>} />
        <Route path="/sales" element={<ProtectedRoute roles={STAFF_ROLES}><SalesPage /></ProtectedRoute>} />
        <Route path="/caja" element={<ProtectedRoute roles={ADMIN_OPERADOR}><CajaPage /></ProtectedRoute>} />
        <Route path="/retiro-tienda" element={<ProtectedRoute roles={STAFF_ROLES}><RetiroTiendaPage /></ProtectedRoute>} />
        <Route path="/shipping" element={<ProtectedRoute roles={[...STAFF_ROLES, 'escaneo']}><ShippingPage /></ProtectedRoute>} />
        <Route path="/envios-bluexpress" element={<ProtectedRoute roles={STAFF_ROLES}><BlueExpressPage /></ProtectedRoute>} />
        <Route path="/couriers" element={<ProtectedRoute roles={ADMIN_OPERADOR}><CouriersPage /></ProtectedRoute>} />
        <Route path="/scan" element={<ProtectedRoute roles={['operador', 'admin', 'escaneo']}><ScanPage /></ProtectedRoute>} />
        <Route path="/clients" element={<ProtectedRoute roles={STAFF_ROLES}><ClientsPage /></ProtectedRoute>} />
        <Route path="/products" element={<ProtectedRoute roles={STAFF_ROLES}><ProductsPage /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute roles={ADMIN_OPERADOR}><ReportsPage /></ProtectedRoute>} />
        <Route path="/noticias" element={<ProtectedRoute roles={STAFF_ROLES}><NoticiasPage /></ProtectedRoute>} />
        <Route path="/anotaciones" element={<ProtectedRoute roles={ADMIN_OPERADOR}><AnotacionesPage /></ProtectedRoute>} />
        <Route path="/shipping-costs" element={<ProtectedRoute roles={STAFF_ROLES}><ShippingCostsPage /></ProtectedRoute>} />
        <Route path="/region-shipping" element={<ProtectedRoute roles={STAFF_ROLES}><RegionShippingPage /></ProtectedRoute>} />
        <Route path="/cash-register" element={<ProtectedRoute roles={ADMIN_OPERADOR}><CashRegisterPage /></ProtectedRoute>} />
        <Route path="/gastos" element={<ProtectedRoute roles={ADMIN_OPERADOR}><GastosPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute roles={['admin']}><SettingsPage /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute roles={['admin']}><UsersPage /></ProtectedRoute>} />
        <Route path="/trash" element={<ProtectedRoute roles={['admin']}><TrashPage /></ProtectedRoute>} />
        <Route path="/audit" element={<ProtectedRoute roles={['admin']}><AuditPage /></ProtectedRoute>} />
        <Route path="/preferences" element={<ProtectedRoute roles={STAFF_ROLES}><PreferencesPage /></ProtectedRoute>} />

        <Route path="/" element={<DefaultRedirect />} />
        <Route path="*" element={<DefaultRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}
