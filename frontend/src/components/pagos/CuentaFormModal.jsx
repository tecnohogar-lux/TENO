import { useState } from 'react';
import useApi from '../../hooks/useApi';
import ContraparteSelect from './ContraparteSelect';
import { TIPO_CUENTA, hoyISO } from '../../utils/pagos';

// Crear o editar una cuenta (deuda). Lo básico va a la vista; el resto (período, notas) queda
// en "más opciones" para no llenar el formulario.
export default function CuentaFormModal({ cuenta, contrapartes, onContraparteCreada, tipoInicial = 'por_pagar', onClose, onSaved }) {
  const editando = !!cuenta;
  const { post, put, loading, error } = useApi();
  const [form, setForm] = useState({
    tipo: cuenta?.tipo || tipoInicial,
    contraparte_id: cuenta ? String(cuenta.contraparte_id) : '',
    concepto: cuenta?.concepto || '',
    monto_total: cuenta ? String(Number(cuenta.monto_total)) : '',
    fecha_emision: cuenta?.fecha_emision || hoyISO(),
    fecha_vencimiento: cuenta?.fecha_vencimiento || '',
    periodo_desde: cuenta?.periodo_desde || '',
    periodo_hasta: cuenta?.periodo_hasta || '',
    notas: cuenta?.notas || '',
  });
  const [masOpciones, setMasOpciones] = useState(!!(cuenta?.periodo_desde || cuenta?.notas));
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const bloqueaTipo = editando && Number(cuenta.cantidad_abonos) > 0;

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = {
      tipo: form.tipo,
      contraparte_id: Number(form.contraparte_id),
      concepto: form.concepto,
      monto_total: Number(form.monto_total),
      fecha_emision: form.fecha_emision || null,
      fecha_vencimiento: form.fecha_vencimiento || null,
      periodo_desde: form.periodo_desde || null,
      periodo_hasta: form.periodo_hasta || null,
      notas: form.notas,
    };
    const result = editando
      ? await put(`/api/recepcion-pagos/cuentas/${cuenta.id}`, payload)
      : await post('/api/recepcion-pagos/cuentas', payload);
    if (result.success) onSaved(result.data.cuenta);
  }

  return (
    <div className="modal-overlay">
      <form className="modal-panel" style={{ width: 520, maxWidth: '95vw', maxHeight: '92vh', overflowY: 'auto' }} onSubmit={handleSubmit}>
        <h3 style={{ margin: '0 0 14px', fontSize: 17 }}>{editando ? 'Editar cuenta' : 'Nueva cuenta'}</h3>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="form-field">
          <label>¿Qué tipo de cuenta es?</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {Object.entries(TIPO_CUENTA).map(([key, t]) => {
              const activo = form.tipo === key;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={bloqueaTipo && !activo}
                  onClick={() => set({ tipo: key })}
                  aria-pressed={activo}
                  className="btn"
                  style={{
                    flex: 1,
                    border: `2px solid ${t.color}`,
                    background: activo ? t.color : 'var(--color-surface)',
                    color: activo ? '#fff' : t.color,
                    fontWeight: 700,
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>
            {form.tipo === 'por_pagar' ? 'Una deuda de TecnoHogar: nosotros tenemos que pagar.' : 'Una deuda con TecnoHogar: nos tienen que pagar.'}
            {bloqueaTipo && ' No se puede cambiar el tipo porque ya tiene pagos.'}
          </div>
        </div>

        <div className="form-field">
          <label>{form.tipo === 'por_pagar' ? '¿A quién le debemos?' : '¿Quién nos debe?'}</label>
          <ContraparteSelect
            contrapartes={contrapartes}
            value={form.contraparte_id}
            onChange={(v) => set({ contraparte_id: v })}
            onCreated={onContraparteCreada}
          />
        </div>

        <div className="form-field">
          <label>Motivo o concepto</label>
          <input value={form.concepto} maxLength={255} onChange={(e) => set({ concepto: e.target.value })} placeholder="Ej: Sueldo chofer septiembre" required />
        </div>

        <div className="form-grid-2" style={{ gap: 12 }}>
          <div className="form-field">
            <label>Monto total</label>
            <input type="number" min="1" step="any" value={form.monto_total} onChange={(e) => set({ monto_total: e.target.value })} required />
          </div>
          <div className="form-field">
            <label>Vence (opcional)</label>
            <input type="date" value={form.fecha_vencimiento} min={form.fecha_emision || undefined} onChange={(e) => set({ fecha_vencimiento: e.target.value })} />
          </div>
        </div>

        <button type="button" className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 10px', marginBottom: 12 }} onClick={() => setMasOpciones((v) => !v)}>
          {masOpciones ? '− Menos opciones' : '+ Más opciones (período, fecha, notas)'}
        </button>

        {masOpciones && (
          <div className="card" style={{ padding: 12, background: 'var(--color-bg)', marginBottom: 12 }}>
            <div className="form-field">
              <label>Fecha de la cuenta</label>
              <input type="date" value={form.fecha_emision} onChange={(e) => set({ fecha_emision: e.target.value })} />
            </div>
            <div className="form-field" style={{ marginBottom: 8 }}>
              <label>Período que cubre (opcional)</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="date" value={form.periodo_desde} onChange={(e) => set({ periodo_desde: e.target.value })} style={{ flex: 1, minWidth: 0 }} />
                <span style={{ fontSize: 12 }}>al</span>
                <input type="date" value={form.periodo_hasta} min={form.periodo_desde || undefined} onChange={(e) => set({ periodo_hasta: e.target.value })} style={{ flex: 1, minWidth: 0 }} />
              </div>
            </div>
            <div className="form-field" style={{ marginBottom: 0 }}>
              <label>Notas</label>
              <textarea rows={2} value={form.notas} maxLength={2000} onChange={(e) => set({ notas: e.target.value })} />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
            {loading ? 'Guardando...' : (editando ? 'Guardar cambios' : 'Crear cuenta')}
          </button>
          <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
        </div>
      </form>
    </div>
  );
}
