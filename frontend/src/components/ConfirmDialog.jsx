export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirmar', danger, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-panel" style={{ width: 380 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>{title || 'Confirmar'}</h3>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--color-text-muted)' }}>{message}</p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onCancel}>Cancelar</button>
          <button
            className="btn btn-primary"
            style={{ flex: 1, background: danger ? 'var(--color-danger)' : undefined, boxShadow: 'none' }}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
