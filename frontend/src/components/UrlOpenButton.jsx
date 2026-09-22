export default function UrlOpenButton({ url, title = 'Abrir enlace en una pestaña nueva' }) {
  return (
    <button
      type="button"
      className="btn btn-secondary"
      style={{ padding: '0 12px', flexShrink: 0 }}
      disabled={!url}
      title={title}
      onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
    >
      Abrir
    </button>
  );
}
