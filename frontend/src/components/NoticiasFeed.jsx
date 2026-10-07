import { Link } from 'react-router-dom';
import useFetch from '../hooks/useFetch';
import { useNoticiasPageSize } from '../hooks/useIsMobile';
import NoticiasGrid from './NoticiasGrid';

// Noticias del Dashboard: la primera pantalla (8 en teléfono, 10 en computador) y un
// "Ver más" que lleva a la página de Noticias.
export default function NoticiasFeed() {
  const pageSize = useNoticiasPageSize();
  const { data, loading } = useFetch(`/api/noticias?limit=${pageSize}`, { deps: [pageSize] });

  if (loading && !data) return null;
  if (!data || data.noticias.length === 0) return null;

  return (
    <div className="card" style={{ padding: 20, marginBottom: 24 }}>
      <h3 style={{ margin: '0 0 14px', fontSize: 15 }}>Noticias</h3>
      <NoticiasGrid noticias={data.noticias.slice(0, pageSize)} />
      {data.total > pageSize && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Link to="/noticias" className="btn btn-secondary">Ver más</Link>
        </div>
      )}
    </div>
  );
}
