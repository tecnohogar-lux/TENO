import { NavLink } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import Logo from './Logo';

const MODULE_GROUPS = [
  {
    label: null,
    items: [
      { path: '/dashboard', label: 'Dashboard', roles: ['vendedor', 'operador', 'admin'] },
    ],
  },
  {
    label: 'Ventas',
    color: 'ventas',
    items: [
      { path: '/sales', label: 'Historial de Ventas', roles: ['vendedor', 'operador', 'admin'] },
      { path: '/retiro-tienda', label: 'Retiro en Tienda', roles: ['vendedor', 'operador', 'admin'] },
      { path: '/caja', label: 'Caja', roles: ['operador', 'admin'] },
      { path: '/cash-register', label: 'Cierre de Caja', roles: ['operador', 'admin'] },
      { path: '/gastos', label: 'Gastos y egresos', roles: ['operador', 'admin'] },
    ],
  },
  {
    label: 'Envíos',
    color: 'envios',
    items: [
      { path: '/shipping', label: 'Delivery Santiago', roles: ['vendedor', 'operador', 'admin', 'escaneo'] },
      { path: '/envios-bluexpress', label: 'Envíos BlueExpress', roles: ['vendedor', 'operador', 'admin'] },
      { path: '/shipping-costs', label: 'Costos de envío', roles: ['vendedor', 'operador', 'admin'] },
      { path: '/region-shipping', label: 'Envíos a Regiones', roles: ['vendedor', 'operador', 'admin'] },
    ],
  },
  {
    label: 'Catálogo',
    color: 'catalogo',
    items: [
      { path: '/products', label: 'Productos', roles: ['vendedor', 'operador', 'admin'] },
      { path: '/clients', label: 'Clientes', roles: ['vendedor', 'operador', 'admin'] },
    ],
  },
  {
    label: 'Comunicación',
    color: 'comunicacion',
    items: [
      { path: '/noticias', label: 'Noticias', roles: ['vendedor', 'operador', 'admin'] },
      { path: '/anotaciones', label: 'Anotaciones diarias', roles: ['operador', 'admin'] },
    ],
  },
  {
    label: 'Análisis',
    color: 'analisis',
    items: [
      { path: '/reports', label: 'Reportes', roles: ['operador', 'admin'] },
      { path: '/audit', label: 'Auditoría', roles: ['admin'] },
    ],
  },
  {
    label: 'Administración',
    color: 'administracion',
    items: [
      { path: '/users', label: 'Usuarios', roles: ['admin'] },
      { path: '/trash', label: 'Papelera', roles: ['admin'] },
      { path: '/settings', label: 'Configuración', roles: ['admin'] },
    ],
  },
  {
    label: null,
    items: [
      { path: '/preferences', label: 'Preferencias', roles: ['vendedor', 'operador', 'admin'] },
    ],
  },
];

function NavItem({ m, onNavigate, color }) {
  const activeColor = color ? `var(--color-group-${color})` : 'var(--color-sidebar-text-active)';
  const activeBg = color ? `var(--color-group-${color}-bg)` : 'var(--color-sidebar-active-bg)';

  return (
    <NavLink
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
        color: isActive ? activeColor : 'var(--color-sidebar-text)',
        background: isActive ? activeBg : 'transparent',
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
  );
}

export default function Sidebar({ mobileOpen = false, onNavigate }) {
  const { user, logout } = useAuth();
  const visibleGroups = MODULE_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((m) => m.roles.includes(user?.role)) }))
    .filter((g) => g.items.length > 0);

  return (
    <aside className={`sidebar${mobileOpen ? ' sidebar-open' : ''}`}>
      <div style={{ padding: '16px 16px 16px', borderBottom: '1px solid var(--color-sidebar-border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button className="sidebar-close-btn" onClick={onNavigate} aria-label="Cerrar menú">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <div style={{ background: '#fff', borderRadius: 'var(--radius-sm)', padding: '12px 16px', width: '100%', boxSizing: 'border-box' }}>
          <Logo style={{ width: '100%', height: 'auto' }} />
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-sidebar-text)' }}>
          {user?.name} · {user?.role}
        </div>
      </div>

      <nav style={{ flex: 1, padding: '14px 10px', overflowY: 'auto' }}>
        {visibleGroups.map((g, i) => (
          <div
            key={g.label || `group-${i}`}
            style={{
              marginTop: i === 0 ? 0 : 18,
              paddingTop: i === 0 ? 0 : 16,
              borderTop: i === 0 ? 'none' : '1px solid var(--color-sidebar-border)',
            }}
          >
            {g.label && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: g.color ? `var(--color-group-${g.color})` : 'var(--color-text-muted)',
                  padding: '0 14px',
                  marginBottom: 6,
                }}
              >
                {g.color && (
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: `var(--color-group-${g.color})`,
                      flexShrink: 0,
                    }}
                  />
                )}
                {g.label}
              </div>
            )}
            <div
              style={g.color ? { borderLeft: `2px solid var(--color-group-${g.color})`, paddingLeft: 6, marginLeft: 8 } : undefined}
            >
              {g.items.map((m) => (
                <NavItem key={m.path} m={m} onNavigate={onNavigate} color={g.color} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div style={{ padding: 16, borderTop: '1px solid var(--color-sidebar-border)' }}>
        <button
          onClick={logout}
          className="btn"
          style={{
            width: '100%',
            background: 'var(--color-primary)',
            borderColor: 'var(--color-primary)',
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
