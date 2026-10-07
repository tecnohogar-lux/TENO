import { useEffect, useState } from 'react';
import MetricsCard from './MetricsCard';
import Badge from './Badge';
import useFetch from '../hooks/useFetch';
import useApi from '../hooks/useApi';
import useConfirm from '../hooks/useConfirm';
import { formatCurrency, formatDate } from '../utils/format';
import {
  PAYMENT_METHODS, paymentMethodLabel, paymentBreakdownLines, tipoVentaLabel, saleStatusLabel,
  deliveryStatusLabel, TIPO_VENTA_LABELS,
} from '../utils/labels';

const sectionTitle = { margin: '24px 0 10px', fontSize: 15 };

// ---------- Corregir la forma de pago de una venta ----------
function PagoModal({ sale, onClose, onSaved }) {
  const { put, loading, error } = useApi();
  const esMixto = sale.payment_method === 'mixto';
  const [method, setMethod] = useState(sale.payment_method || 'efectivo');
  const [verificada, setVerificada] = useState(!!sale.transferencia_verificada);
  const [legs, setLegs] = useState(
    esMixto
      ? paymentBreakdownLines(sale).map((l) => ({ method: l.method, amount: String(l.amount), transferencia_verificada: !!l.transferencia_verificada }))
      : [{ method: 'efectivo', amount: '', transferencia_verificada: false }, { method: 'debito', amount: '', transferencia_verificada: false }]
  );

  const total = Number(sale.total);
  const suma = legs.reduce((acc, l) => acc + (Number(l.amount) || 0), 0);
  const restante = total - suma;

  function setLeg(i, patch) {
    setLegs((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = method === 'mixto'
      ? { payment_method: 'mixto', payment_breakdown: legs.map((l) => ({ method: l.method, amount: Number(l.amount), transferencia_verificada: !!l.transferencia_verificada })) }
      : { payment_method: method, transferencia_verificada: verificada };
    const result = await put(`/api/sales/${sale.id}/payment`, payload);
    if (result.success) onSaved();
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <form className="modal-panel" style={{ width: 460, maxHeight: '88vh', overflowY: 'auto' }} onSubmit={handleSubmit}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>Corregir forma de pago</h3>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--color-text-muted)' }}>
          Venta #{sale.id} · {sale.client_name} · {formatCurrency(total)}
        </p>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="form-field">
          <label>Forma de pago</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            {[...PAYMENT_METHODS, 'mixto'].map((m) => <option key={m} value={m}>{paymentMethodLabel(m)}</option>)}
          </select>
        </div>

        {method === 'transferencia' && (
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, margin: '8px 0' }}>
            <input type="checkbox" checked={verificada} onChange={(e) => setVerificada(e.target.checked)} />
            Transferencia verificada
          </label>
        )}

        {method === 'mixto' && (
          <div style={{ marginTop: 8 }}>
            {legs.map((l, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <select value={l.method} onChange={(e) => setLeg(i, { method: e.target.value })} style={{ flex: 1.2 }}>
                  {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{paymentMethodLabel(m)}</option>)}
                </select>
                <input type="number" min="1" placeholder="Monto" value={l.amount} onChange={(e) => setLeg(i, { amount: e.target.value })} style={{ flex: 1 }} required />
                {l.method === 'transferencia' && (
                  <label title="Transferencia verificada" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                    <input type="checkbox" checked={!!l.transferencia_verificada} onChange={(e) => setLeg(i, { transferencia_verificada: e.target.checked })} /> ✓
                  </label>
                )}
                {legs.length > 2 && (
                  <button type="button" className="btn btn-secondary" style={{ padding: '2px 8px' }} onClick={() => setLegs((prev) => prev.filter((_, idx) => idx !== i))}>×</button>
                )}
              </div>
            ))}
            {legs.length < PAYMENT_METHODS.length && (
              <button type="button" className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setLegs((prev) => [...prev, { method: PAYMENT_METHODS.find((m) => !prev.some((l) => l.method === m)), amount: '', transferencia_verificada: false }])}>
                + Agregar forma de pago
              </button>
            )}
            <div style={{ marginTop: 10, fontSize: 13, color: Math.abs(restante) < 0.5 ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {Math.abs(restante) < 0.5 ? 'Los montos suman el total' : (restante > 0 ? `Faltan ${formatCurrency(restante)}` : `Sobran ${formatCurrency(-restante)}`)}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 18 }}>
          <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading || (method === 'mixto' && Math.abs(restante) >= 0.5)}>
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
          <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
        </div>
      </form>
    </div>
  );
}

