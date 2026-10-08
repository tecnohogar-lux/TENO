import { useState } from 'react';
import useApi from '../../hooks/useApi';
import { formatCurrency } from '../../utils/format';
import { TIPO_CUENTA, hoyISO } from '../../utils/pagos';

// Registrar un pago (abono) contra una cuenta, o corregir uno ya registrado (si viene `abono`).
export default function AbonoModal({ cuenta, abono, onClose, onSaved }) {
  const editando = !!abono;
  const { post, put, loading, error } = useApi();
  const tipo = TIPO_CUENTA[cuenta.tipo];
  // Al corregir un pago, el saldo disponible incluye lo que ese mismo pago ya había abonado.
  const saldoDisponible = Number(cuenta.saldo) + (editando ? Number(abono.monto) : 0);
  const [form, setForm] = useState({
    monto: abono ? String(Number(abono.monto)) : '',
    fecha_pago: abono?.fecha_pago || hoyISO(),
    motivo: abono?.motivo || '',
    periodo_desde: abono?.periodo_desde || '',
    periodo_hasta: abono?.periodo_hasta || '',
    notas: abono?.notas || '',
  });
  const [conPeriodo, setConPeriodo] = useState(!!abono?.periodo_desde);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const montoNum = Number(form.monto) || 0;
  const restante = saldoDisponible - montoNum;
  const excede = montoNum > saldoDisponible + 0.005;

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = {
      monto: Number(form.monto),
      fecha_pago: form.fecha_pago || null,
      motivo: form.motivo,
      periodo_desde: conPeriodo ? form.periodo_desde || null : null,
      periodo_hasta: conPeriodo ? form.periodo_hasta || null : null,
      notas: form.notas,
    };
    const result = editando
      ? await put(`/api/recepcion-pagos/abonos/${abono.id}`, payload)
      : await post(`/api/recepcion-pagos/cuentas/${cuenta.id}/abonos`, payload);
    if (result.success) onSaved(result.data);
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <form className="modal-panel" style={{ width: 460, maxWidth: '95vw', maxHeight: '92vh', overflowY: 'auto' }} onSubmit={handleSubmit}>
        <h3 style={{ margin: '0 0 4px', fontSize: 17 }}>{editando ? 'Corregir pago' : (cuenta.tipo === 'por_pagar' ? 'Registrar pago' : 'Registrar pago recibido')}</h3>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 14 }}>
          <strong style={{ color: tipo.color }}>{tipo.corto}</strong> · {cuenta.contraparte_nombre} · {cuenta.concepto}
        </div>

        <div className="card" style={{ padding: 12, background: 'var(--color-bg)', marginBottom: 14, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <span>Saldo pendiente</span>
          <strong style={{ fontSize: 16 }}>{formatCurrency(saldoDisponible)}</strong>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="form-field">
          <label>Monto del pago</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="number" min="1" step="any" autoFocus value={form.monto} onChange={(e) => set({ monto: e.target.value })} required style={{ flex: 1, minWidth: 0 }} />
            <button type="button" className="btn btn-secondary" onClick={() => set({ monto: String(saldoDisponible) })}>Pagar todo</button>
          </div>
          <div style={{ fontSize: 12, marginTop: 6, color: excede ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
            {montoNum <= 0
              ? 'Escribe el monto que se pagó.'
              : excede
                ? `Supera el saldo pendiente en ${formatCurrency(montoNum - saldoDisponible)}.`
                : (restante <= 0.005 ? 'Con este pago la cuenta queda pagada por completo.' : `Después de este pago quedará un saldo de ${formatCurrency(restante)}.`)}
          </div>
        </div>

        <div className="form-grid-2" style={{ gap: 12 }}>
          <div className="form-field">
            <label>Fecha del pago</label>
            <input type="date" value={form.fecha_pago} onChange={(e) => set({ fecha_pago: e.target.value })} required />
          </div>
          <div className="form-field">
            <label>Motivo del pago</label>
            <input value={form.motivo} maxLength={255} onChange={(e) => set({ motivo: e.target.value })} placeholder="Ej: Primera quincena" />
          </div>
        </div>

        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 10 }}>
          <input type="checkbox" checked={conPeriodo} onChange={(e) => setConPeriodo(e.target.checked)} />
          Indicar el período que cubre este pago
        </label>
        {conPeriodo && (
          <div className="form-field">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="date" value={form.periodo_desde} onChange={(e) => set({ periodo_desde: e.target.value })} required style={{ flex: 1, minWidth: 0 }} />
              <span style={{ fontSize: 12 }}>al</span>
              <input type="date" value={form.periodo_hasta} min={form.periodo_desde || undefined} onChange={(e) => set({ periodo_hasta: e.target.value })} required style={{ flex: 1, minWidth: 0 }} />
            </div>
          </div>
        )}

        <div className="form-field">
          <label>Notas (opcional)</label>
          <textarea rows={2} value={form.notas} maxLength={2000} onChange={(e) => set({ notas: e.target.value })} />
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading || excede || montoNum <= 0}>
            {loading ? 'Guardando...' : (editando ? 'Guardar corrección' : 'Registrar')}
          </button>
          <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
        </div>
      </form>
    </div>
  );
}
