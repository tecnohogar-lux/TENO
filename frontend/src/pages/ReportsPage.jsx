import { useMemo, useState } from 'react';
import Layout from '../components/Layout';
import Badge from '../components/Badge';
import useFetch from '../hooks/useFetch';
import useApi from '../hooks/useApi';
import useAuth from '../hooks/useAuth';
import useConfirm from '../hooks/useConfirm';
import SearchableSelect from '../components/SearchableSelect';
import { formatCurrency, formatDate } from '../utils/format';
import { SALE_STATUS_LABELS, DELIVERY_STATUS_LABELS, TIPO_VENTA_LABELS, saleStatusLabel, deliveryStatusLabel, tipoVentaLabel, paymentMethodLabel, paymentBreakdownLines, PAYMENT_METHODS, isSinCobro } from '../utils/labels';
import { PRICE_TYPE_LABELS, priceTypeLabel } from '../utils/priceType';
import { cuentaParaComision, comisionContada } from '../utils/comisiones';
import { fechaRegistro, fechaSalida, formatDia } from '../utils/fechas';
import MultiSelectFiltro from '../components/MultiSelectFiltro';
import { normalizarTexto } from '../utils/texto';

// Cada filtro admite varias opciones a la vez (dentro de un filtro basta con cumplir una; entre filtros
// distintos se deben cumplir todos). `fechas` son rangos { desde, hasta } y días sueltos (desde = hasta).
const emptyFilters = { fechas: [], nombre: '', producto: [], vendedor: [], cliente: [], canal: [], tipoPrecio: [], formaPago: [], courier: [] };

const CANAL_OPTIONS = [
  { value: 'TIENDA', label: 'Tienda' },
  { value: 'ENVIO', label: 'Envío' },
  { value: 'ENVIO_PREPAGADO', label: 'Envío prepagado' },
  { value: 'ENVIO_REGION', label: 'Envío a región' },
];
const TIPO_PRECIO_OPTIONS = [
  { value: 'sol', label: 'SOL' },
  { value: 'marketplace', label: 'MARKETPLACE' },
  { value: 'mayor', label: 'MAYOR' },
  { value: 'mixto', label: 'MIXTO' },
];

function etiquetaFecha(f) {
  if (f.desde && f.hasta) return f.desde === f.hasta ? `Día ${formatDia(f.desde)}` : `${formatDia(f.desde)} al ${formatDia(f.hasta)}`;
  if (f.desde) return `Desde ${formatDia(f.desde)}`;
  return `Hasta ${formatDia(f.hasta)}`;
}

// Tipos de venta que se despachan con courier (los de tienda no tienen).
const TIPOS_ENVIO = ['ENVIO', 'ENVIO_PREPAGADO', 'ENVIO_REGION'];
const SIN_COURIER = '__none__';

// "YYYY-MM-DD" de un <input type="date"> se parsea como medianoche UTC si se usa
// new Date(str) directamente; mezclarlo con setHours (que opera en hora local)
// desalinea el rango en cualquier zona horaria distinta de UTC. Se construye la
// fecha con componentes locales para que el límite del día coincida con el
// calendario del usuario.
function parseLocalDayBoundary(value, endOfDay = false) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  return endOfDay
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day, 0, 0, 0, 0);
}

