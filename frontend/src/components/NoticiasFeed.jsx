import { Link } from 'react-router-dom';
import useFetch from '../hooks/useFetch';
import { formatDate } from '../utils/format';

export default function NoticiasFeed() {
  const { data, loading } = useFetch('/api/noticias?limit=10');

  if (loading || !data || data.noticias.length === 0) return null;

  return (
    <div className="card" style={{ padding: 20, marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>Noticias</h3>
        <Link to="/noticias" style={{ fontSize: 13, color: 'var(--color-accent)', fontWeight: 600 }}>Ver más</Link>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data.noticias.slice(0, 10).map((n) => (
          <div
            key={n.id}
            style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, borderBottom: '1px solid var(--color-border)', paddingBottom: 8 }}
          >
            <span>{n.texto}</span>
            <span style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{formatDate(n.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
