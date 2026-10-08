import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import usePreguntasUnreadCount from '../hooks/usePreguntasUnreadCount';
import Logo from './Logo';
import CategoryIcon from './CategoryIcon';
import HelpButton from './HelpButton';

const PREGUNTAS_ROLES = ['vendedor', 'operador', 'admin', 'caja'];

const MODULE_GROUPS = [
  {
    label: null,
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: 'dashboard', roles: ['vendedor', 'operador', 'admin', 'caja'] },
    ],
  },
  {
    label: 'Ventas',
    icon: 'ventas',
    color: 'ventas',
    items: [
      { path: '/sales', label: 'Historial de Ventas', roles: ['vendedor', 'operador', 'admin', 'caja'] },
      { path: '/retiro-tienda', label: 'Retiro en Tienda', roles: ['vendedor', 'operador', 'admin', 'caja'] },
      { path: '/caja', label: 'Caja', roles: ['operador', 'admin', 'caja'] },
      { path: '/cash-register', label: 'Apertura/Cierre de Caja', roles: ['operador', 'admin', 'caja'] },
      { path: '/gastos', label: 'Gastos e ingresos', roles: ['operador', 'admin', 'caja'] },
    ],
  },
  {
    label: 'Envíos',
    icon: 'envios',
    color: 'envios',
    items: [
      { path: '/shipping', label: 'Delivery Santiago', roles: ['vendedor', 'operador', 'admin', 'escaneo', 'caja'] },
      { path: '/couriers', label: 'Couriers', roles: ['operador', 'admin', 'caja'] },
      { path: '/envios-regiones', label: 'Envíos Regiones', roles: ['vendedor', 'operador', 'admin', 'caja'] },
      { path: '/shipping-costs', label: 'Costos de envío', roles: ['vendedor', 'operador', 'admin', 'caja'] },
    ],
  },
  {
    label: 'Catálogo',
    icon: 'catalogo',
    color: 'catalogo',
    items: [
      { path: '/products', label: 'Productos', roles: ['vendedor', 'operador', 'admin', 'caja'] },
    ],
  },
  {
    label: 'Comunicación',
    icon: 'comunicacion',
    color: 'comunicacion',
    items: [
      { path: '/noticias', label: 'Noticias', roles: ['vendedor', 'operador', 'admin', 'caja'] },
      { path: '/anotaciones', label: 'Anotaciones diarias', roles: ['operador', 'admin', 'caja'] },
      { path: '/reglas', label: 'Reglas', roles: ['vendedor', 'operador', 'admin', 'caja'] },
    ],
  },
  {
    label: 'Análisis',
    icon: 'analisis',
    color: 'analisis',
    items: [
      { path: '/reports', label: 'Reportes', roles: ['vendedor', 'operador', 'admin', 'caja'] },
      { path: '/audit', label: 'Auditoría', roles: ['admin'] },
    ],
  },
  {
    label: 'Administración',
    icon: 'administracion',
    color: 'administracion',
    items: [
      { path: '/recepcion-pagos', label: 'Recepción de Pagos', roles: ['admin'] },
      { path: '/users', label: 'Usuarios', roles: ['admin'] },
      { path: '/trash', label: 'Papelera', roles: ['admin'] },
      { path: '/settings', label: 'Configuración', roles: ['admin'] },
    ],
  },
  {
    label: null,
    items: [
      { path: '/preferences', label: 'Preferencias', roles: ['vendedor', 'operador', 'admin', 'caja'] },
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
        display: m.icon ? 'flex' : 'block',
        alignItems: 'center',
        gap: 10,
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
      {m.icon && (
        <span style={{ width: 24, display: 'inline-flex', justifyContent: 'center', flexShrink: 0 }}>
          <CategoryIcon name={m.icon} size={18} />
        </span>
      )}
      {m.label}
    </NavLink>
  );
}