export default function ReportsPage() {
  const { user } = useAuth();
  const canManage = user.role === 'operador' || user.role === 'admin' || user.role === 'caja';
  const { data, loading, error } = useFetch('/api/sales?costos=1');
  const [filters, setFilters] = useState(emptyFilters);
  const [exporting, setExporting] = useState(false);
  const [rango, setRango] = useState({ desde: '', hasta: '' }); // rango que se está armando antes de agregarlo
  const [diaNuevo, setDiaNuevo] = useState('');
  // Orden de la vista previa y del Excel por fecha de ingreso: 'nuevo' = del más nuevo al más viejo.
  const [orden, setOrden] = useState('nuevo');
  // Qué fecha usan los filtros de fechas: la de creación de la venta o la de salida del paquete (en camino / retirado).
  const [fechaPor, setFechaPor] = useState('creacion');

  const { get: getComisiones, loading: loadingComisiones, error: comisionesError } = useApi();
  const today = new Date().toISOString().slice(0, 10);
  const [comisionesRango, setComisionesRango] = useState({ desde: today, hasta: today });
  const [comisionesResult, setComisionesResult] = useState(null);
  const { post: postDescuento, del: delDescuento, loading: savingDescuento, error: descuentoError } = useApi();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { data: usersData } = useFetch('/api/users', { enabled: canManage });
  // El vendedor ve sus propios descuentos (el backend ya filtra por su usuario).
  const { data: misDescuentos } = useFetch('/api/descuentos', { enabled: user.role === 'vendedor' });
  const [descuentoForm, setDescuentoForm] = useState({ vendor_id: '', motivo: '', monto: '' });
  const vendorOptions = useMemo(
    () => (usersData?.users || []).filter((u) => u.role === 'vendedor' && u.is_active).map((v) => ({ value: v.id, label: v.name })),
    [usersData]
  );

  async function handleCrearDescuento(e) {
    e.preventDefault();
    const result = await postDescuento('/api/descuentos', { ...descuentoForm, vendor_id: Number(descuentoForm.vendor_id) });
    if (result.success) {
      setDescuentoForm({ vendor_id: '', motivo: '', monto: '' });
      handleCalcularComisiones();
    }
  }

  async function handleEliminarDescuento(d) {
    const ok = await confirm(`¿Eliminar el descuento "${d.motivo}" por ${formatCurrency(d.monto)}?`, { title: 'Eliminar descuento', confirmLabel: 'Eliminar', danger: true });
    if (!ok) return;
    const result = await delDescuento(`/api/descuentos/${d.id}`);
    if (result.success) handleCalcularComisiones();
  }

  async function handleCalcularComisiones() {
    setComisionesResult(null);
    const result = await getComisiones(`/api/sales/comisiones?desde=${comisionesRango.desde}&hasta=${comisionesRango.hasta}`);
    if (result.success) setComisionesResult(result.data);
  }

  const productos = useMemo(() => [...new Set((data?.sales || []).map((s) => s.product_name))].sort(), [data]);
  const vendedores = useMemo(() => [...new Set((data?.sales || []).map((s) => s.vendor_name))].sort(), [data]);
  // Couriers que aparecen en las ventas (para filtrar qué courier se llevó cada paquete).
  const couriers = useMemo(() => {
    const byId = new Map();
    for (const s of data?.sales || []) {
      if (s.courier_id && s.courier_name) byId.set(String(s.courier_id), s.courier_name);
    }
    return [...byId.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);
  const clientes = useMemo(() => [...new Set((data?.sales || []).map((s) => s.client_name))].sort(), [data]);

  const filteredSales = useMemo(() => {
    // Los envíos sin cobro (solo envío, solo entrega, cambio de producto) no entran a los reportes.
    let rows = (data?.sales || []).filter((s) => !isSinCobro(s));

    // Fechas: la venta entra si cae en cualquiera de los rangos / días elegidos.
    if (filters.fechas.length > 0) {
      const tramos = filters.fechas.map((f) => ({
        desde: f.desde ? parseLocalDayBoundary(f.desde) : null,
        hasta: f.hasta ? parseLocalDayBoundary(f.hasta, true) : null,
      }));
      rows = rows.filter((s) => {
        // Por fecha de envío, lo que aún no salió (sin fecha) no entra.
        const fecha = fechaPor === 'envio' ? fechaSalida(s) : s.created_at;
        if (!fecha) return false;
        const d = new Date(fecha);
        return tramos.some((t) => (!t.desde || d >= t.desde) && (!t.hasta || d <= t.hasta));
      });
    }

    const term = normalizarTexto(filters.nombre.trim());
    if (term) {
      rows = rows.filter((s) =>
        normalizarTexto(s.product_name).includes(term) ||
        normalizarTexto(s.client_name).includes(term) ||
        normalizarTexto(s.vendor_name).includes(term)
      );
    }

    const entre = (lista, valor) => lista.length === 0 || lista.includes(valor);
    rows = rows.filter((s) => entre(filters.producto, s.product_name)
      && entre(filters.vendedor, s.vendor_name)
      && entre(filters.cliente, s.client_name)
      && entre(filters.canal, s.tipo_venta)
      && entre(filters.tipoPrecio, s.price_type));
    if (filters.courier.length > 0) {
      const sinCourier = filters.courier.includes(SIN_COURIER);
      rows = rows.filter((s) => (sinCourier && TIPOS_ENVIO.includes(s.tipo_venta) && !s.courier_id)
        || (s.courier_id && filters.courier.includes(String(s.courier_id))));
    }

    return rows;
  }, [data, filters, fechaPor]);

  // Sin filtro de forma de pago: una fila por venta (con el resumen del pago,
  // mixto o no). Con filtro: una fila por venta que haya usado esa forma de
  // pago, mostrando solo el monto de esa línea — así una venta con pago mixto
  // (ej. parte efectivo + parte transferencia) aparece en ambos reportes, cada
  // uno con su monto correspondiente, sin inventar un tipo de venta nuevo.
  const filasSinOrden = useMemo(() => {
    if (filters.formaPago.length === 0) {
      return filteredSales.map((s) => ({
        ...s,
        _displayTotal: Number(s.total),
        _pagoLabel: s.payment_method === 'mixto'
          ? paymentBreakdownLines(s).map((l) => `${paymentMethodLabel(l.method)} ${formatCurrency(l.amount)}`).join(' + ')
          : paymentMethodLabel(s.payment_method),
      }));
    }
    // Con formas de pago elegidas: la venta entra si usó alguna de ellas y se muestra solo lo cobrado con esas
    // formas (una venta con pago mixto suma las partes que coinciden).
    const rows = [];
    for (const s of filteredSales) {
      const partes = paymentBreakdownLines(s).filter((l) => filters.formaPago.includes(l.method));
      if (partes.length > 0) {
        rows.push({
          ...s,
          _displayTotal: partes.reduce((acc, l) => acc + Number(l.amount), 0),
          _pagoLabel: partes.map((l) => `${paymentMethodLabel(l.method)} ${formatCurrency(l.amount)}`).join(' + '),
        });
      }
    }
    return rows;
  }, [filteredSales, filters.formaPago]);

  // Ordena por la fecha de ingreso (la primera columna). A igual fecha, por número de venta, para que el orden
  // sea estable y el Excel salga exactamente como la vista previa.
  const displayRows = useMemo(() => {
    const factor = orden === 'nuevo' ? -1 : 1;
    return [...filasSinOrden].sort((a, b) => {
      const diff = new Date(fechaRegistro(a)) - new Date(fechaRegistro(b));
      return (diff || Number(a.id) - Number(b.id)) * factor;
    });
  }, [filasSinOrden, orden]);

  function agregarFecha(f) {
    if (!f.desde && !f.hasta) return;
    if (f.desde && f.hasta && f.desde > f.hasta) return;
    if (filters.fechas.some((x) => x.desde === f.desde && x.hasta === f.hasta)) return;
    setFilters({ ...filters, fechas: [...filters.fechas, f] });
  }

  function agregarRango() {
    agregarFecha({ desde: rango.desde, hasta: rango.hasta });
    setRango({ desde: '', hasta: '' });
  }

  function agregarDia(valor) {
    if (valor) agregarFecha({ desde: valor, hasta: valor });
    setDiaNuevo('');
  }

  function quitarFecha(i) {
    setFilters({ ...filters, fechas: filters.fechas.filter((_, j) => j !== i) });
  }

  // Resumen legible de lo filtrado: se muestra en la vista previa y va en la hoja "Filtros" del Excel.
  const resumenFiltros = useMemo(() => {
    const nombresCourier = filters.courier.map((id) => (id === SIN_COURIER ? 'Envíos sin courier asignado' : (couriers.find((c) => c.id === id)?.name || id)));
    const lista = [
      [fechaPor === 'envio' ? 'Fechas (por fecha de envío)' : 'Fechas (por fecha de creación)', filters.fechas.map(etiquetaFecha)],
      ['Canal', filters.canal.map((v) => CANAL_OPTIONS.find((o) => o.value === v)?.label || v)],
      ['Forma de pago', filters.formaPago.map(paymentMethodLabel)],
      ['Tipo de precio', filters.tipoPrecio.map((v) => TIPO_PRECIO_OPTIONS.find((o) => o.value === v)?.label || v)],
      ['Producto', filters.producto],
      ['Vendedor', filters.vendedor],
      ['Cliente', filters.cliente],
      ['Courier', nombresCourier],
      ['Búsqueda por nombre', filters.nombre.trim() ? [filters.nombre.trim()] : []],
    ];
    return lista.filter(([, valores]) => valores.length > 0).map(([nombre, valores]) => ({ nombre, valores }));
  }, [filters, couriers, fechaPor]);

  const totalComisionPreview = useMemo(
    () => filteredSales.reduce((acc, s) => acc + comisionContada(s), 0),
    [filteredSales]
  );

  const hasActiveFilters = resumenFiltros.length > 0;

  function clearFilters() {
    setFilters(emptyFilters);
  }

  async function handleExport() {
    setExporting(true);
    try {
      // La librería de Excel es pesada: se descarga recién al exportar, no al abrir Reportes.
      const XLSX = await import('xlsx');
      const formaPagoActiva = filters.formaPago.length > 0;
      // Ventas viejas (previas al desglose precio_producto/precio_envio) solo
      // tienen "total" sin separar; ante la falta de desglose se asume que todo
      // el monto es de producto (no hubo envío), para que las sumas nunca pierdan
      // dinero: total productos + total envíos siempre da el total real.
      // Con filtro de forma de pago, el total es la suma de los montos parciales
      // de esa forma de pago (no se desglosa producto/envío a nivel de línea de pago).
      const num = (v) => (v !== null && v !== undefined ? Number(v) : null);
      const envioDe = (s) => (formaPagoActiva ? null : (num(s.precio_envio) ?? 0));
      const productoDe = (s) => {
        if (formaPagoActiva) return null;
        return num(s.precio_producto) ?? Number(s.total) - (num(s.precio_envio) ?? 0);
      };
      const esEnvio = (s) => TIPOS_ENVIO.includes(s.tipo_venta);

      // Orden de las columnas: primero las pedidas por operaciones, luego el resto de la información.
      // `total` suma la columna en la fila TOTALES (si no se define, queda vacía).
      const columnas = [
        { titulo: 'Fecha de ingreso', valor: (s) => formatDate(fechaRegistro(s)) },
        { titulo: 'Cantidad', valor: (s) => s.quantity },
        { titulo: 'Producto', valor: (s) => s.product_name },
        // El costo de compra es un dato interno: solo lo reciben admin/operador/caja.
        ...(canManage ? [{ titulo: 'Costo', valor: (s) => num(s.costo_total) ?? '', total: (s) => num(s.costo_total) ?? 0 }] : []),
        { titulo: 'Precio del producto', valor: (s) => productoDe(s) ?? '', total: (s) => productoDe(s) ?? 0 },
        { titulo: 'Total', valor: (s) => s._displayTotal, total: (s) => s._displayTotal },
        { titulo: 'Comisión', valor: (s) => (cuentaParaComision(s) && num(s.comision) !== null ? Number(s.comision) : ''), total: (s) => comisionContada(s) },
        { titulo: 'Vendedor', valor: (s) => s.vendor_name },
        { titulo: 'Cliente', valor: (s) => s.client_name },
        { titulo: 'Forma de pago', valor: (s) => s._pagoLabel },
        { titulo: 'Estado', valor: (s) => saleStatusLabel(s.status) },
        { titulo: 'Tipo de precio', valor: (s) => priceTypeLabel(s.price_type) },
        // ---- resto de la información
        { titulo: 'Delivery', valor: (s) => (esEnvio(s) ? (s.courier_name || 'Sin asignar') : '-') },
        { titulo: 'Fecha de envío', valor: (s) => (fechaSalida(s) ? formatDate(fechaSalida(s)) : '') },
        { titulo: 'Tipo', valor: (s) => tipoVentaLabel(s.tipo_venta) },
        { titulo: 'Precio envío', valor: (s) => envioDe(s) ?? '', total: (s) => envioDe(s) ?? 0 },
        { titulo: 'Estado del envío', valor: (s) => (esEnvio(s) ? deliveryStatusLabel(s.delivery_status) : '-') },
      ];

      const rows = displayRows.map((s) => Object.fromEntries(columnas.map((c) => [c.titulo, c.valor(s)])));
      const totales = columnas.map((c, i) => {
        if (i === 0) return 'TOTALES';
        if (!c.total) return '';
        const suma = displayRows.reduce((acc, s) => acc + c.total(s), 0);
        return suma || '';
      });

      const sheet = XLSX.utils.json_to_sheet(rows, { header: columnas.map((c) => c.titulo) });
      XLSX.utils.sheet_add_aoa(sheet, [[], totales], { origin: -1 });

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, 'Ventas');
      // Segunda hoja con los filtros usados, para saber de qué está hecho el reporte.
      const filasFiltros = [['Filtro', 'Selección'], ...(resumenFiltros.length > 0
        ? resumenFiltros.map((f) => [f.nombre, f.valores.join(', ')])
        : [['Sin filtros', 'Todas las ventas']]), [],
      ['Orden', orden === 'nuevo' ? 'De más nuevo a más viejo (fecha de ingreso)' : 'De más viejo a más nuevo (fecha de ingreso)'],
      ['Ventas incluidas', displayRows.length]];
      const hojaFiltros = XLSX.utils.aoa_to_sheet(filasFiltros);
      hojaFiltros['!cols'] = [{ wch: 22 }, { wch: 80 }];
      XLSX.utils.book_append_sheet(workbook, hojaFiltros, 'Filtros');
      const today = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `ventas_${today}.xlsx`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <Layout>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Reportes</h1>
      <p style={{ color: 'var(--color-text-muted)', marginTop: 0, marginBottom: 24 }}>
        Filtra las ventas, revisa la vista previa y exporta a Excel solo lo que necesites.
      </p>

      {canManage && (
        <div className="card" style={{ padding: 20, marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>Comisiones a pagar por vendedor</h3>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 0, marginBottom: 16 }}>
            Solo cuenta ventas ya cerradas (tienda/retiro completado, o envío entregado) con el pago confirmado.
          </p>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
            <div className="form-field" style={{ marginBottom: 0 }}>
              <label>Desde</label>
              <input type="date" value={comisionesRango.desde} onChange={(e) => setComisionesRango({ ...comisionesRango, desde: e.target.value })} />
            </div>
            <div className="form-field" style={{ marginBottom: 0 }}>
              <label>Hasta</label>
              <input type="date" value={comisionesRango.hasta} onChange={(e) => setComisionesRango({ ...comisionesRango, hasta: e.target.value })} />
            </div>
            <button className="btn btn-primary" onClick={handleCalcularComisiones} disabled={loadingComisiones}>
              {loadingComisiones ? 'Calculando...' : 'Calcular'}
            </button>
          </div>
          {comisionesError && <div className="alert alert-error">{comisionesError}</div>}
          {comisionesResult && (
            <div style={{ overflowX: 'auto' }}>
              <table className="responsive-stack">
                <thead>
                  <tr>
                    <th>Vendedor</th>
                    <th>Ventas</th>
                    <th>Comisión</th>
                    <th>Descuentos</th>
                    <th>Neto a pagar</th>
                  </tr>
                </thead>
                <tbody>
                  {comisionesResult.vendedores.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ color: 'var(--color-text-muted)' }}>Sin comisiones ni descuentos en ese rango de fechas</td>
                    </tr>
                  ) : (
                    comisionesResult.vendedores.map((v) => (
                      <tr key={v.vendor_id}>
                        <td data-label="Vendedor">{v.vendor_name}</td>
                        <td data-label="Ventas">{v.cantidad_ventas}</td>
                        <td data-label="Comisión">{formatCurrency(v.total_comision)}</td>
                        <td data-label="Descuentos">
                          <div style={{ fontWeight: 600 }}>{v.total_descuentos > 0 ? `-${formatCurrency(v.total_descuentos)}` : '-'}</div>
                          {v.descuentos.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, minWidth: 220 }}>
                              {v.descuentos.map((d) => (
                                <div
                                  key={d.id}
                                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px 6px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)' }}
                                >
                                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, overflowWrap: 'anywhere' }}>{d.motivo}</div>
                                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{formatDate(d.created_at)} · -{formatCurrency(d.monto)}</div>
                                  </div>
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    title="Eliminar este descuento"
                                    aria-label={`Eliminar descuento ${d.motivo}`}
                                    onClick={() => handleEliminarDescuento(d)}
                                    style={{ padding: '5px 9px', fontSize: 12, gap: 5, flexShrink: 0, color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                                  >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    Eliminar
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td data-label="Neto a pagar" style={{ fontWeight: 700, color: v.neto < 0 ? 'var(--color-danger)' : undefined }}>{formatCurrency(v.neto)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {comisionesResult.vendedores.length > 0 && (
                <div style={{ marginTop: 12, fontSize: 14, textAlign: 'right', lineHeight: 1.7 }}>
                  <div>Comisiones: {formatCurrency(comisionesResult.total_general)}</div>
                  <div>Descuentos: -{formatCurrency(comisionesResult.total_descuentos)}</div>
                  <div>Neto a pagar: <strong>{formatCurrency(comisionesResult.total_neto)}</strong></div>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleCrearDescuento} style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
            <h4 style={{ margin: '0 0 4px', fontSize: 14 }}>Registrar descuento a un vendedor</h4>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '0 0 12px' }}>
              Devoluciones o errores: se resta de la comisión del rango de fechas en que lo registres. El vendedor puede ver sus descuentos.
            </p>
            {descuentoError && <div className="alert alert-error">{descuentoError}</div>}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="form-field" style={{ marginBottom: 0, minWidth: 200 }}>
                <label>Vendedor</label>
                <SearchableSelect value={descuentoForm.vendor_id} onChange={(v) => setDescuentoForm({ ...descuentoForm, vendor_id: v })} options={vendorOptions} placeholder="Selecciona un vendedor" required />
              </div>
              <div className="form-field" style={{ marginBottom: 0, flex: 1, minWidth: 180 }}>
                <label>Motivo</label>
                <input value={descuentoForm.motivo} onChange={(e) => setDescuentoForm({ ...descuentoForm, motivo: e.target.value })} required />
              </div>
              <div className="form-field" style={{ marginBottom: 0, width: 140 }}>
                <label>Monto</label>
                <input type="number" min="1" value={descuentoForm.monto} onChange={(e) => setDescuentoForm({ ...descuentoForm, monto: e.target.value })} required />
              </div>
              <button type="submit" className="btn btn-primary" disabled={savingDescuento || !descuentoForm.vendor_id}>
                {savingDescuento ? 'Guardando...' : 'Registrar descuento'}
              </button>
            </div>
          </form>
        </div>
      )}

      {user.role === 'vendedor' && misDescuentos && (
        <div className="card" style={{ padding: 20, marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>Mis descuentos</h3>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 0, marginBottom: 16 }}>
            Descuentos por devoluciones o errores que se restan de tu comisión al pagarte.
          </p>
          <table className="responsive-stack">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Motivo</th>
                <th>Monto</th>
              </tr>
            </thead>
            <tbody>
              {misDescuentos.descuentos.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ color: 'var(--color-text-muted)' }}>No tienes descuentos</td>
                </tr>
              ) : (
                misDescuentos.descuentos.map((d) => (
                  <tr key={d.id}>
                    <td data-label="Fecha">{formatDate(d.created_at)}</td>
                    <td data-label="Motivo">{d.motivo}</td>
                    <td data-label="Monto">-{formatCurrency(d.monto)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {misDescuentos.descuentos.length > 0 && (
            <div style={{ marginTop: 12, fontSize: 14, textAlign: 'right' }}>
              Total: <strong>-{formatCurrency(misDescuentos.total_monto)}</strong>
            </div>
          )}
        </div>
      )}

      <div className="card" style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>Filtros</h3>
          {hasActiveFilters && (
            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={clearFilters}>
              Limpiar filtros
            </button>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label>Fechas (puedes agregar varios rangos y días)</label>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 2 }}>Filtrar por</div>
                <select value={fechaPor} onChange={(e) => setFechaPor(e.target.value)}>
                  <option value="creacion">Fecha de creación</option>
                  <option value="envio">Fecha de envío (en camino / retirado)</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 2 }}>Desde</div>
                <input type="date" value={rango.desde} onChange={(e) => setRango({ ...rango, desde: e.target.value })} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 2 }}>Hasta</div>
                <input type="date" value={rango.hasta} onChange={(e) => setRango({ ...rango, hasta: e.target.value })} />
              </div>
              <button type="button" className="btn btn-secondary" onClick={agregarRango} disabled={(!rango.desde && !rango.hasta) || (rango.desde && rango.hasta && rango.desde > rango.hasta)}>
                Agregar rango
              </button>
              <div style={{ marginLeft: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 2 }}>Día específico (se agrega al elegirlo)</div>
                <input type="date" value={diaNuevo} onChange={(e) => agregarDia(e.target.value)} />
              </div>
            </div>
            {filters.fechas.length > 0 && (
              <div className="fecha-chips">
                {filters.fechas.map((f, i) => (
                  <span key={`${f.desde}-${f.hasta}`} className="fecha-chip">
                    {etiquetaFecha(f)}
                    <button type="button" onClick={() => quitarFecha(i)} aria-label={`Quitar ${etiquetaFecha(f)}`}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="form-field">
            <label>Canal</label>
            <MultiSelectFiltro value={filters.canal} onChange={(v) => setFilters({ ...filters, canal: v })} options={CANAL_OPTIONS} />
          </div>
          <div className="form-field">
            <label>Forma de pago</label>
            <MultiSelectFiltro value={filters.formaPago} onChange={(v) => setFilters({ ...filters, formaPago: v })} options={PAYMENT_METHODS.map((m) => ({ value: m, label: paymentMethodLabel(m) }))} todosLabel="Todas" />
          </div>
          <div className="form-field">
            <label>Tipo de precio</label>
            <MultiSelectFiltro value={filters.tipoPrecio} onChange={(v) => setFilters({ ...filters, tipoPrecio: v })} options={TIPO_PRECIO_OPTIONS} />
          </div>
          <div className="form-field">
            <label>Buscar por nombre</label>
            <input
              placeholder="Producto, cliente o vendedor..."
              value={filters.nombre}
              onChange={(e) => setFilters({ ...filters, nombre: e.target.value })}
            />
          </div>
          <div className="form-field">
            <label>Producto</label>
            <MultiSelectFiltro value={filters.producto} onChange={(v) => setFilters({ ...filters, producto: v })} options={productos.map((p) => ({ value: p, label: p }))} />
          </div>
          <div className="form-field">
            <label>Vendedor</label>
            <MultiSelectFiltro value={filters.vendedor} onChange={(v) => setFilters({ ...filters, vendedor: v })} options={vendedores.map((v) => ({ value: v, label: v }))} />
          </div>
          <div className="form-field">
            <label>Cliente</label>
            <MultiSelectFiltro value={filters.cliente} onChange={(v) => setFilters({ ...filters, cliente: v })} options={clientes.map((c) => ({ value: c, label: c }))} />
          </div>
          <div className="form-field">
            <label>Courier</label>
            <MultiSelectFiltro
              value={filters.courier}
              onChange={(v) => setFilters({ ...filters, courier: v })}
              options={[...couriers.map((c) => ({ value: c.id, label: c.name })), { value: SIN_COURIER, label: 'Envíos sin courier asignado' }]}
            />
          </div>
        </div>
      </div>

      {loading && (
        <div className="page-loading">
          <div className="spinner" />
        </div>
      )}
      {error && <div className="alert alert-error">{error}</div>}

      {data && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>Vista previa · {displayRows.length} venta(s)</h3>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setOrden(orden === 'nuevo' ? 'viejo' : 'nuevo')}
                title="Cambia el orden de la vista previa y del Excel según la fecha de ingreso"
              >
                {orden === 'nuevo' ? '↓ Más nuevo primero' : '↑ Más viejo primero'}
              </button>
              <button className="btn btn-primary" onClick={handleExport} disabled={exporting || displayRows.length === 0}>
                {exporting ? 'Generando...' : 'Exportar a Excel'}
              </button>
            </div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 6 }}>
            <strong style={{ color: 'var(--color-text)' }}>Filtros aplicados:</strong>{' '}
            {resumenFiltros.length === 0
              ? 'ninguno (todas las ventas)'
              : resumenFiltros.map((f) => `${f.nombre}: ${f.valores.join(', ')}`).join(' · ')}
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
            Comisión total del filtro actual (solo ventas completadas y deliveries entregados): <strong style={{ color: 'var(--color-text)' }}>{formatCurrency(totalComisionPreview)}</strong>
          </div>

          <div className="tabla-scroll" style={{ overflowX: 'auto' }}>
            <table className="responsive-stack tabla-fija">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cliente</th>
                  <th>Vendedor</th>
                  <th>Tipo</th>
                  <th>Precios</th>
                  <th>Cantidad</th>
                  <th>Precio producto</th>
                  <th>Precio envío</th>
                  <th>Total</th>
                  <th>Comisión</th>
                  <th>Forma de pago</th>
                  <th>Estado</th>
                  <th>Envío</th>
                  <th>Courier</th>
                  <th>Fecha creación</th>
                  <th>En camino / Retirado</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.length === 0 ? (
                  <tr>
                    <td colSpan={16} style={{ color: 'var(--color-text-muted)' }}>Sin ventas que coincidan con los filtros</td>
                  </tr>
                ) : (
                  displayRows.map((s, i) => (
                    <tr key={`${s.id}-${s._pagoLabel}-${i}`}>
                      <td data-label="Producto">{s.product_name}</td>
                      <td data-label="Cliente">{s.client_name}</td>
                      <td data-label="Vendedor">{s.vendor_name}</td>
                      <td data-label="Tipo">
                        <Badge label={tipoVentaLabel(s.tipo_venta)} color={TIPO_VENTA_LABELS[s.tipo_venta]?.color} />
                      </td>
                      <td data-label="Precios"><Badge label={priceTypeLabel(s.price_type)} color={PRICE_TYPE_LABELS[s.price_type]?.color} /></td>
                      <td data-label="Cantidad">{s.quantity}</td>
                      <td data-label="Precio producto">{filters.formaPago.length === 0 && s.precio_producto !== null && s.precio_producto !== undefined ? formatCurrency(s.precio_producto) : '-'}</td>
                      <td data-label="Precio envío">{filters.formaPago.length === 0 && s.precio_envio !== null && s.precio_envio !== undefined ? formatCurrency(s.precio_envio) : '-'}</td>
                      <td data-label="Total">{formatCurrency(s._displayTotal)}</td>
                      <td data-label="Comisión">{cuentaParaComision(s) && s.comision !== null && s.comision !== undefined ? formatCurrency(s.comision) : '-'}</td>
                      <td data-label="Forma de pago">{s._pagoLabel}</td>
                      <td data-label="Estado">
                        <Badge label={saleStatusLabel(s.status)} color={SALE_STATUS_LABELS[s.status]?.color} />
                      </td>
                      <td data-label="Envío">
                        {['ENVIO', 'ENVIO_PREPAGADO', 'ENVIO_REGION'].includes(s.tipo_venta) ? (
                          <Badge label={deliveryStatusLabel(s.delivery_status)} color={DELIVERY_STATUS_LABELS[s.delivery_status]?.color} />
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)' }}>-</span>
                        )}
                      </td>
                      <td data-label="Courier">
                        {TIPOS_ENVIO.includes(s.tipo_venta)
                          ? (s.courier_name || <span style={{ color: 'var(--color-text-muted)' }}>Sin asignar</span>)
                          : <span style={{ color: 'var(--color-text-muted)' }}>-</span>}
                      </td>
                      <td data-label="Fecha creación">{formatDate(fechaRegistro(s))}</td>
                      <td data-label="En camino / Retirado">{formatDate(fechaSalida(s))}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {confirmDialog}
    </Layout>
  );
}
