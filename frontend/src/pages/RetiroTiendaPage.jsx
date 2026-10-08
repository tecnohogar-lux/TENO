import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import Badge from '../components/Badge';
import Pagination from '../components/Pagination';
import TablaCompacta from '../components/TablaCompacta';
import VistaToggle from '../components/VistaToggle';
import useVistaCompacta from '../hooks/useVistaCompacta';
import SearchableSelect from '../components/SearchableSelect';
import PriceTypeToggle from '../components/PriceTypeToggle';
import useFetch from '../hooks/useFetch';
import useApi from '../hooks/useApi';
import useAuth from '../hooks/useAuth';
import useConfirm from '../hooks/useConfirm';
import useDebouncedValue from '../hooks/useDebouncedValue';
import { formatCurrency, formatDate } from '../utils/format';
import PriceTypeBadge from '../components/PriceTypeBadge';
import { showNewSale } from '../store/useNuevaVentaStore';
import { MIN_MAYOR, productPrice } from '../utils/priceType';

const PAGE_SIZE = 25;
const emptyForm = { nombre: '', apellido: '', notes: '' };

export default function RetiroTiendaPage() {
  const { user } = useAuth();
  // Vista completa (todos los datos) o compacta (cliente, vendedor, producto y día/mes). Se recuerda.
  const [compacta, cambiarVista] = useVistaCompacta('teno_retiros_vista');
  const navigate = useNavigate();
  const canManage = user.role === 'operador' || user.role === 'admin' || user.role === 'caja';
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const { data, loading, error, refetch } = useFetch(
    `/api/retiros-tienda?page=${page}&limit=${PAGE_SIZE}&search=${encodeURIComponent(debouncedSearch)}`,
    { deps: [page, debouncedSearch] }
  );
  const { data: productsData } = useFetch('/api/products/catalog');
  const { post, put, del, loading: saving, error: saveError } = useApi();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [editingRetiro, setEditingRetiro] = useState(null);
  const [actionError, setActionError] = useState('');

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
  // Tipo de precio del próximo producto que se agregue (cada línea guarda el suyo).
  // En Retiro en Tienda el valor por defecto es MARKETPLACE.
  const [priceType, setPriceType] = useState('marketplace');
  const [mayorPrice, setMayorPrice] = useState('');

  const total = cart.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const productOptions = useMemo(
    () => (productsData?.products || []).map((p) => ({ value: p.id, label: priceType === 'mayor' ? `${p.title}${p.agotado ? ' (agotado)' : ''}` : `${p.title} · ${formatCurrency(productPrice(p, priceType))}${p.agotado ? ' (agotado)' : ''}` })),
    [productsData, priceType]
  );

  function addToCart() {
    const product = productsData?.products.find((p) => String(p.id) === selectedProductId);
    if (!product || selectedQty < 1) return;
    if (priceType === 'mayor' && (Number(selectedQty) < MIN_MAYOR || !(Number(mayorPrice) > 0))) return;
    setCart((prev) => [
      ...prev,
      { key: Date.now(), product_id: product.id, product_name: product.title, price: priceType === 'mayor' ? Number(mayorPrice) : productPrice(product, priceType), quantity: Number(selectedQty), price_type: priceType },
    ]);
    setSelectedProductId('');
    setSelectedQty(priceType === 'mayor' ? MIN_MAYOR : 1);
    setMayorPrice('');
  }

  function handlePriceTypeChange(next) {
    setPriceType(next);
    if (next === 'mayor') setSelectedQty((q) => Math.max(Number(q) || 0, MIN_MAYOR));
  }

  function removeFromCart(key) {
    setCart((prev) => prev.filter((item) => item.key !== key));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSuccessMsg('');
    if (!form.nombre.trim() || !form.apellido.trim() || cart.length === 0) return;

    const payload = {
      client_name: `${form.nombre.trim()} ${form.apellido.trim()}`,
      items: cart.map(({ product_id, quantity, price_type, price }) => ({ product_id, quantity, price_type, price })),
      notes: form.notes,
    };

    const result = editingRetiro
      ? await put(`/api/retiros-tienda/${editingRetiro.id}`, payload)
      : await post('/api/retiros-tienda', payload);
    if (result.success) {
      // Animación de "¡Nueva venta!" para el vendedor que registra un retiro nuevo
      if (!editingRetiro && user.role === 'vendedor') {
        const retiro = result.data?.retiro;
        showNewSale({ type: 'retiro', seller: user.name, orderId: retiro?.id, total: Number(retiro?.total ?? total) });
      }
      setSuccessMsg(editingRetiro
        ? 'Retiro actualizado correctamente'
        : `Retiro registrado: ${cart.length} producto(s), total ${formatCurrency(total)}`);
      closeForm();
      refetch();
    }
  }

  function closeForm() {
    setForm(emptyForm);
    setCart([]);
    setEditingRetiro(null);
    setPriceType('marketplace');
    setShowForm(false);
  }

  function openEdit(retiro) {
    setSuccessMsg('');
    setActionError('');
    setEditingRetiro(retiro);
    const [nombre, ...resto] = (retiro.client_name || '').split(' ');
    setForm({ nombre: nombre || '', apellido: resto.join(' '), notes: retiro.notes || '' });
    setCart(retiro.items.map((i, idx) => ({ key: `${retiro.id}-${idx}`, product_id: i.product_id, product_name: i.product_name, price: Number(i.price), quantity: Number(i.quantity), price_type: i.price_type || retiro.price_type || 'marketplace' })));
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDelete(retiro) {
    setSuccessMsg('');
    setActionError('');
    const aviso = retiro.status === 'entregado' ? ' Ya fue entregado: la venta registrada en Caja no se elimina.' : '';
    const ok = await confirm(`¿Eliminar el retiro de "${retiro.client_name}"?${aviso}`, { title: 'Eliminar retiro', confirmLabel: 'Eliminar', danger: true });
    if (!ok) return;
    const result = await del(`/api/retiros-tienda/${retiro.id}`);
    if (result.success) refetch();
    else if (result.error) setActionError(result.error);
  }

  function procesarEnCaja(retiro) {
    navigate('/caja', {
      state: {
        retiroId: retiro.id,
        priceType: retiro.price_type,
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
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <input
            placeholder="Buscar por cliente, vendedor o producto..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--color-border)', width: 260, background: 'var(--color-surface)', color: 'var(--color-text)' }}
          />
          <button className="btn btn-primary" onClick={() => (showForm ? closeForm() : setShowForm(true))}>
            {showForm ? 'Cancelar' : 'Registrar Retiro En Tienda'}
          </button>
        </div>
      </div>

      {actionError && <div className="alert alert-error">{actionError}</div>}
      {successMsg && <div className="card" style={{ padding: 16, marginBottom: 20, color: 'var(--color-success)' }}>{successMsg}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="card" style={{ padding: 20, marginBottom: 24 }}>
          {editingRetiro?.status === 'entregado' && (
            <div className="alert alert-error">Este retiro ya fue entregado: los cambios no modifican la venta ya registrada en Caja.</div>
          )}
          {saveError && <div className="alert alert-error">{saveError}</div>}
          <div className="form-grid-2" style={{ gap: 20 }}>
            <div>
              <div className="form-field">
                <label>Vendedor</label>
                <input value={editingRetiro ? editingRetiro.vendor_name : user.name} disabled />
              </div>
              <div className="form-field">
                <label>Cliente</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input placeholder="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required style={{ flex: 1, minWidth: 0 }} />
                  <input placeholder="Apellido" value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} required style={{ flex: 1, minWidth: 0 }} />
                </div>
              </div>
              <div className="form-field">
                <label>Notas</label>
                <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={saving || cart.length === 0}>
                {saving ? 'Guardando...' : `${editingRetiro ? 'Guardar cambios' : 'Registrar retiro'} (${formatCurrency(total)})`}
              </button>
            </div>

            <div>
              <PriceTypeToggle value={priceType} onChange={handlePriceTypeChange} allowMayor hideSol={user.role === 'vendedor'} />
              {priceType === 'mayor' && (
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: -4 }}>
                  Venta al mayor: mínimo {MIN_MAYOR} unidades por producto y precio libre.
                </p>
              )}
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
                <input type="number" min={priceType === 'mayor' ? MIN_MAYOR : 1} value={selectedQty} onChange={(e) => setSelectedQty(e.target.value)} style={{ width: 70 }} />
                <button
                  type="button"
                  className="btn btn-add"
                  onClick={addToCart}
                  disabled={!selectedProductId || (priceType === 'mayor' && (Number(selectedQty) < MIN_MAYOR || !(Number(mayorPrice) > 0)))}
                >
                  Agregar
                </button>
              </div>

              {priceType === 'mayor' && selectedProductId && (
                <input
                  type="number"
                  min="0"
                  placeholder="Precio unitario (libre)"
                  value={mayorPrice}
                  onChange={(e) => setMayorPrice(e.target.value)}
                  style={{ width: '100%', marginBottom: 16 }}
                />
              )}

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
                        <td data-label="Producto">{item.product_name} <PriceTypeBadge type={item.price_type} /></td>
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

      <VistaToggle compacta={compacta} onChange={cambiarVista} />

      {data && compacta && (
        <div className="card" style={{ padding: 20 }}>
          <TablaCompacta rows={data.retiros} vacio="Sin retiros en tienda registrados" />
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
        </div>
      )}

      {data && !compacta && (
        <div className="card" style={{ padding: 20 }}>
          <table className="responsive-stack">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Vendedor</th>
                <th>Productos</th>
                <th>Total</th>
                <th>Precios</th>
                <th>Estado</th>
                <th>Fecha</th>
                {canManage && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {data.retiros.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 8 : 7} style={{ color: 'var(--color-text-muted)' }}>Sin retiros en tienda registrados</td>
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
                    <td data-label="Precios">
                      <PriceTypeBadge type={r.price_type} />
                    </td>
                    <td data-label="Estado">
                      {r.status ? (
                        <Badge
                          label={r.status === 'entregado' ? 'Entregado' : 'Pendiente'}
                          color={r.status === 'entregado' ? 'var(--color-success)' : 'var(--color-warning)'}
                        />
                      ) : (
                        // Retiro de otro vendedor: el estado en tienda es privado de su dueño.
                        <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                      )}
                    </td>
                    <td data-label="Fecha">{formatDate(r.created_at)}</td>
                    {canManage && (
                      <td data-label="Acciones">
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {r.status === 'pendiente' && (
                            <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => procesarEnCaja(r)}>
                              Entregado
                            </button>
                          )}
                          <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => openEdit(r)}>
                            Editar
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '6px 10px', fontSize: 12, color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                            onClick={() => handleDelete(r)}
                          >
                            Eliminar
                          </button>
                        </div>
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
      {confirmDialog}
    </Layout>
  );
}
