import { formatCurrency } from '../utils/format';

export default function SalesTrendChart({ data }) {
  if (!data || data.length === 0) return null;

  const max = Math.max(...data.map((d) => d.total), 1);
  const width = 700;
  const height = 160;
  const barGap = 6;
  const barWidth = width / data.length - barGap;

  return (
    <div className="card" style={{ padding: 20, marginBottom: 32 }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>Ventas de los últimos 14 días</h3>
      <svg viewBox={`0 0 ${width} ${height + 24}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {data.map((d, i) => {
          const barHeight = (d.total / max) * height;
          const x = i * (barWidth + barGap);
          const y = height - barHeight;
          const dayLabel = new Date(d.fecha + 'T00:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
          return (
            <g key={d.fecha}>
              <title>{`${dayLabel}: ${formatCurrency(d.total)}`}</title>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, 1)}
                rx={3}
                fill="var(--color-accent)"
                opacity={d.total > 0 ? 1 : 0.15}
              />
              <text
                x={x + barWidth / 2}
                y={height + 16}
                textAnchor="middle"
                fontSize="9"
                fill="var(--color-text-muted)"
              >
                {dayLabel}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
