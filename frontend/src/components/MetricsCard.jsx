export default function MetricsCard({ label, value, subtext }) {
  return (
    <div className="card" style={{ padding: 20, flex: '1 1 200px', minWidth: 180 }}>
      <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--color-text)' }}>{value}</div>
      {subtext && (
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>{subtext}</div>
      )}
    </div>
  );
}
