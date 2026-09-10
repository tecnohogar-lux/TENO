export default function MetricsCard({ label, value, subtext }) {
  return (
    <div
      className="card"
      style={{
        padding: '18px 20px',
        flex: '1 1 200px',
        minWidth: 180,
        position: 'relative',
        overflow: 'hidden',
        borderLeft: '4px solid var(--color-accent)',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)', marginBottom: 10 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.01em' }}>{value}</div>
      {subtext && (
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>{subtext}</div>
      )}
    </div>
  );
}