// Enlace a Preguntas: fuera de las categorías (siempre visible, aunque todo esté
// colapsado), con un círculo azul que muestra en rojo la cantidad de preguntas sin leer.
function PreguntasNavItem({ onNavigate, count }) {
  return (
    <NavLink
      to="/preguntas"
      onClick={onNavigate}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 10,
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
        if (e.currentTarget.getAttribute('aria-current') !== 'page') e.currentTarget.style.background = 'var(--color-sidebar-hover)';
      }}
      onMouseLeave={(e) => {
        if (e.currentTarget.getAttribute('aria-current') !== 'page') e.currentTarget.style.background = 'transparent';
      }}
    >
      <span
        style={{
          width: 24,
          height: 24,
          flexShrink: 0,
          borderRadius: '50%',
          background: 'var(--color-primary)',
          color: count > 0 ? '#ff5a4e' : '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: count > 9 ? 10 : 12,
          fontWeight: 800,
          lineHeight: 1,
        }}
      >
        {count > 0 ? (count > 99 ? '99+' : count) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      Preguntas
    </NavLink>
  );
}

function Chevron({ open }) {
  return (
    <svg
      className={`sidebar-group-chevron${open ? ' sidebar-group-chevron-open' : ''}`}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Sidebar({ mobileOpen = false, onNavigate }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const showPreguntas = PREGUNTAS_ROLES.includes(user?.role);
  const { count: preguntasUnread } = usePreguntasUnreadCount(showPreguntas);
  const visibleGroups = MODULE_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((m) => m.roles.includes(user?.role)) }))
    .filter((g) => g.items.length > 0);

  // El grupo que contiene la ruta activa siempre parte (y se mantiene) abierto;
  // el resto de las categorías cargan compactas por defecto.
  const activeGroupLabel = useMemo(() => {
    const match = visibleGroups.find((g) => g.items.some((m) => location.pathname.startsWith(m.path)));
    return match?.label || null;
  }, [visibleGroups, location.pathname]);

  const [openGroups, setOpenGroups] = useState(() => new Set(activeGroupLabel ? [activeGroupLabel] : []));

  useEffect(() => {
    if (activeGroupLabel) {
      setOpenGroups((prev) => (prev.has(activeGroupLabel) ? prev : new Set(prev).add(activeGroupLabel)));
    }
  }, [activeGroupLabel]);

  function toggleGroup(label) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

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
            {g.label ? (() => {
              const isOpen = openGroups.has(g.label);
              return (
                <>
                  <button
                    type="button"
                    className="sidebar-group-header"
                    onClick={() => toggleGroup(g.label)}
                    aria-expanded={isOpen}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: g.color ? `var(--color-group-${g.color})` : 'var(--color-text-muted)',
                    }}
                  >
                    {g.icon && <CategoryIcon name={g.icon} size={18} />}
                    {g.label}
                    <Chevron open={isOpen} />
                  </button>
                  <div className={`sidebar-group-items${isOpen ? ' sidebar-group-items-open' : ''}`}>
                    <div className="sidebar-group-items-inner">
                      <div style={{ borderLeft: `2px solid var(--color-group-${g.color})`, paddingLeft: 6, marginLeft: 8 }}>
                        {g.items.map((m) => (
                          <NavItem key={m.path} m={m} onNavigate={onNavigate} color={g.color} />
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              );
            })() : (
              g.items.map((m) => (
                <NavItem key={m.path} m={m} onNavigate={onNavigate} color={g.color} />
              ))
            )}
            {i === 0 && showPreguntas && <PreguntasNavItem onNavigate={onNavigate} count={preguntasUnread} />}
          </div>
        ))}
      </nav>

      <div style={{ padding: 16, borderTop: '1px solid var(--color-sidebar-border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Centro de ayuda: por ahora solo para vendedores. */}
        {user?.role === 'vendedor' && <HelpButton onOpen={onNavigate} />}
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
