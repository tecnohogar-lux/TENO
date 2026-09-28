import { useState } from 'react';
import Sidebar from './Sidebar';
import Logo from './Logo';
import HelpButton from './HelpButton';
import useAuth from '../hooks/useAuth';

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg)' }}>
      <div className="mobile-topbar">
        <button className="hamburger-btn" onClick={() => setMobileOpen(true)} aria-label="Abrir menú">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <div style={{ background: '#fff', borderRadius: 'var(--radius-sm)', padding: '4px 8px' }}>
          <Logo height={18} />
        </div>
      </div>

      <div
        className={`sidebar-overlay${mobileOpen ? ' sidebar-overlay-open' : ''}`}
        onClick={() => setMobileOpen(false)}
      />

      <Sidebar mobileOpen={mobileOpen} onNavigate={() => setMobileOpen(false)} />

      <main className="page-content" style={{ flex: 1, minWidth: 0 }}>{children}</main>

      {/* Centro de ayuda flotante: por ahora solo para vendedores. */}
      {user?.role === 'vendedor' && <HelpButton />}
    </div>
  );
}