// ---------- Corregir un gasto o un ingreso ----------
function MovimientoModal({ tipo, item, onClose, onSaved }) {
  const { put, loading, error } = useApi();
  const [nombre, setNombre] = useState(item.nombre);
  const [monto, setMonto] = useState(String(Number(item.monto)));
  const endpoint = tipo === 'gasto' ? `/api/gastos/${item.id}` : `/api/ingresos/${item.id}`;

  async function handleSubmit(e) {
    e.preventDefault();
    const result = await put(endpoint, { nombre, monto: Number(monto) });
    if (result.success) onSaved();
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <form className="modal-panel" style={{ width: 400 }} onSubmit={handleSubmit}>
        <h3 style={{ margin: '0 0 14px', fontSize: 16 }}>Corregir {tipo}</h3>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-field">
          <label>Nombre</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        </div>
        <div className="form-field">
          <label>Monto</label>
          <input type="number" min="1" value={monto} onChange={(e) => setMonto(e.target.value)} required />
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>{loading ? 'Guardando...' : 'Guardar'}</button>
          <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
        </div>
      </form>
    </div>
  );
}

// ---------- Panel principal: un cierre de caja de cualquier día ----------
// Solo admin. Muestra todo el flujo de caja del período y permite corregir operaciones;
// el servidor recalcula el cierre cada vez que se corrige algo.
export default function CierreDetalle({ cajaId, onClose, onChanged }) {
  const { data, loading, error, refetch } = useFetch(`/api/cash-register/${cajaId}`, { deps: [cajaId] });
  const { put, del, loading: saving, error: saveError } = useApi();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [payFor, setPayFor] = useState(null);
  const [movimiento, setMovimiento] = useState(null); // { tipo: 'gasto'|'ingreso', item }
  const [form, setForm] = useState(null);
  const [actionError, setActionError] = useState('');
  const [aviso, setAviso] = useState('');

  const caja = data?.caja;
  // El formulario de datos del cierre se (re)carga cuando llegan datos nuevos del servidor.
  useEffect(() => {
    if (caja && form === null) {
      setForm({ saldo_inicial: String(Number(caja.saldo_inicial)), efectivo_contado: String(Number(caja.efectivo_contado ?? 0)), notas: caja.notas || '' });
    }
  }, [caja, form]);

  function cambioHecho(mensaje) {
    setAviso(mensaje);
    setActionError('');
    setForm(null);
    refetch();
    onChanged?.();
  }

  async function guardarCierre(e) {
    e.preventDefault();
    setActionError('');
    const result = await put(`/api/cash-register/${cajaId}`, { saldo_inicial: form.saldo_inicial, efectivo_contado: form.efectivo_contado, notas: form.notas });
    if (result.success) cambioHecho('Cierre corregido y recalculado.');
    else if (result.error) setActionError(result.error);
  }

  async function eliminarVenta(v) {
    const ok = await confirm(`¿Eliminar la venta #${v.id} de ${v.client_name} (${formatCurrency(v.total)})? Irá a la Papelera y el cierre se recalcula sin ella.`, {
      title: 'Eliminar venta', confirmLabel: 'Eliminar', danger: true,
    });
    if (!ok) return;
    const result = await del(`/api/sales/${v.id}`);
    if (result.success) cambioHecho('Venta eliminada y cierre recalculado.');
    else if (result.error) setActionError(result.error);
  }

  async function eliminarMovimiento(tipo, item) {
    const ok = await confirm(`¿Eliminar el ${tipo} "${item.nombre}" (${formatCurrency(item.monto)})? El cierre se recalcula sin él.`, {
      title: `Eliminar ${tipo}`, confirmLabel: 'Eliminar', danger: true,
    });
    if (!ok) return;
    const result = await del(tipo === 'gasto' ? `/api/gastos/${item.id}` : `/api/ingresos/${item.id}`);
    if (result.success) cambioHecho(`${tipo === 'gasto' ? 'Gasto' : 'Ingreso'} eliminado y cierre recalculado.`);
    else if (result.error) setActionError(result.error);
  }

  const diferencia = caja ? Number(caja.diferencia) : 0;

  return (
    <div className="modal-overlay">
      <div className="modal-panel" style={{ width: 'min(1120px, 96vw)', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18 }}>Cierre de caja #{cajaId}</h3>
            {caja && (
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>
                {formatDate(caja.opened_at)} → {formatDate(caja.closed_at)} · Abrió: {caja.opened_by_name || '-'} · Cerró: {caja.closed_by_name || '-'}
              </div>
            )}
          </div>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        </div>

        {loading && !data && <div className="page-loading"><div className="spinner" /></div>}
        {error && <div className="alert alert-error">{error}</div>}
        {(actionError || saveError) && <div className="alert alert-error" style={{ marginTop: 12 }}>{actionError || saveError}</div>}
        {aviso && <div className="alert" style={{ marginTop: 12, background: 'var(--color-bg)', border: '1px solid var(--color-success)' }}>{aviso}</div>}

        {caja && (
          <>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 16 }}>
              <MetricsCard label="Saldo inicial" value={formatCurrency(caja.saldo_inicial)} />
              <MetricsCard label="Total vendido" value={formatCurrency(caja.total_vendido)} />
              <MetricsCard label="Gastos" value={formatCurrency(caja.total_gastos)} />
              <MetricsCard label="Ingresos a caja" value={formatCurrency(caja.total_ingresos)} />
              <MetricsCard label="Saldo real (esperado)" value={formatCurrency(caja.saldo_real)} />
              <MetricsCard label="Efectivo contado" value={formatCurrency(caja.efectivo_contado)} />
              <MetricsCard
                label="Diferencia"
                value={formatCurrency(caja.diferencia)}
                subtext={diferencia === 0 ? 'Cuadra exacto' : (diferencia > 0 ? 'Sobró efectivo' : 'Faltó efectivo')}
              />
            </div>

            {data.por_forma_pago && (
              <>
                <h4 style={sectionTitle}>Debería haber por forma de pago</h4>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {PAYMENT_METHODS.map((m) => <MetricsCard key={m} label={paymentMethodLabel(m)} value={formatCurrency(data.por_forma_pago[m])} />)}
                </div>
              </>
            )}

            <h4 style={sectionTitle}>Corregir datos del cierre</h4>
            {form && (
              <form onSubmit={guardarCierre} className="card" style={{ padding: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                  <div className="form-field">
                    <label>Saldo inicial</label>
                    <input type="number" min="0" value={form.saldo_inicial} onChange={(e) => setForm({ ...form, saldo_inicial: e.target.value })} required />
                  </div>
                  <div className="form-field">
                    <label>Efectivo contado</label>
                    <input type="number" min="0" value={form.efectivo_contado} onChange={(e) => setForm({ ...form, efectivo_contado: e.target.value })} required />
                  </div>
                  <div className="form-field" style={{ gridColumn: 'span 2' }}>
                    <label>Notas</label>
                    <input value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} placeholder="Opcional" />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: 8 }}>
                  {saving ? 'Guardando...' : 'Guardar corrección'}
                </button>
                <span style={{ marginLeft: 12, fontSize: 12, color: 'var(--color-text-muted)' }}>
                  El saldo real y la diferencia se recalculan con las operaciones de este día.
                </span>
              </form>
            )}

            <h4 style={sectionTitle}>Ventas del día ({data.ventas.length})</h4>
            <div className="card" style={{ padding: 16, overflowX: 'auto' }}>
              <table className="responsive-stack">
                <thead>
                  <tr>
                    <th>N°</th><th>Producto</th><th>Cliente</th><th>Vendedor</th><th>Registró</th><th>Tipo</th><th>Total</th><th>Estado</th><th>Pago</th><th>Hora</th><th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ventas.length === 0 ? (
                    <tr><td colSpan={11} style={{ color: 'var(--color-text-muted)' }}>Sin ventas en este cierre</td></tr>
                  ) : data.ventas.map((v) => (
                    <tr key={v.id}>
                      <td data-label="N°" style={{ whiteSpace: 'nowrap' }}>#{v.id}</td>
                      <td data-label="Producto">{Array.isArray(v.items) && v.items.length > 1 ? `${v.items.length} productos` : v.product_name}</td>
                      <td data-label="Cliente">{v.client_name}</td>
                      <td data-label="Vendedor">{v.vendor_name}</td>
                      <td data-label="Registró">{v.registered_by_name || '-'}</td>
                      <td data-label="Tipo">
                        {v.retiro_id
                          ? <Badge label="Retiro en tienda" color={TIPO_VENTA_LABELS.TIENDA?.color} />
                          : <Badge label={tipoVentaLabel(v.tipo_venta)} color={TIPO_VENTA_LABELS[v.tipo_venta]?.color} />}
                      </td>
                      <td data-label="Total" style={{ whiteSpace: 'nowrap' }}>{formatCurrency(v.total)}</td>
                      <td data-label="Estado">{v.tipo_venta === 'TIENDA' ? saleStatusLabel(v.status) : deliveryStatusLabel(v.delivery_status)}</td>
                      <td data-label="Pago">
                        {v.payment_method === 'mixto'
                          ? paymentBreakdownLines(v).map((l) => `${paymentMethodLabel(l.method)} ${formatCurrency(l.amount)}`).join(' + ')
                          : paymentMethodLabel(v.payment_method)}
                      </td>
                      <td data-label="Hora">{formatDate(v.created_at)}</td>
                      <td data-label="Acciones">
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {v.payment_method && (
                            <button type="button" className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => setPayFor(v)}>Corregir pago</button>
                          )}
                          <button type="button" className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: 12, color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={() => eliminarVenta(v)}>Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {[
              { tipo: 'gasto', titulo: 'Gastos', rows: data.gastos },
              { tipo: 'ingreso', titulo: 'Ingresos a caja', rows: data.ingresos },
            ].map(({ tipo, titulo, rows }) => (
              <div key={tipo}>
                <h4 style={sectionTitle}>{titulo} ({rows.length})</h4>
                <div className="card" style={{ padding: 16, overflowX: 'auto' }}>
                  <table className="responsive-stack">
                    <thead><tr><th>Nombre</th><th>Monto</th><th>Registró</th><th>Hora</th><th>Acciones</th></tr></thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr><td colSpan={5} style={{ color: 'var(--color-text-muted)' }}>Sin {titulo.toLowerCase()} en este cierre</td></tr>
                      ) : rows.map((m) => (
                        <tr key={m.id}>
                          <td data-label="Nombre">{m.nombre}</td>
                          <td data-label="Monto" style={{ whiteSpace: 'nowrap' }}>{formatCurrency(m.monto)}</td>
                          <td data-label="Registró">{m.created_by_name || '-'}</td>
                          <td data-label="Hora">{formatDate(m.created_at)}</td>
                          <td data-label="Acciones">
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button type="button" className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => setMovimiento({ tipo, item: m })}>Corregir</button>
                              <button type="button" className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: 12, color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={() => eliminarMovimiento(tipo, m)}>Eliminar</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {payFor && (
        <PagoModal sale={payFor} onClose={() => setPayFor(null)} onSaved={() => { setPayFor(null); cambioHecho('Forma de pago corregida y cierre recalculado.'); }} />
      )}
      {movimiento && (
        <MovimientoModal
          tipo={movimiento.tipo}
          item={movimiento.item}
          onClose={() => setMovimiento(null)}
          onSaved={() => { setMovimiento(null); cambioHecho(`${movimiento.tipo === 'gasto' ? 'Gasto' : 'Ingreso'} corregido y cierre recalculado.`); }}
        />
      )}
      {confirmDialog}
    </div>
  );
}
