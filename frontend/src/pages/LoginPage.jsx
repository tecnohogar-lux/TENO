import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { defaultRouteFor } from '../utils/routes';

export default function LoginPage() {
  const { login, loading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

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

        {error && <div className="alert alert-error">{error}</div>}

        <div className="form-field">
          <label htmlFor="email">Correo electrónico</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@teno.com"
            required
            autoFocus
          />
        </div>

        <div className="form-field">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••"
            required
          />
        </div>

        <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
