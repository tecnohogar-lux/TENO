import Layout from '../components/Layout';

export default function ReportsPage() {
  return (
    <Layout>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Reportes</h1>
      <p style={{ color: 'var(--color-text-muted)', marginTop: 0, marginBottom: 28 }}>
        Este módulo está en construcción.
      </p>
      <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
        Próximamente: reportes de ventas, comisiones y desempeño.
      </div>
    </Layout>
  );
}
