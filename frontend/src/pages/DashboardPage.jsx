import Layout from '../components/Layout';
import Dashboard from '../components/Dashboard';
import useFetch from '../hooks/useFetch';
import useAuth from '../hooks/useAuth';

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, loading, error } = useFetch('/api/dashboard');
  const { data: comparison } = useFetch('/api/dashboard/comparison');

  return (
    <Layout>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Hola, {user?.name}</h1>
      <p style={{ color: 'var(--color-text-muted)', marginTop: 0, marginBottom: 28 }}>
        Resumen de tu actividad
      </p>

      {loading && (
        <div className="page-loading">
          <div className="spinner" />
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {data && <Dashboard data={data} comparison={comparison} />}
    </Layout>
  );
}
