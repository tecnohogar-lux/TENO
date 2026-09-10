import { NavLink } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import Logo from './Logo';

const MODULES = [
  { path: '/dashboard', label: 'Dashboard', roles: ['vendedor', 'operador', 'admin'] },
  { path: '/sales', label: 'Ventas', roles: ['vendedor', 'operador', 'admin'] },
  { path: '/caja', label: 'Caja', roles: ['operador', 'admin'] },
  { path: '/shipping', label: 'Envíos', roles: ['vendedor', 'operador', 'admin', 'escaneo'] },
  { path: '/shipping-costs', label: 'Costos de envío', roles: ['vendedor', 'operador', 'admin'] },
  { path: '/region-shipping', label: 'Envíos a Regiones', roles: ['vendedor', 'operador', 'admin'] },
  { path: '/clients', label: 'Clientes', roles: ['vendedor', 'operador', 'admin'] },
  { path: '/products', label: 'Productos', roles: ['vendedor', 'operador', 'admin'] },
  { path: '/noticias', label: 'Noticias', roles: ['vendedor', 'operador', 'admin'] },
  { path: '/anotaciones', label: 'Anotaciones diarias', roles: ['operador', 'admin'] },
  { path: '/cash-register', label: 'Cierre de Caja', roles: ['operador', 'admin'] },
  { path: '/gastos', label: 'Gastos y egresos', roles: ['operador', 'admin'] },
  { path: '/reports', label: 'Reportes', roles: ['operador', 'admin'] },
  { path: '/users', label: 'Usuarios', roles: ['admin'] },
  { path: '/trash', label: 'Papelera', roles: ['admin'] },
  { path: '/audit', label: 'Auditoría', roles: ['admin'] },
  { path: '/settings', label: 'Configuración', roles: ['admin'] },
  { path: '/preferences', label: 'Preferencias', roles: ['vendedor', 'operador', 'admin'] },
];

export default function Sidebar({ mobileOpen = false, onNavigate }) {
  const { user, logout } = useAuth();
  const visibleModules = MODULES.filter((m) => m.roles.includes(user?.role));

  return (
    <aside className={`sidebar${mobileOpen ? ' sidebar-open' : ''}`}>
      <div style={{ padding: '16px 16px 16px', borderBottom: '1px solid var(--color-sidebar-border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button className="sidebar-close-btn" onClick={onNavigate} aria-label="Cerrar menú">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <div style={{ background: '#fff', borderRadius: 'var(--radius-sm)', padding: '10px 12px', width: '100%', boxSizing: 'border-box' }}>
          <Logo style={{ width: '100%', height: 'auto' }} />
        </div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-sidebar-text)' }}>TecnOS</div>
          <div style={{ fontSize: 11, fontWeight: 600, marginTop: 1, color: 'var(--color-sidebar-text)', opacity: 0.7 }}>
            {user?.name} · {user?.role}
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: '14px 10px', overflowY: 'auto' }}>
        {visibleModules.map((m) => (
          <NavLink
            key={m.path}
            to={m.path}
            onClick={onNavigate}
            style={({ isActive }) => ({
              display: 'block',
              padding: '11px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 14,
              fontWeight: 700,
              marginBottom: 4,
              transition: 'background-color 0.15s ease, color 0.15s ease',
              color: isActive ? 'var(--color-sidebar-text-active)' : 'var(--color-sidebar-text)',
              background: isActive ? 'var(--color-sidebar-active-bg)' : 'transparent',
            })}
            onMouseEnter={(e) => {
              if (!e.currentTarget.classList.contains('active')) e.currentTarget.style.background = 'var(--color-sidebar-hover)';
            }}
            onMouseLeave={(e) => {
              if (e.currentTarget.getAttribute('aria-current') !== 'page') e.currentTarget.style.background = 'transparent';
            }}
          >
            {m.label}
          </NavLink>
        ))}
      </nav>

      <div style={{ padding: 16, borderTop: '1px solid var(--color-sidebar-border)' }}>
        <button
          onClick={logout}
          className="btn"
          style={{
            width: '100%',
            background: 'var(--color-sidebar-active-bg)',
            borderColor: 'var(--color-sidebar-active-bg)',
            color: '#fff',
            fontWeight: 700,
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
