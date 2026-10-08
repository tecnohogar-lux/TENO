import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { defaultRouteFor } from '../utils/routes';
import { peekSessionMessage, clearSessionMessage } from '../utils/session';

export default function LoginPage() {
  const { login, loading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  // Si llegaste aquí porque la sesión venció (o la cuenta se desactivó), se explica en pantalla.
  const [aviso] = useState(() => peekSessionMessage());
  useEffect(() => { clearSessionMessage(); }, []);

  if (isAuthenticated) {
    return <Navigate to={defaultRouteFor(user?.role)} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const result = await login(email, password);
    if (result.success) {
      navigate(defaultRouteFor(result.user.role));
    } else {
      setError(result.error);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg)',
      }}
    >
      <form onSubmit={handleSubmit} className="card" style={{ padding: 32, width: 360 }}>
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 600 }}>TENO ERP</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>
            Ingresa a tu cuenta
          </div>
        </div>

        {aviso && !error && <div className="alert" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-warning)', fontSize: 13 }}>{aviso}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        <div className="form-field">
          <label htmlFor="email">Usuario</label>
          <input
            id="email"
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value.trim())}
            placeholder="Usuario"
            autoCapitalize="none"
            autoCorrect="off"
            required
            autoFocus
          />
        </div>

        <div className="form-field">
          <label htmlFor="password">Contraseña</label>
          <div style={{ position: 'relative', display: 'flex' }}>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              autoComplete="current-password"
              required
              style={{ flex: 1, paddingRight: 52 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              aria-pressed={showPassword}
              title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                width: 48,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                background: 'transparent',
                color: showPassword ? 'var(--color-primary)' : 'var(--color-text-muted)',
                cursor: 'pointer',
              }}
            >
              {showPassword ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M3 3l18 18M10.6 5.1A10.7 10.7 0 0 1 12 5c5 0 8.6 4.1 9.8 6.2a1.7 1.7 0 0 1 0 1.6 17 17 0 0 1-3.3 3.9M6.5 6.6A16.6 16.6 0 0 0 2.2 11.2a1.7 1.7 0 0 0 0 1.6C3.4 14.9 7 19 12 19c1.6 0 3-.4 4.3-1M9.9 9.9a3 3 0 0 0 4.2 4.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M2.2 12.8a1.7 1.7 0 0 1 0-1.6C3.4 9.1 7 5 12 5s8.6 4.1 9.8 6.2a1.7 1.7 0 0 1 0 1.6C20.6 14.9 17 19 12 19S3.4 14.9 2.2 12.8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
