import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import Badge from '../components/Badge';
import Pagination from '../components/Pagination';
import SearchableSelect from '../components/SearchableSelect';
import useFetch from '../hooks/useFetch';
import useApi from '../hooks/useApi';
import useAuth from '../hooks/useAuth';
import useDebouncedValue from '../hooks/useDebouncedValue';
import { formatCurrency, formatDate } from '../utils/format';

const PAGE_SIZE = 25;
const emptyForm = { client_name: '', notes: '' };

export default function RetiroTiendaPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canManage = user.role === 'operador' || user.role === 'admin';
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const { data, loading, error, refetch } = useFetch(
    `/api/retiros-tienda?page=${page}&limit=${PAGE_SIZE}&search=${encodeURIComponent(debouncedSearch)}`,
    { deps: [page, debouncedSearch] }
  );
  const { data: productsData } = useFetch('/api/products');
  const { post, loading: saving, error: saveError } = useApi();

  function handleSearchChange(value) {
    setSearch(value);
    setPage(1);
  }

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedQty, setSelectedQty] = useState(1);
  const [cart, setCart] = useState([]);
  const [successMsg, setSuccessMsg] = useState('');

  const total = cart.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const productOptions = useMemo(
    () => (productsData?.products || []).map((p) => ({ value: p.id, label: `${p.title} · ${formatCurrency(p.price)}${p.agotado ? ' (agotado)' : ''}` })),
    [productsData]
  );

  function addToCart() {
    const product = productsData?.products.find((p) => String(p.id) === selectedProductId);
    if (!product || selectedQty < 1) return;
    setCart((prev) => [
      ...prev,
      { key: Date.now(), product_id: product.id, product_name: product.title, price: Number(product.price), quantity: Number(selectedQty) },
    ]);
    setSelectedProductId('');
    setSelectedQty(1);
  }

  function removeFromCart(key) {
    setCart((prev) => prev.filter((item) => item.key !== key));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSuccessMsg('');
    if (!form.client_name || cart.length === 0) return;

    const payload = {
      client_name: form.client_name,
      items: cart.map(({ product_id, quantity }) => ({ product_id, quantity })),
      notes: form.notes,
    };

    const result = await post('/api/retiros-tienda', payload);
    if (result.success) {
      setSuccessMsg(`Retiro registrado: ${cart.length} producto(s), total ${formatCurrency(total)}`);
      setForm(emptyForm);
      setCart([]);
      setShowForm(false);
      refetch();
    }
  }

  function procesarEnCaja(retiro) {
    navigate('/caja', {
      state: {
        retiroId: retiro.id,
        vendorId: retiro.vendor_id,
        clientId: retiro.client_id,
        clientName: retiro.client_name,
        items: retiro.items,
      },
    });
  }

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>Retiro en Tienda</h1>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 4, marginBottom: 0, fontSize: 13 }}>
            Propuestas de venta para clientes que pasarán a retirar. No cuentan como venta hasta que se procesan en Caja al entregar.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <input
            placeholder="Buscar por cliente, vendedor o producto..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--color-border)', width: 260, background: 'var(--color-surface)', color: 'var(--color-text)' }}
          />
          <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancelar' : 'Registrar Retiro En Tienda'}
          </button>
        </div>
      </div>

      {successMsg && <div className="card" style={{ padding: 16, marginBottom: 20, color: 'var(--color-success)' }}>{successMsg}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="card" style={{ padding: 20, marginBottom: 24 }}>
          {saveError && <div className="alert alert-error">{saveError}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <div className="form-field">
                <label>Vendedor</label>
                <input value={user.name} disabled />
              </div>
              <div className="form-field">
                <label>Cliente</label>
                <input
                  placeholder="Nombre del cliente"
                  value={form.client_name}
                  onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                  required
                />
              </div>
              <div className="form-field">
                <label>Notas</label>
                <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={saving || cart.length === 0}>
                {saving ? 'Guardando...' : `Registrar retiro (${formatCurrency(total)})`}
              </button>
            </div>

            <div>
              <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Productos</h3>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <SearchableSelect
                    value={selectedProductId}
                    onChange={setSelectedProductId}
                    options={productOptions}
                    placeholder="Selecciona un producto"
                  />
                </div>
                <input type="number" min="1" value={selectedQty} onChange={(e) => setSelectedQty(e.target.value)} style={{ width: 70 }} />
                <button type="button" className="btn btn-secondary" onClick={addToCart} disabled={!selectedProductId}>
                  Agregar
                </button>
              </div>

              <table className="responsive-stack">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cant.</th>
                    <th>Subtotal</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ color: 'var(--color-text-muted)' }}>Carrito vacío</td>
                    </tr>
                  ) : (
                    cart.map((item) => (
                      <tr key={item.key}>
                        <td data-label="Producto">{item.product_name}</td>
                        <td data-label="Cant.">{item.quantity}</td>
                        <td data-label="Subtotal">{formatCurrency(item.quantity * item.price)}</td>
                        <td data-label="Quitar">
                          <button type="button" className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => removeFromCart(item.key)}>
                            Quitar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div style={{ marginTop: 12, textAlign: 'right', fontSize: 16, fontWeight: 600 }}>
                Total: {formatCurrency(total)}
              </div>
            </div>
          </div>
        </form>
      )}

      {loading && (
        <div className="page-loading">
          <div className="spinner" />
        </div>
      )}
      {error && <div className="alert alert-error">{error}</div>}

      {data && (
        <div className="card" style={{ padding: 20 }}>
          <table className="responsive-stack">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Vendedor</th>
                <th>Productos</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Fecha</th>
                {canManage && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {data.retiros.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 7 : 6} style={{ color: 'var(--color-text-muted)' }}>Sin retiros en tienda registrados</td>
                </tr>
              ) : (
                data.retiros.map((r) => (
                  <tr key={r.id}>
                    <td data-label="Cliente">{r.client_name}</td>
                    <td data-label="Vendedor">{r.vendor_name}</td>
                    <td data-label="Productos" style={{ fontSize: 13 }}>
                      {r.items.map((i) => `${i.product_name} x${i.quantity}`).join(', ')}
                    </td>
                    <td data-label="Total">{formatCurrency(r.total)}</td>
                    <td data-label="Estado">
                      <Badge
                        label={r.status === 'entregado' ? 'Entregado' : 'Pendiente'}
                        color={r.status === 'entregado' ? 'var(--color-success)' : 'var(--color-warning)'}
                      />
                    </td>
                    <td data-label="Fecha">{formatDate(r.created_at)}</td>
                    {canManage && (
                      <td data-label="Acciones">
                        {r.status === 'pendiente' ? (
                          <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => procesarEnCaja(r)}>
                            Entregado
                          </button>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>-</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
        </div>
      )}
    </Layout>
  );
}
