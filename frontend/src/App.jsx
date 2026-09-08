import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import SalesPage from './pages/SalesPage';
import POSPage from './pages/POSPage';
import ShippingPage from './pages/ShippingPage';
import ScanPage from './pages/ScanPage';
import ClientsPage from './pages/ClientsPage';
import ProductsPage from './pages/ProductsPage';
import LabelsPage from './pages/LabelsPage';
import ReportsPage from './pages/ReportsPage';
import UsersPage from './pages/UsersPage';
import PreferencesPage from './pages/PreferencesPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/sales" element={<ProtectedRoute><SalesPage /></ProtectedRoute>} />
        <Route path="/pos" element={<ProtectedRoute roles={['operador', 'admin']}><POSPage /></ProtectedRoute>} />
        <Route path="/shipping" element={<ProtectedRoute roles={['operador', 'admin']}><ShippingPage /></ProtectedRoute>} />
        <Route path="/scan" element={<ProtectedRoute roles={['operador', 'admin']}><ScanPage /></ProtectedRoute>} />
        <Route path="/clients" element={<ProtectedRoute><ClientsPage /></ProtectedRoute>} />
        <Route path="/products" element={<ProtectedRoute><ProductsPage /></ProtectedRoute>} />
        <Route path="/labels" element={<ProtectedRoute><LabelsPage /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute roles={['operador', 'admin']}><ReportsPage /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute roles={['admin']}><UsersPage /></ProtectedRoute>} />
        <Route path="/preferences" element={<ProtectedRoute><PreferencesPage /></ProtectedRoute>} />

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
