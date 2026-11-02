import { Link } from 'react-router-dom';
import useFetch from '../hooks/useFetch';
import useIsMobile, { useNoticiasPageSize } from '../hooks/useIsMobile';
import NoticiasGrid from './NoticiasGrid';

// Noticias del Dashboard: la primera pantalla (3 en teléfono, en filas compactas; 10 en computador) y un
// "Ver más" que lleva a la página de Noticias.
export default function NoticiasFeed() {
  const movil = useIsMobile();
  const pageSizeEscritorio = useNoticiasPageSize();
  const pageSize = movil ? 3 : pageSizeEscritorio;
  const { data, loading } = useFetch(`/api/noticias?limit=${pageSize}`, { deps: [pageSize] });

  if (loading && !data) return null;
  if (!data || data.noticias.length === 0) return null;

  return (
    <div className="card dash-noticias">
      <h3 className="dash-seccion__titulo">Noticias</h3>
      <NoticiasGrid noticias={data.noticias.slice(0, pageSize)} compacto={movil} />
      {data.total > pageSize && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Link to="/noticias" className="btn btn-secondary">Ver más</Link>
        </div>
      )}
    </div>
  );
}
