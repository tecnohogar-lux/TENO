// Selector "Vista completa / Vista compacta" de las listas (Retiro en Tienda, Delivery Santiago).
export default function VistaToggle({ compacta, onChange }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }} role="group" aria-label="Vista de la lista">
      {[{ key: false, label: 'Vista completa' }, { key: true, label: 'Vista compacta' }].map((v, i) => (
        <button
          key={v.label}
          type="button"
          aria-pressed={compacta === v.key}
          onClick={() => onChange(v.key)}
          className="btn"
          style={{
            padding: '6px 14px',
            fontSize: 13,
            borderRadius: i === 0 ? '8px 0 0 8px' : '0 8px 8px 0',
            border: '1px solid var(--color-accent)',
            marginLeft: i === 0 ? 0 : -1,
            background: compacta === v.key ? 'var(--color-accent)' : 'var(--color-surface)',
            color: compacta === v.key ? '#fff' : 'var(--color-accent)',
            fontWeight: 600,
          }}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
