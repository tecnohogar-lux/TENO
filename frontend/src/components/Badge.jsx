export default function Badge({ label, color }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 500,
        color: '#fff',
        background: color || 'var(--color-text-muted)',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}
