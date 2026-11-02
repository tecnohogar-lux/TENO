// Tarjeta de métrica del Dashboard. Los estilos están en globals.css (.metric-card) para compactarla en teléfono.
// `ancho`: en teléfono ocupa las dos columnas y va primero (para métricas con texto largo).
// `fila`: en teléfono ocupa las dos columnas en su lugar (para no dejar un hueco cuando queda una tarjeta sola).
export default function MetricsCard({ label, value, subtext, ancho = false, fila = false }) {
  return (
    <div className={`card metric-card${ancho ? ' metric-card--ancho' : ''}${fila ? ' metric-card--fila' : ''}`}>
      <div className="metric-card__label">{label}</div>
      <div className="metric-card__value">{value}</div>
      {subtext && <div className="metric-card__sub">{subtext}</div>}
    </div>
  );
}
