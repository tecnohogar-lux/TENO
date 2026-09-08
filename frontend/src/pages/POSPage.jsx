import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import useFetch from '../hooks/useFetch';
import useApi from '../hooks/useApi';
import { formatCurrency } from '../utils/format';

const emptyNewClient = { name: '', address: '', phone: '', email: '' };

export default function POSPage() {
  const navigate = useNavigate();
  const { data: usersData } = useFetch('/api/users');
  const { data: clientsData } = useFetch('/api/clients');
  const { data: productsData } = useFetch('/api/products');
  const { post, loading: saving, error: saveError } = useApi();

  const vendedores = (usersData?.users || []).filter((u) => u.role === 'vendedor' && u.is_active);

  const [vendorId, setVendorId] = useState('');
  const [useExistingClient, setUseExistingClient] = useState(true);
  const [clientId, setClientId] = useState('');
  const [newClient, setNewClient] = useState(emptyNewClient);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedQty, setSelectedQty] = useState(1);
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [notes, setNotes] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const total = cart.reduce((sum, item) => sum + item.quantity * item.price, 0);

  function addToCart() {
    const product = productsData?.products.find((p) => String(p.id) === selectedProductId);
    if (!product || selectedQty < 1) return;
    setCart((prev) => [
      ...prev,
      { key: Date.now(), product_name: product.title, price: Number(product.price), quantity: Number(selectedQty) },
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

    if (!vendorId || cart.length === 0) return;

    const payload = {
      vendor_id: Number(vendorId),
      items: cart.map(({ product_name, price, quantity }) => ({ product_name, price, quantity })),
      payment_method: paymentMethod,
      notes,
    };

    if (useExistingClient) {
      payload.client_id = Number(clientId);
    } else {
      payload.client = newClient;
    }

    const result = await post('/api/pos/sale', payload);
    if (result.success) {
      setSuccessMsg(`Venta registrada: ${result.data.sales.length} producto(s), total ${formatCurrency(total)}`);
      setCart([]);
      setNewClient(emptyNewClient);
      setClientId('');
      setNotes('');
    }
  }

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Punto de venta</h1>
        <button className="btn btn-secondary" onClick={() => navigate('/sales')}>Ver ventas</button>
      </div>

      {successMsg && <div className="card" style={{ padding: 16, marginBottom: 20, color: 'var(--color-success)' }}>{successMsg}</div>}
      {saveError && <div className="alert alert-error">{saveError}</div>}

      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>Datos de la venta</h3>

          <div className="form-field">
            <label>Vendedor</label>
            <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} required>
              <option value="">Selecciona un vendedor</option>
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Cliente</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button type="button" className={useExistingClient ? 'btn btn-primary' : 'btn btn-secondary'} style={{ flex: 1, padding: '8px' }} onClick={() => setUseExistingClient(true)}>
                Existente
              </button>
              <button type="button" className={!useExistingClient ? 'btn btn-primary' : 'btn btn-secondary'} style={{ flex: 1, padding: '8px' }} onClick={() => setUseExistingClient(false)}>
                Nuevo
              </button>
            </div>

            {useExistingClient ? (
              <select value={clientId} onChange={(e) => setClientId(e.target.value)} required={useExistingClient}>
                <option value="">Selecciona un cliente</option>
                {(clientsData?.clients || []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input placeholder="Nombre" value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} required={!useExistingClient} />
                <input placeholder="Teléfono" value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} />
                <input placeholder="Dirección" value={newClient.address} onChange={(e) => setNewClient({ ...newClient, address: e.target.value })} />
              </div>
            )}
          </div>

          <div className="form-field">
            <label>Forma de pago</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} required>
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="transferencia">Transferencia</option>
            </select>
          </div>

          <div className="form-field">
            <label>Notas</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={saving || cart.length === 0}>
            {saving ? 'Guardando...' : `Registrar venta (${formatCurrency(total)})`}
          </button>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>Productos</h3>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)} style={{ flex: 1 }}>
              <option value="">Selecciona un producto</option>
              {(productsData?.products || []).map((p) => (
                <option key={p.id} value={p.id}>{p.title} · {formatCurrency(p.price)}</option>
              ))}
            </select>
            <input type="number" min="1" value={selectedQty} onChange={(e) => setSelectedQty(e.target.value)} style={{ width: 70 }} />
            <button type="button" className="btn btn-secondary" onClick={addToCart} disabled={!selectedProductId}>
              Agregar
            </button>
          </div>

          <table>
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
                    <td>{item.product_name}</td>
                    <td>{item.quantity}</td>
                    <td>{formatCurrency(item.quantity * item.price)}</td>
                    <td>
                      <button type="button" className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => removeFromCart(item.key)}>
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div style={{ marginTop: 16, textAlign: 'right', fontSize: 16, fontWeight: 600 }}>
            Total: {formatCurrency(total)}
          </div>
        </div>
      </form>
    </Layout>
  );
}
