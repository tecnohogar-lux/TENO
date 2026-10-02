import { useState } from 'react';
import Layout from '../components/Layout';
import Pagination from '../components/Pagination';
import MetricsCard from '../components/MetricsCard';
import useFetch from '../hooks/useFetch';
import useApi from '../hooks/useApi';
import useConfirm from '../hooks/useConfirm';
import { formatCurrency, formatDate } from '../utils/format';

const PAGE_SIZE = 25;
const emptyForm = { nombre: '', monto: '' };

// Egresos (gastos) e ingresos a caja comparten pantalla y comportamiento; solo cambian
// el endpoint y los textos. Los ingresos son efectivo que entra a la caja abierta sin
// venta asociada (pagos de deudas, abonos...), así que no generan comisión ni costo.
const TIPOS = {
  egresos: {
    endpoint: '/api/gastos',
    listKey: 'gastos',
    title: 'Gastos y egresos',
    totalLabel: 'Total gastado',
    newLabel: 'Nuevo gasto',
    submitLabel: 'Registrar gasto',
    emptyLabel: 'Sin gastos registrados',
    deleteTitle: 'Eliminar gasto',
    deleteWhat: 'el gasto',
  },
  ingresos: {
    endpoint: '/api/ingresos',
    listKey: 'ingresos',
    title: 'Ingresos a caja',
    totalLabel: 'Total ingresado',
    newLabel: 'Nuevo ingreso',
    submitLabel: 'Registrar ingreso',
    emptyLabel: 'Sin ingresos registrados',
    deleteTitle: 'Eliminar ingreso',
    deleteWhat: 'el ingreso',
  },
};

export default function GastosPage() {
  const [tipo, setTipo] = useState('egresos');
  const t = TIPOS[tipo];
  const [page, setPage] = useState(1);
  const { data, loading, error, refetch } = useFetch(`${t.endpoint}?page=${page}&limit=${PAGE_SIZE}`, { deps: [t.endpoint, page] });
  const { post, del, loading: saving, error: saveError } = useApi();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const rows = data?.[t.listKey];

  function switchTipo(next) {
    setTipo(next);
    setPage(1);
    setShowForm(false);
    setForm(emptyForm);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const result = await post(t.endpoint, form);
    if (result.success) {
      setForm(emptyForm);
      setShowForm(false);
      refetch();
    }
  }

  async function handleDelete(row) {
    const ok = await confirm(`¿Eliminar ${t.deleteWhat} "${row.nombre}"?`, { title: t.deleteTitle, confirmLabel: 'Eliminar', danger: true });
    if (!ok) return;
    const result = await del(`${t.endpoint}/${row.id}`);
    if (result.success) refetch();
  }

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>{t.title}</h1>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancelar' : t.newLabel}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, maxWidth: 360 }}>
        <button type="button" className={tipo === 'egresos' ? 'btn btn-primary' : 'btn btn-secondary'} style={{ flex: 1 }} onClick={() => switchTipo('egresos')}>
          Egresos
        </button>
        <button type="button" className={tipo === 'ingresos' ? 'btn btn-primary' : 'btn btn-secondary'} style={{ flex: 1 }} onClick={() => switchTipo('ingresos')}>
          Ingresos
        </button>
      </div>

      {tipo === 'ingresos' && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: 0, marginBottom: 20 }}>
          Dinero que entra a la caja abierta sin pertenecer a una venta (pago de deudas, abonos, etc.). Suma al efectivo esperado del cierre de caja y no genera comisiones ni costos.
        </p>
      )}

      {data && (
        <div style={{ marginBottom: 24 }}>
          <MetricsCard label={t.totalLabel} value={formatCurrency(data.total_monto)} />
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="card" style={{ padding: 20, marginBottom: 24 }}>
          {saveError && <div className="alert alert-error">{saveError}</div>}
          <div className="form-grid-2" style={{ gap: 16, gridTemplateColumns: '1fr 200px' }}>
            <div className="form-field">
              <label>Nombre</label>
              <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>Monto</label>
              <input type="number" min="1" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} required />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: 12 }}>
            {saving ? 'Guardando...' : t.submitLabel}
          </button>
        </form>
      )}

      {loading && (
        <div className="page-loading">
          <div className="spinner" />
        </div>
      )}
      {error && <div className="alert alert-error">{error}</div>}

      {data && rows && (
        <div className="card" style={{ padding: 20 }}>
          <table className="responsive-stack">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Monto</th>
                <th>Registrado por</th>
                <th>Fecha</th>
                <th style={{ width: 100 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ color: 'var(--color-text-muted)' }}>{t.emptyLabel}</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Nombre">{row.nombre}</td>
                    <td data-label="Monto">{formatCurrency(row.monto)}</td>
                    <td data-label="Registrado por">{row.created_by_name || '-'}</td>
                    <td data-label="Fecha">{formatDate(row.created_at)}</td>
                    <td data-label="Acciones">
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '6px 10px', fontSize: 12, color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                        onClick={() => handleDelete(row)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
        </div>
      )}

      {confirmDialog}
    </Layout>
  );
}
