import { useMemo, useState } from 'react';
import Layout from '../components/Layout';
import Badge from '../components/Badge';
import Pagination from '../components/Pagination';
import SearchableSelect from '../components/SearchableSelect';
import CuentaFormModal from '../components/pagos/CuentaFormModal';
import AbonoModal from '../components/pagos/AbonoModal';
import CuentaDetalleModal from '../components/pagos/CuentaDetalleModal';
import ContrapartesModal from '../components/pagos/ContrapartesModal';
import useFetch from '../hooks/useFetch';
import useDebouncedValue from '../hooks/useDebouncedValue';
import { formatCurrency } from '../utils/format';
import { TIPO_CUENTA, ESTADO_CUENTA, ESTADO_FILTROS, fechaCorta, rangoPeriodo } from '../utils/pagos';

const PAGE_SIZE = 12;
const EMPTY_FILTERS = { contraparte_id: '', usuario_id: '', desde: '', hasta: '', q: '' };
const TABS = [
  { value: '', label: 'Todas' },
  { value: 'por_pagar', label: 'Debemos pagar' },
  { value: 'por_cobrar', label: 'Nos deben' },
];

function queryString(params) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== '' && v !== undefined && v !== null) sp.set(k, v); });
  return sp.toString();
}

// Tarjeta resumen: lo que debemos o lo que nos deben (toca para filtrar esa lista).
function ResumenCard({ tipoKey, datos, activo, onClick }) {
  const t = TIPO_CUENTA[tipoKey];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className="card"
      style={{
        flex: '1 1 150px', minWidth: 0, textAlign: 'left', cursor: 'pointer', padding: '14px 16px',
        borderLeft: `5px solid ${t.color}`, outline: activo ? `2px solid ${t.color}` : 'none', font: 'inherit', color: 'inherit',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: t.color }}>{t.label}</div>
      <div style={{ fontSize: 'clamp(21px, 5.2vw, 30px)', fontWeight: 800, margin: '4px 0 2px', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(datos.saldo)}</div>
      <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>
        {datos.abiertas} cuenta(s) abierta(s)
        {datos.vencidas > 0 && <span style={{ color: '#b3423a', fontWeight: 600 }}> · {datos.vencidas} vencida(s) ({formatCurrency(datos.saldo_vencido)})</span>}
      </div>
    </button>
  );
}

function CuentaCard({ c, onDetalle, onAbonar, onEditar }) {
  const t = TIPO_CUENTA[c.tipo];
  const total = Number(c.monto_total);
  const pagado = Number(c.pagado);
  const pct = total > 0 ? Math.min(100, Math.round((pagado / total) * 100)) : 0;
  const pagada = c.estado === 'pagada';
  const anulada = c.estado === 'anulada';

  return (
    <div className="pago-card" style={{ '--tipo': t.color, opacity: anulada ? 0.65 : 1 }}>
      <div className="pago-card__cabecera">
        <div style={{ minWidth: 0 }}>
          <div className="pago-card__nombre" title={c.contraparte_nombre}>{c.contraparte_nombre}</div>
          <div className="pago-card__concepto" title={c.concepto}>{c.concepto}</div>
        </div>
        <Badge label={t.corto} color={t.color} />
      </div>

      <div className="pago-card__saldo">
        <div>
          <div className="pago-card__etiqueta">{pagada ? 'Pagada' : 'Saldo'}</div>
          <div className="pago-card__monto" style={{ color: pagada ? 'var(--color-success)' : 'inherit' }}>{formatCurrency(c.saldo)}</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
          <div>de {formatCurrency(total)}</div>
          {pagado > 0 && <div>pagado {formatCurrency(pagado)}</div>}
        </div>
      </div>

      <div className="pago-barra"><div className="pago-barra__relleno" style={{ width: `${pct}%`, background: t.color }} /></div>

      <div className="pago-card__chips">
        <Badge label={ESTADO_CUENTA[c.estado].label} color={ESTADO_CUENTA[c.estado].color} />
        {c.vencida && <Badge label="Vencida" color="#b3423a" />}
        {c.fecha_vencimiento && !pagada && !anulada && (
          <span style={{ fontSize: 12, color: c.vencida ? '#b3423a' : 'var(--color-text-muted)', fontWeight: c.vencida ? 600 : 400 }}>Vence {fechaCorta(c.fecha_vencimiento)}</span>
        )}
        {c.periodo_desde && <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{rangoPeriodo(c.periodo_desde, c.periodo_hasta)}</span>}
      </div>

      <div className="pago-card__acciones">
        <button type="button" className="btn btn-secondary" onClick={() => onDetalle(c)}>Ver detalle</button>
        {!pagada && !anulada && <button type="button" className="btn btn-primary" onClick={() => onAbonar(c)}>Abonar</button>}
        {!anulada && <button type="button" className="btn btn-secondary" onClick={() => onEditar(c)}>Editar</button>}
      </div>
    </div>
  );
}

