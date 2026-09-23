import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import Layout from '../components/Layout';
import Badge from '../components/Badge';
import useFetch from '../hooks/useFetch';
import useApi from '../hooks/useApi';
import useAuth from '../hooks/useAuth';
import { formatCurrency, formatDate } from '../utils/format';
import { SALE_STATUS_LABELS, DELIVERY_STATUS_LABELS, TIPO_VENTA_LABELS, saleStatusLabel, deliveryStatusLabel, tipoVentaLabel } from '../utils/labels';

const emptyFilters = { dateFrom: '', dateTo: '', nombre: '', producto: '', vendedor: '', cliente: '', canal: '' };

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
  const canManage = user.role === 'operador' || user.role === 'admin';
  const { data, loading, error } = useFetch('/api/sales');
  const [filters, setFilters] = useState(emptyFilters);
  const [exporting, setExporting] = useState(false);

  const { get: getComisiones, loading: loadingComisiones, error: comisionesError } = useApi();
  const today = new Date().toISOString().slice(0, 10);
  const [comisionesRango, setComisionesRango] = useState({ desde: today, hasta: today });
  const [comisionesResult, setComisionesResult] = useState(null);

  async function handleCalcularComisiones() {
    setComisionesResult(null);
    const result = await getComisiones(`/api/sales/comisiones?desde=${comisionesRango.desde}&hasta=${comisionesRango.hasta}`);
    if (result.success) setComisionesResult(result.data);
  }

  const productos = useMemo(() => [...new Set((data?.sales || []).map((s) => s.product_name))].sort(), [data]);
  const vendedores = useMemo(() => [...new Set((data?.sales || []).map((s) => s.vendor_name))].sort(), [data]);
  const clientes = useMemo(() => [...new Set((data?.sales || []).map((s) => s.client_name))].sort(), [data]);

  const filteredSales = useMemo(() => {
    let rows = data?.sales || [];

    if (filters.dateFrom) {
      const from = parseLocalDayBoundary(filters.dateFrom);
      rows = rows.filter((s) => new Date(s.created_at) >= from);
    }
    if (filters.dateTo) {
      const to = parseLocalDayBoundary(filters.dateTo, true);
      rows = rows.filter((s) => new Date(s.created_at) <= to);
    }

    const term = filters.nombre.trim().toLowerCase();
    if (term) {
      rows = rows.filter((s) =>
        s.product_name?.toLowerCase().includes(term) ||
        s.client_name?.toLowerCase().includes(term) ||
        s.vendor_name?.toLowerCase().includes(term)
      );
    }

    if (filters.producto) rows = rows.filter((s) => s.product_name === filters.producto);
    if (filters.vendedor) rows = rows.filter((s) => s.vendor_name === filters.vendedor);
    if (filters.cliente) rows = rows.filter((s) => s.client_name === filters.cliente);
    if (filters.canal) rows = rows.filter((s) => s.tipo_venta === filters.canal);

    return rows;
  }, [data, filters]);

  function setDia(value) {
    setFilters({ ...filters, dateFrom: value, dateTo: value });
  }

  const totalComisionPreview = useMemo(
    () => filteredSales.reduce((acc, s) => acc + (s.comision !== null && s.comision !== undefined ? Number(s.comision) : 0), 0),
    [filteredSales]
  );

  const hasActiveFilters = Object.values(filters).some((v) => v !== '');

  function clearFilters() {
    setFilters(emptyFilters);
  }

  function handleExport() {
    setExporting(true);
    try {
      const rows = filteredSales.map((s) => ({
        Producto: s.product_name,
        Cliente: s.client_name,
        Vendedor: s.vendor_name,
        Tipo: tipoVentaLabel(s.tipo_venta),
        Cantidad: s.quantity,
        'Precio producto': s.precio_producto !== null && s.precio_producto !== undefined ? Number(s.precio_producto) : '',
        'Precio envío': s.precio_envio !== null && s.precio_envio !== undefined ? Number(s.precio_envio) : '',
        Total: Number(s.total),
        Comisión: s.comision !== null && s.comision !== undefined ? Number(s.comision) : '',
        Estado: saleStatusLabel(s.status),
        Envío: ['ENVIO', 'ENVIO_PREPAGADO', 'ENVIO_REGION'].includes(s.tipo_venta) ? deliveryStatusLabel(s.delivery_status) : '-',
        Fecha: formatDate(s.created_at),
      }));

      // Ventas viejas (previas al desglose precio_producto/precio_envio) solo
      // tienen "total" sin separar; ante la falta de desglose se asume que todo
      // el monto es de producto (no hubo envío), para que las tres sumas nunca
      // pierdan dinero: total productos + total envíos siempre da el total real.
      let totalProductos = 0;
      let totalEnvios = 0;
      let totalComision = 0;
      for (const s of filteredSales) {
        const envio = s.precio_envio !== null && s.precio_envio !== undefined ? Number(s.precio_envio) : 0;
        const producto = s.precio_producto !== null && s.precio_producto !== undefined
          ? Number(s.precio_producto)
          : Number(s.total) - envio;
        totalProductos += producto;
        totalEnvios += envio;
        totalComision += s.comision !== null && s.comision !== undefined ? Number(s.comision) : 0;
      }
      const totalGeneral = totalProductos + totalEnvios;

      const sheet = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.sheet_add_aoa(
        sheet,
        [
          [],
          [
            'TOTALES', '', '', '', '',
            totalProductos || '',
            totalEnvios || '',
            totalGeneral || '',
            totalComision || '',
          ],
        ],
        { origin: -1 }
      );

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, 'Ventas');
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
                    <th>Total a pagar</th>
                  </tr>
                </thead>
                <tbody>
                  {comisionesResult.vendedores.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ color: 'var(--color-text-muted)' }}>Sin comisiones en ese rango de fechas</td>
                    </tr>
                  ) : (
                    comisionesResult.vendedores.map((v) => (
                      <tr key={v.vendor_id}>
                        <td data-label="Vendedor">{v.vendor_name}</td>
                        <td data-label="Ventas">{v.cantidad_ventas}</td>
                        <td data-label="Total a pagar">{formatCurrency(v.total_comision)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {comisionesResult.vendedores.length > 0 && (
                <div style={{ marginTop: 12, fontSize: 14, textAlign: 'right' }}>
                  Total general: <strong>{formatCurrency(comisionesResult.total_general)}</strong>
                </div>
              )}
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
          <div className="form-field">
            <label>Desde</label>
            <input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} />
          </div>
          <div className="form-field">
            <label>Hasta</label>
            <input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} />
          </div>
          <div className="form-field">
            <label>Día específico</label>
            <input type="date" value={filters.dateFrom === filters.dateTo ? filters.dateFrom : ''} onChange={(e) => setDia(e.target.value)} />
          </div>
          <div className="form-field">
            <label>Canal</label>
            <select value={filters.canal} onChange={(e) => setFilters({ ...filters, canal: e.target.value })}>
              <option value="">Todos</option>
              <option value="TIENDA">Tienda</option>
              <option value="ENVIO">Envío</option>
              <option value="ENVIO_PREPAGADO">Envío prepagado</option>
              <option value="ENVIO_REGION">Envío a región</option>
            </select>
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
            <select value={filters.producto} onChange={(e) => setFilters({ ...filters, producto: e.target.value })}>
              <option value="">Todos</option>
              {productos.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Vendedor</label>
            <select value={filters.vendedor} onChange={(e) => setFilters({ ...filters, vendedor: e.target.value })}>
              <option value="">Todos</option>
              {vendedores.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Cliente</label>
            <select value={filters.cliente} onChange={(e) => setFilters({ ...filters, cliente: e.target.value })}>
              <option value="">Todos</option>
              {clientes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
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
            <h3 style={{ margin: 0, fontSize: 15 }}>Vista previa · {filteredSales.length} venta(s)</h3>
            <button className="btn btn-primary" onClick={handleExport} disabled={exporting || filteredSales.length === 0}>
              {exporting ? 'Generando...' : 'Exportar a Excel'}
            </button>
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
            Comisión total del filtro actual: <strong style={{ color: 'var(--color-text)' }}>{formatCurrency(totalComisionPreview)}</strong>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="responsive-stack">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cliente</th>
                  <th>Vendedor</th>
                  <th>Tipo</th>
                  <th>Cantidad</th>
                  <th>Precio producto</th>
                  <th>Precio envío</th>
                  <th>Total</th>
                  <th>Comisión</th>
                  <th>Estado</th>
                  <th>Envío</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={12} style={{ color: 'var(--color-text-muted)' }}>Sin ventas que coincidan con los filtros</td>
                  </tr>
                ) : (
                  filteredSales.map((s) => (
                    <tr key={s.id}>
                      <td data-label="Producto">{s.product_name}</td>
                      <td data-label="Cliente">{s.client_name}</td>
                      <td data-label="Vendedor">{s.vendor_name}</td>
                      <td data-label="Tipo">
                        <Badge label={tipoVentaLabel(s.tipo_venta)} color={TIPO_VENTA_LABELS[s.tipo_venta]?.color} />
                      </td>
                      <td data-label="Cantidad">{s.quantity}</td>
                      <td data-label="Precio producto">{s.precio_producto !== null && s.precio_producto !== undefined ? formatCurrency(s.precio_producto) : '-'}</td>
                      <td data-label="Precio envío">{s.precio_envio !== null && s.precio_envio !== undefined ? formatCurrency(s.precio_envio) : '-'}</td>
                      <td data-label="Total">{formatCurrency(s.total)}</td>
                      <td data-label="Comisión">{s.comision !== null && s.comision !== undefined ? formatCurrency(s.comision) : '-'}</td>
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
                      <td data-label="Fecha">{formatDate(s.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Layout>
  );
}
