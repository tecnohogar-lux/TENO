import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import Layout from '../components/Layout';
import Badge from '../components/Badge';
import useFetch from '../hooks/useFetch';
import { formatCurrency, formatDate } from '../utils/format';
import { SALE_STATUS_LABELS, DELIVERY_STATUS_LABELS, TIPO_VENTA_LABELS, saleStatusLabel, deliveryStatusLabel, tipoVentaLabel } from '../utils/labels';

const emptyFilters = { dateFrom: '', dateTo: '', nombre: '', producto: '', vendedor: '', cliente: '', canal: '' };

export default function ReportsPage() {
  const { data, loading, error } = useFetch('/api/sales');
  const [filters, setFilters] = useState(emptyFilters);
  const [exporting, setExporting] = useState(false);

  const productos = useMemo(() => [...new Set((data?.sales || []).map((s) => s.product_name))].sort(), [data]);
  const vendedores = useMemo(() => [...new Set((data?.sales || []).map((s) => s.vendor_name))].sort(), [data]);
  const clientes = useMemo(() => [...new Set((data?.sales || []).map((s) => s.client_name))].sort(), [data]);

  const filteredSales = useMemo(() => {
    let rows = data?.sales || [];

    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      rows = rows.filter((s) => new Date(s.created_at) >= from);
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
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
        Estado: saleStatusLabel(s.status),
        Envío: ['ENVIO', 'ENVIO_PREPAGADO', 'ENVIO_REGION'].includes(s.tipo_venta) ? deliveryStatusLabel(s.delivery_status) : '-',
        Fecha: formatDate(s.created_at),
      }));

      const sheet = XLSX.utils.json_to_sheet(rows);
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>Vista previa · {filteredSales.length} venta(s)</h3>
            <button className="btn btn-primary" onClick={handleExport} disabled={exporting || filteredSales.length === 0}>
              {exporting ? 'Generando...' : 'Exportar a Excel'}
            </button>
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
                  <th>Estado</th>
                  <th>Envío</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ color: 'var(--color-text-muted)' }}>Sin ventas que coincidan con los filtros</td>
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