export default function RecepcionPagosPage() {
  const [tipo, setTipo] = useState('');
  const [estado, setEstado] = useState('abiertas');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  const [formCuenta, setFormCuenta] = useState(null); // { cuenta? }
  const [abonando, setAbonando] = useState(null);
  const [detalleId, setDetalleId] = useState(null);
  const [verContrapartes, setVerContrapartes] = useState(false);

  const debouncedFilters = useDebouncedValue(filters);
  const qs = queryString({ tipo, estado, ...debouncedFilters, page, limit: PAGE_SIZE });

  const { data, loading, error, refetch } = useFetch(`/api/recepcion-pagos/cuentas?${qs}`, { deps: [qs] });
  const { data: contraData, refetch: refetchContrapartes } = useFetch('/api/recepcion-pagos/contrapartes');
  const { data: usersData } = useFetch('/api/users');

  const contrapartes = contraData?.contrapartes || [];
  const contraOptions = useMemo(() => contrapartes.map((c) => ({ value: c.id, label: c.nombre })), [contrapartes]);
  const staff = (usersData?.users || []).filter((u) => ['admin', 'operador', 'caja'].includes(u.role));
  const activeFilters = Object.values(filters).filter(Boolean).length;
  const resumen = data?.resumen;
  const cuentas = data?.cuentas || [];

  function resetPage(fn) {
    return (...args) => { fn(...args); setPage(1); };
  }
  const cambiarTipo = resetPage(setTipo);
  const cambiarEstado = resetPage(setEstado);
  const cambiarFiltros = resetPage(setFilters);

  function recargar() {
    refetch();
  }

  function abrirNueva() {
    setFormCuenta({ cuenta: null });
  }

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>Recepción de Pagos</h1>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 4, marginBottom: 0, fontSize: 13 }}>
            Cuentas por pagar y por cobrar. Todo lo que se anota aquí queda aparte de la caja.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={() => setVerContrapartes(true)}>Contrapartes</button>
          <button type="button" className="btn btn-primary" onClick={abrirNueva}>+ Nueva cuenta</button>
        </div>
      </div>

      {resumen && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          <ResumenCard tipoKey="por_pagar" datos={resumen.por_pagar} activo={tipo === 'por_pagar'} onClick={() => cambiarTipo(tipo === 'por_pagar' ? '' : 'por_pagar')} />
          <ResumenCard tipoKey="por_cobrar" datos={resumen.por_cobrar} activo={tipo === 'por_cobrar'} onClick={() => cambiarTipo(tipo === 'por_cobrar' ? '' : 'por_cobrar')} />
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div role="group" aria-label="Tipo de cuenta" style={{ display: 'flex' }}>
          {TABS.map((t, i) => (
            <button
              key={t.label}
              type="button"
              aria-pressed={tipo === t.value}
              onClick={() => cambiarTipo(t.value)}
              className="btn"
              style={{
                padding: '6px 14px', fontSize: 13, fontWeight: 600,
                borderRadius: i === 0 ? '8px 0 0 8px' : (i === TABS.length - 1 ? '0 8px 8px 0' : 0),
                border: '1px solid var(--color-accent)', marginLeft: i === 0 ? 0 : -1,
                background: tipo === t.value ? 'var(--color-accent)' : 'var(--color-surface)',
                color: tipo === t.value ? '#fff' : 'var(--color-accent)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            placeholder="Buscar por nombre, motivo o nota..."
            value={filters.q}
            onChange={(e) => cambiarFiltros({ ...filters, q: e.target.value })}
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--color-border)', width: 250, background: 'var(--color-surface)', color: 'var(--color-text)' }}
          />
          <button type="button" className="btn btn-secondary" onClick={() => setShowFilters((v) => !v)}>
            Filtros{activeFilters > 0 ? ` (${activeFilters})` : ''} {showFilters ? '▴' : '▾'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }} role="group" aria-label="Estado">
        {ESTADO_FILTROS.map((f) => {
          const activo = estado === f.value;
          return (
            <button
              key={f.label}
              type="button"
              aria-pressed={activo}
              onClick={() => cambiarEstado(f.value)}
              style={{
                padding: '4px 12px', fontSize: 12, fontWeight: 600, borderRadius: 999, cursor: 'pointer',
                border: `1px solid ${activo ? 'var(--color-accent)' : 'var(--color-border)'}`,
                background: activo ? 'var(--color-accent-light)' : 'transparent',
                color: activo ? 'var(--color-accent)' : 'var(--color-text-muted)',
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {showFilters && (
        <div className="card" style={{ padding: 16, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12, alignItems: 'end' }}>
            <div className="form-field" style={{ margin: 0 }}>
              <label>Contraparte</label>
              <SearchableSelect value={filters.contraparte_id} onChange={(v) => cambiarFiltros({ ...filters, contraparte_id: v })} options={[{ value: '', label: 'Todas' }, ...contraOptions]} placeholder="Todas" />
            </div>
            <div className="form-field" style={{ margin: 0 }}>
              <label>Registró</label>
              <select value={filters.usuario_id} onChange={(e) => cambiarFiltros({ ...filters, usuario_id: e.target.value })}>
                <option value="">Todos</option>
                {staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="form-field" style={{ margin: 0 }}>
              <label>Cuentas desde</label>
              <input type="date" value={filters.desde} max={filters.hasta || undefined} onChange={(e) => cambiarFiltros({ ...filters, desde: e.target.value })} />
            </div>
            <div className="form-field" style={{ margin: 0 }}>
              <label>Cuentas hasta</label>
              <input type="date" value={filters.hasta} min={filters.desde || undefined} onChange={(e) => cambiarFiltros({ ...filters, hasta: e.target.value })} />
            </div>
            <div>
              <button type="button" className="btn btn-secondary" style={{ width: '100%' }} disabled={activeFilters === 0} onClick={() => cambiarFiltros(EMPTY_FILTERS)}>Limpiar filtros</button>
            </div>
          </div>
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}
      {loading && !data && <div className="page-loading"><div className="spinner" /></div>}

      {data && cuentas.length === 0 && (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)' }}>
          <div style={{ fontSize: 15, marginBottom: 6 }}>No hay cuentas que coincidan.</div>
          <div style={{ fontSize: 13 }}>Cambia los filtros o crea una con <strong>+ Nueva cuenta</strong>.</div>
        </div>
      )}

      {cuentas.length > 0 && (
        <div className="pago-grid">
          {cuentas.map((c) => (
            <CuentaCard
              key={c.id}
              c={c}
              onDetalle={(x) => setDetalleId(x.id)}
              onAbonar={(x) => setAbonando(x)}
              onEditar={(x) => setFormCuenta({ cuenta: x })}
            />
          ))}
        </div>
      )}

      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />}

      {formCuenta && (
        <CuentaFormModal
          cuenta={formCuenta.cuenta}
          tipoInicial={tipo || 'por_pagar'}
          contrapartes={contrapartes}
          onContraparteCreada={refetchContrapartes}
          onClose={() => setFormCuenta(null)}
          onSaved={() => { setFormCuenta(null); recargar(); }}
        />
      )}
      {abonando && (
        <AbonoModal cuenta={abonando} onClose={() => setAbonando(null)} onSaved={() => { setAbonando(null); recargar(); }} />
      )}
      {detalleId && (
        <CuentaDetalleModal
          cuentaId={detalleId}
          onClose={() => setDetalleId(null)}
          onChanged={recargar}
          onEditar={(cuenta) => { setDetalleId(null); setFormCuenta({ cuenta }); }}
        />
      )}
      {verContrapartes && <ContrapartesModal onClose={() => setVerContrapartes(false)} onChanged={() => { refetchContrapartes(); recargar(); }} />}
    </Layout>
  );
}
