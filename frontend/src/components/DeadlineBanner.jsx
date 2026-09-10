import { useEffect, useState } from 'react';
import useFetch from '../hooks/useFetch';

function getRemaining(horaLimite) {
  if (!horaLimite) return null;
  const [h, m] = horaLimite.split(':').map(Number);
  const now = new Date();
  const deadline = new Date();
  deadline.setHours(h, m, 0, 0);

  const diffMs = deadline.getTime() - now.getTime();
  if (diffMs <= 0) return { closed: true };

  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return { closed: false, hours, minutes };
}

export default function DeadlineBanner() {
  const { data } = useFetch('/api/settings');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  if (!data?.envio_deadline_hora) return null;

  const remaining = getRemaining(data.envio_deadline_hora);
  if (!remaining) return null;

  return (
    <div
      className="card"
      style={{
        padding: '14px 20px',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderLeft: `4px solid ${remaining.closed ? 'var(--color-danger)' : 'var(--color-warning)'}`,
        flexWrap: 'wrap',
        gap: 8,
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
        Hora límite de envíos: {data.envio_deadline_hora}
      </span>
      <span style={{ fontSize: 14, fontWeight: 700, color: remaining.closed ? 'var(--color-danger)' : 'var(--color-text)' }}>
        {remaining.closed
          ? 'Envíos cerrados por hoy'
          : `Quedan ${remaining.hours}h ${remaining.minutes}m para el último envío del día`}
      </span>
    </div>
  );
}
