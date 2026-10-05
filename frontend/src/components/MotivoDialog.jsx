import { useEffect, useState } from 'react';

// Pide el motivo al cancelar o reprogramar un envío. El motivo es obligatorio y
// luego lo ve el vendedor en su módulo Delivery Santiago.
export const MOTIVO_MAX = 500;

export default function MotivoDialog({ open, status, count = 1, saving, error, onConfirm, onCancel }) {
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    if (open) setMotivo('');
  }, [open, status]);

  if (!open) return null;

  const accion = status === 'cancelado' ? 'cancelación' : 'reprogramación';
  const verbo = status === 'cancelado' ? 'cancelar' : 'reprogramar';
  const listo = motivo.trim().length > 0;

  function handleSubmit(e) {
    e.preventDefault();
    if (listo) onConfirm(motivo.trim());
  }

  return (
    <div className="modal-overlay">
      <form className="modal-panel" style={{ width: 420 }} onSubmit={handleSubmit}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>
          Motivo de la {accion}
        </h3>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--color-text-muted)' }}>
          Vas a {verbo} {count === 1 ? 'este envío' : `${count} envíos`}. Explica el motivo: el vendedor lo verá en su módulo Delivery Santiago.
        </p>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-field">
          <label>Motivo</label>
          <textarea
            rows={4}
            autoFocus
            required
            maxLength={MOTIVO_MAX}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder={status === 'cancelado' ? 'Ej: el cliente no contestó el teléfono' : 'Ej: el cliente pidió recibirlo el viernes'}
          />
          <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--color-text-muted)' }}>{motivo.length}/{MOTIVO_MAX}</div>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onCancel} disabled={saving}>
            Volver
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ flex: 1, background: status === 'cancelado' ? 'var(--color-danger)' : undefined, boxShadow: 'none' }}
            disabled={!listo || saving}
          >
            {saving ? 'Guardando...' : status === 'cancelado' ? 'Cancelar envío' : 'Reprogramar envío'}
          </button>
        </div>
      </form>
    </div>
  );
}
