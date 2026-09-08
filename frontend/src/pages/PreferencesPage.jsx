import Layout from '../components/Layout';
import useFetch from '../hooks/useFetch';
import useApi from '../hooks/useApi';

const THEMES = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
  { value: 'coral', label: 'Coral' },
];

export default function PreferencesPage() {
  const { data, loading, error, refetch } = useFetch('/api/preferences');
  const { put, loading: saving, error: saveError } = useApi();

  async function handleThemeChange(theme) {
    const result = await put('/api/preferences/theme', { theme });
    if (result.success) refetch();
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
        <div className="card" style={{ padding: 20, maxWidth: 480 }}>
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
    </Layout>
  );
}
