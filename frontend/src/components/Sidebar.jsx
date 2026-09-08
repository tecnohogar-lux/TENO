import { NavLink } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

const MODULES = [
  { path: '/dashboard', label: 'Dashboard', roles: ['vendedor', 'operador', 'admin'] },
  { path: '/sales', label: 'Ventas', roles: ['vendedor', 'operador', 'admin'] },
  { path: '/pos', label: 'Punto de Venta', roles: ['operador', 'admin'] },
  { path: '/shipping', label: 'Envíos', roles: ['operador', 'admin'] },
  { path: '/scan', label: 'Escanear', roles: ['operador', 'admin'] },
  { path: '/clients', label: 'Clientes', roles: ['vendedor', 'operador', 'admin'] },
  { path: '/products', label: 'Productos', roles: ['vendedor', 'operador', 'admin'] },
  { path: '/labels', label: 'Etiquetas', roles: ['vendedor', 'operador', 'admin'] },
  { path: '/reports', label: 'Reportes', roles: ['operador', 'admin'] },
  { path: '/users', label: 'Usuarios', roles: ['admin'] },
  { path: '/preferences', label: 'Preferencias', roles: ['vendedor', 'operador', 'admin'] },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const visibleModules = MODULES.filter((m) => m.roles.includes(user?.role));

  return (
    <aside
      style={{
        width: 'var(--sidebar-width)',
        flexShrink: 0,
        background: 'var(--color-sidebar-bg)',
        color: 'var(--color-sidebar-text)',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'sticky',
        top: 0,
      }}
    >
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: '#fff' }}>TENO ERP</div>
        <div style={{ fontSize: 12, marginTop: 4, color: 'var(--color-sidebar-text)' }}>
          {user?.name} · {user?.role}
        </div>
      </div>

      <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
        {visibleModules.map((m) => (
          <NavLink
            key={m.path}
            to={m.path}
            style={({ isActive }) => ({
              display: 'block',
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 14,
              marginBottom: 2,
              color: isActive ? 'var(--color-sidebar-text-active)' : 'var(--color-sidebar-text)',
              background: isActive ? 'var(--color-sidebar-hover)' : 'transparent',
            })}
          >
            {m.label}
          </NavLink>
        ))}
      </nav>

      <div style={{ padding: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <button
          onClick={logout}
          className="btn btn-secondary"
          style={{ width: '100%', background: 'transparent', borderColor: 'rgba(255,255,255,0.15)', color: 'var(--color-sidebar-text)' }}
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
