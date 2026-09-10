import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import useFetch from '../hooks/useFetch';
import useApi from '../hooks/useApi';
import { applyTheme } from '../utils/theme';

const THEMES = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
];

export default function PreferencesPage() {
  const { data, loading, error, refetch } = useFetch('/api/preferences');
  const { put, loading: saving, error: saveError } = useApi();

  const { data: me, refetch: refetchMe } = useFetch('/api/users/me');
  const { put: putMe, loading: savingMe, error: saveMeError } = useApi();
  const [marketplaceAccounts, setMarketplaceAccounts] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (me) setMarketplaceAccounts(me.marketplace_accounts || '');
  }, [me]);

  async function handleThemeChange(theme) {
    applyTheme(theme);
    const result = await put('/api/preferences/theme', { theme });
    if (result.success) refetch();
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    setSaved(false);
    const result = await putMe('/api/users/me', { marketplace_accounts: marketplaceAccounts });
    if (result.success) {
      refetchMe();
      setSaved(true);
    }
  }

  return (
    <Layout>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Preferencias</h1>
      <p style={{ color: 'var(--color-text-muted)', marginTop: 0, marginBottom: 28 }}>
        Personaliza la apariencia de tu cuenta
      </p>

      {loading && (
        <div className="page-loading">
          <div className="spinner" />
        </div>
      )}
      {(error || saveError) && <div className="alert alert-error">{error || saveError}</div>}

      {data && (
        <div className="card" style={{ padding: 20, maxWidth: 480, marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>Tema</h3>
          <div style={{ display: 'flex', gap: 12 }}>
            {THEMES.map((t) => (
              <button
                key={t.value}
                className={data.theme === t.value ? 'btn btn-primary' : 'btn btn-secondary'}
                onClick={() => handleThemeChange(t.value)}
                disabled={saving}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {me && (
        <div className="card" style={{ padding: 20, maxWidth: 480 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>Cuentas de Marketplace</h3>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 0, marginBottom: 16, fontSize: 13 }}>
            Registra los nombres de tus cuentas en los distintos marketplaces (ej: MercadoLibre, Falabella).
          </p>
          <form onSubmit={handleSaveProfile}>
            <textarea
              value={marketplaceAccounts}
              onChange={(e) => setMarketplaceAccounts(e.target.value)}
              placeholder="Ej: MercadoLibre - tienda123, Falabella - miNegocio"
              rows={3}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 6,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                fontFamily: 'inherit',
                fontSize: 14,
                resize: 'vertical',
                marginBottom: 12,
              }}
            />
            {saveMeError && <div className="alert alert-error" style={{ marginBottom: 12 }}>{saveMeError}</div>}
            {saved && !saveMeError && (
              <div style={{ color: 'var(--color-success)', fontSize: 13, marginBottom: 12 }}>Guardado correctamente</div>
            )}
            <button type="submit" className="btn btn-primary" disabled={savingMe}>
              Guardar
            </button>
          </form>
        </div>
      )}
    </Layout>
  );
}
