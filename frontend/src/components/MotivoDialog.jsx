import { useEffect, useState } from 'react';
import { hoyChileYmd, sumarDiasYmd } from '../utils/fechas';

// Pide el motivo al cancelar o reprogramar un envío. El motivo es obligatorio y
// luego lo ve el vendedor en su módulo Delivery Santiago. Al reprogramar también pide la fecha: ese día el
// envío vuelve solo a "impreso" para ponerlo en camino de nuevo.
export const MOTIVO_MAX = 500;

// Al cancelar también se pregunta si el paquete salió o no a despacho (va antes del motivo).
export const DESPACHO_OPCIONES = [
  { value: 'salio', label: 'Salió a despacho' },
  { value: 'no_salio', label: 'No salió a despacho' },
];

export default function MotivoDialog({ open, status, count = 1, saving, error, onConfirm, onCancel }) {
  const [motivo, setMotivo] = useState('');
  const [fecha, setFecha] = useState('');
  const [despacho, setDespacho] = useState('');
  const hoy = hoyChileYmd();

  useEffect(() => {
    if (open) { setMotivo(''); setDespacho(''); setFecha(sumarDiasYmd(hoyChileYmd(), 1)); }
  }, [open, status]);

  if (!open) return null;

  const accion = status === 'cancelado' ? 'cancelación' : 'reprogramación';
  const verbo = status === 'cancelado' ? 'cancelar' : 'reprogramar';
  const reprograma = status === 'reprogramado';
  const cancela = status === 'cancelado';
  const listo = motivo.trim().length > 0 && (!reprograma || (fecha && fecha >= hoy)) && (!cancela || despacho);

  function handleSubmit(e) {
    e.preventDefault();
    if (listo) onConfirm(motivo.trim(), reprograma ? fecha : undefined, cancela ? despacho : undefined);
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
        {reprograma && (
          <div className="form-field">
            <label>¿Para qué fecha se reprograma?</label>
            <input type="date" required min={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} />
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
              Ese día el envío vuelve solo a "Impreso" para poder ponerlo en camino otra vez, con la marca Delivery Reprogramado.
            </div>
          </div>
        )}
        {cancela && (
          <div className="form-field">
            <label>Motivo de cancelación</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {DESPACHO_OPCIONES.map((o) => (
                <label key={o.value} style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="despacho"
                    value={o.value}
                    checked={despacho === o.value}
                    onChange={() => setDespacho(o.value)}
                    required
                    style={{ width: 18, height: 18 }}
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="form-field">
          <label>Motivo</label>
          <textarea
            rows={4}
            autoFocus={!cancela}
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
