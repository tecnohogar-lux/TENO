import { useState } from 'react';
import useFetch from '../../hooks/useFetch';
import useApi from '../../hooks/useApi';
import useConfirm from '../../hooks/useConfirm';
import Badge from '../Badge';
import AbonoModal from './AbonoModal';
import { formatCurrency, formatDate } from '../../utils/format';
import { TIPO_CUENTA, ESTADO_CUENTA, fechaCorta, rangoPeriodo } from '../../utils/pagos';

function Dato({ label, children }) {
  if (!children) return null;
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, overflowWrap: 'anywhere' }}>{children}</div>
    </div>
  );
}

// Todo el detalle de una cuenta: datos, avance y el historial de pagos (con corrección).
export default function CuentaDetalleModal({ cuentaId, onClose, onChanged, onEditar }) {
  const { data, loading, error, refetch } = useFetch(`/api/recepcion-pagos/cuentas/${cuentaId}`, { deps: [cuentaId] });
  const { post, del, loading: saving, error: actionError } = useApi();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [abonando, setAbonando] = useState(false);
  const [editandoAbono, setEditandoAbono] = useState(null);

  const cuenta = data?.cuenta;
  const abonos = data?.abonos || [];
  const tipo = cuenta ? TIPO_CUENTA[cuenta.tipo] : null;

  function cambio() {
    refetch();
    onChanged?.();
  }

  async function eliminarAbono(a) {
    const ok = await confirm(`¿Eliminar el pago de ${formatCurrency(a.monto)} del ${fechaCorta(a.fecha_pago)}? Ese monto volverá al saldo pendiente.`, {
      title: 'Eliminar pago', confirmLabel: 'Eliminar', danger: true,
    });
    if (!ok) return;
    const result = await del(`/api/recepcion-pagos/abonos/${a.id}`);
    if (result.success) cambio();
  }

  async function anularOReactivar() {
    const anular = !cuenta.anulada_at;
    const ok = await confirm(
      anular
        ? 'Al anular la cuenta deja de contar en los totales, pero queda registrada y se puede reactivar. ¿Anularla?'
        : '¿Reactivar esta cuenta? Volverá a contar en los totales.',
      { title: anular ? 'Anular cuenta' : 'Reactivar cuenta', confirmLabel: anular ? 'Anular' : 'Reactivar', danger: anular }
    );
    if (!ok) return;
    const result = await post(`/api/recepcion-pagos/cuentas/${cuenta.id}/${anular ? 'anular' : 'reactivar'}`);
    if (result.success) cambio();
  }

  const total = cuenta ? Number(cuenta.monto_total) : 0;
  const pagado = cuenta ? Number(cuenta.pagado) : 0;
  const pct = total > 0 ? Math.min(100, Math.round((pagado / total) * 100)) : 0;
  const puedeAbonar = cuenta && !cuenta.anulada_at && cuenta.estado !== 'pagada';

  return (
    <div className="modal-overlay">
      <div className="modal-panel" style={{ width: 640, maxWidth: '96vw', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            {cuenta && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                <Badge label={tipo.label} color={tipo.color} />
                <Badge label={ESTADO_CUENTA[cuenta.estado].label} color={ESTADO_CUENTA[cuenta.estado].color} />
                {cuenta.vencida && <Badge label="Vencida" color="#b3423a" />}
              </div>
            )}
            <h3 style={{ margin: 0, fontSize: 18, overflowWrap: 'anywhere' }}>{cuenta ? cuenta.contraparte_nombre : 'Cuenta'}</h3>
            {cuenta && <div style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 2, overflowWrap: 'anywhere' }}>{cuenta.concepto}</div>}
          </div>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        </div>

        {loading && !data && <div className="page-loading"><div className="spinner" /></div>}
        {error && <div className="alert alert-error">{error}</div>}
        {actionError && <div className="alert alert-error" style={{ marginTop: 12 }}>{actionError}</div>}

        {cuenta && (
          <>
            <div className="card" style={{ padding: 16, margin: '16px 0', background: 'var(--color-bg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Saldo pendiente</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: cuenta.estado === 'pagada' ? 'var(--color-success)' : tipo.color }}>{formatCurrency(cuenta.saldo)}</div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 13, lineHeight: 1.6 }}>
                  <div>Total: <strong>{formatCurrency(total)}</strong></div>
                  <div>Pagado: <strong>{formatCurrency(pagado)}</strong></div>
                </div>
              </div>
              <div className="pago-barra" style={{ marginTop: 10 }} aria-label={`${pct}% pagado`}>
                <div className="pago-barra__relleno" style={{ width: `${pct}%`, background: tipo.color }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 16 }}>
              <Dato label="Fecha de la cuenta">{fechaCorta(cuenta.fecha_emision)}</Dato>
              <Dato label="Vence">{fechaCorta(cuenta.fecha_vencimiento)}</Dato>
              <Dato label="Período que cubre">{rangoPeriodo(cuenta.periodo_desde, cuenta.periodo_hasta)}</Dato>
              <Dato label="Registrada por">{cuenta.creada_por}</Dato>
              <Dato label="Notas">{cuenta.notas}</Dato>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              {puedeAbonar && (
                <button type="button" className="btn btn-primary" onClick={() => setAbonando(true)}>
                  {cuenta.tipo === 'por_pagar' ? 'Registrar pago' : 'Registrar pago recibido'}
                </button>
              )}
              {!cuenta.anulada_at && <button type="button" className="btn btn-secondary" onClick={() => onEditar(cuenta)}>Editar cuenta</button>}
              <button
                type="button"
                className="btn btn-secondary"
                disabled={saving}
                onClick={anularOReactivar}
                style={cuenta.anulada_at ? undefined : { color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
              >
                {cuenta.anulada_at ? 'Reactivar' : 'Anular'}
              </button>
            </div>

            <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>Pagos registrados ({abonos.length})</h4>
            {abonos.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)', padding: '8px 0' }}>Todavía no hay pagos registrados.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="responsive-stack">
                  <thead>
                    <tr><th>Fecha</th><th>Monto</th><th>Motivo</th><th>Período</th><th>Registró</th><th /></tr>
                  </thead>
                  <tbody>
                    {abonos.map((a) => (
                      <tr key={a.id}>
                        <td data-label="Fecha" style={{ whiteSpace: 'nowrap' }}>{fechaCorta(a.fecha_pago)}</td>
                        <td data-label="Monto" style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{formatCurrency(a.monto)}</td>
                        <td data-label="Motivo">{a.motivo || '-'}{a.notas && <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{a.notas}</div>}</td>
                        <td data-label="Período" style={{ fontSize: 12 }}>{rangoPeriodo(a.periodo_desde, a.periodo_hasta) || '-'}</td>
                        <td data-label="Registró" style={{ fontSize: 12 }}>{a.registrado_por || '-'}<div style={{ color: 'var(--color-text-muted)' }}>{formatDate(a.created_at)}</div></td>
                        <td>
                          {!cuenta.anulada_at && (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button type="button" className="btn btn-secondary" style={{ padding: '3px 8px', fontSize: 12 }} onClick={() => setEditandoAbono(a)}>Corregir</button>
                              <button type="button" className="btn btn-secondary" style={{ padding: '3px 8px', fontSize: 12, color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={() => eliminarAbono(a)}>Eliminar</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {cuenta && abonando && (
        <AbonoModal cuenta={cuenta} onClose={() => setAbonando(false)} onSaved={() => { setAbonando(false); cambio(); }} />
      )}
      {cuenta && editandoAbono && (
        <AbonoModal cuenta={cuenta} abono={editandoAbono} onClose={() => setEditandoAbono(null)} onSaved={() => { setEditandoAbono(null); cambio(); }} />
      )}
      {confirmDialog}
    </div>
  );
}
