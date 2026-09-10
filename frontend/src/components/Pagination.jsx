export default function Pagination({ page, totalPages, total, onPageChange }) {
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
      <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
        Página {page} de {totalPages} · {total} resultado(s)
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Anterior
        </button>
        <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Siguiente
        </button>
      </div>
    </div>
  );
}
