import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import useFetch from '../hooks/useFetch';
import useApi from '../hooks/useApi';
import { formatCurrency } from '../utils/format';

const emptyNewClient = { name: '', address: '', phone: '', email: '' };

export default function CajaPage() {
  const navigate = useNavigate();
  const { data: usersData } = useFetch('/api/users');
  const { data: clientsData } = useFetch('/api/clients');
  const { data: productsData } = useFetch('/api/products');
  const { data: shippingCostsData } = useFetch('/api/shipping-costs');
  const { post, loading: saving, error: saveError } = useApi();

  const vendedores = (usersData?.users || []).filter((u) => u.role === 'vendedor' && u.is_active);

  const [tipo, setTipo] = useState('TIENDA');
  const [vendorId, setVendorId] = useState('');
  const [useExistingClient, setUseExistingClient] = useState(true);
  const [clientId, setClientId] = useState('');
  const [newClient, setNewClient] = useState(emptyNewClient);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedQty, setSelectedQty] = useState(1);
  const [freeProduct, setFreeProduct] = useState({ name: '', price: '', quantity: 1 });
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [transferenciaVerificada, setTransferenciaVerificada] = useState(false);
  const [notes, setNotes] = useState('');
  const [address, setAddress] = useState('');
  const [comuna, setComuna] = useState('');
  const [phone, setPhone] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const isEnvioPrepagado = tipo === 'ENVIO_PREPAGADO';
  const precioEnvio = comuna ? (shippingCostsData?.costos || []).find((c) => c.comuna === comuna)?.precio || 0 : 0;
  const precioProductos = cart.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const total = precioProductos + (isEnvioPrepagado ? Number(precioEnvio) : 0);

  function addToCart() {
    if (isEnvioPrepagado && cart.length >= 1) return;

    if (selectedProductId === '__free__') {
      if (!freeProduct.name || !freeProduct.price || freeProduct.quantity < 1) return;
      setCart((prev) => [
        ...prev,
        { key: Date.now(), product_name: freeProduct.name, price: Number(freeProduct.price), quantity: Number(freeProduct.quantity) },
      ]);
      setFreeProduct({ name: '', price: '', quantity: 1 });
      setSelectedProductId('');
      return;
    }

    const product = productsData?.products.find((p) => String(p.id) === selectedProductId);
    if (!product || selectedQty < 1) return;
    setCart((prev) => [
      ...prev,
      { key: Date.now(), product_name: product.title, price: Number(product.price), quantity: Number(selectedQty) },
    ]);
    setSelectedProductId('');
    setSelectedQty(1);
  }

  const canAddToCart = (isEnvioPrepagado ? cart.length < 1 : true) && (
    selectedProductId === '__free__' ? freeProduct.name && freeProduct.price : !!selectedProductId
  );

  function removeFromCart(key) {
    setCart((prev) => prev.filter((item) => item.key !== key));
  }

  function handleTipoChange(nextTipo) {
    setTipo(nextTipo);
    if (nextTipo === 'ENVIO_PREPAGADO' && cart.length > 1) {
      setCart((prev) => prev.slice(0, 1));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSuccessMsg('');

    if (!vendorId || cart.length === 0) return;
    if (isEnvioPrepagado && (!address || !comuna)) return;

    const payload = {
      tipo,
      vendor_id: Number(vendorId),
      items: cart.map(({ product_name, price, quantity }) => ({ product_name, price, quantity })),
      payment_method: paymentMethod,
      transferencia_verificada: paymentMethod === 'transferencia' ? transferenciaVerificada : false,
      notes,
    };

    if (isEnvioPrepagado) {
      payload.address = address;
      payload.comuna = comuna;
      payload.phone = phone;
    }

    if (useExistingClient) {
      payload.client_id = Number(clientId);
    } else {
      payload.client = newClient;
    }

    const result = await post('/api/caja/sale', payload);
    if (result.success) {
      setSuccessMsg(
        isEnvioPrepagado
          ? `Envío prepagado registrado. Total ${formatCurrency(total)}`
          : `Venta registrada: ${result.data.sales.length} producto(s), total ${formatCurrency(total)}`
      );
      setCart([]);
      setNewClient(emptyNewClient);
      setClientId('');
      setNotes('');
      setAddress('');
      setComuna('');
      setPhone('');
      setTransferenciaVerificada(false);
    }
  }

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Caja</h1>
        <button className="btn btn-secondary" onClick={() => navigate('/sales')}>Ver ventas</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, maxWidth: 420 }}>
        <button type="button" className={tipo === 'TIENDA' ? 'btn btn-primary' : 'btn btn-secondary'} style={{ flex: 1 }} onClick={() => handleTipoChange('TIENDA')}>
          Tienda
        </button>
        <button type="button" className={isEnvioPrepagado ? 'btn btn-primary' : 'btn btn-secondary'} style={{ flex: 1 }} onClick={() => handleTipoChange('ENVIO_PREPAGADO')}>
          Envío prepagado
        </button>
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

          {isEnvioPrepagado && (
            <>
              <div className="form-field">
                <label>Comuna</label>
                <select value={comuna} onChange={(e) => setComuna(e.target.value)} required>
                  <option value="">Selecciona una comuna</option>
                  {(shippingCostsData?.costos || []).map((c) => (
                    <option key={c.id} value={c.comuna}>{c.comuna} · {formatCurrency(c.precio)}</option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Dirección</label>
                <input value={address} onChange={(e) => setAddress(e.target.value)} required />
              </div>
              <div className="form-field">
                <label>Teléfono</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </>
          )}

          <div className="form-field">
            <label>Forma de pago</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} required>
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="transferencia">Transferencia</option>
              <option value="link_pago">Link de pago</option>
            </select>
          </div>

          {paymentMethod === 'transferencia' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 16 }}>
              <input type="checkbox" checked={transferenciaVerificada} onChange={(e) => setTransferenciaVerificada(e.target.checked)} />
              Transferencia verificada
            </label>
          )}

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
          {isEnvioPrepagado && <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 0 }}>Un envío prepagado admite un solo producto.</p>}

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: selectedProductId === '__free__' ? 8 : 0 }}>
              <select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)} style={{ flex: 1 }} disabled={isEnvioPrepagado && cart.length >= 1}>
                <option value="">Selecciona un producto</option>
                <option value="__free__">Producto libre (no registrado)</option>
                {(productsData?.products || []).map((p) => (
                  <option key={p.id} value={p.id}>{p.title} · {formatCurrency(p.price)}{p.agotado ? ' (agotado)' : ''}</option>
                ))}
              </select>
              {selectedProductId !== '__free__' && (
                <input type="number" min="1" value={selectedQty} onChange={(e) => setSelectedQty(e.target.value)} style={{ width: 70 }} disabled={isEnvioPrepagado && cart.length >= 1} />
              )}
              <button type="button" className="btn btn-secondary" onClick={addToCart} disabled={!canAddToCart}>
                Agregar
              </button>
            </div>

            {selectedProductId === '__free__' && (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  placeholder="Nombre del producto"
                  value={freeProduct.name}
                  onChange={(e) => setFreeProduct({ ...freeProduct, name: e.target.value })}
                  style={{ flex: 2 }}
                />
                <input
                  type="number"
                  min="0"
                  placeholder="Precio unitario"
                  value={freeProduct.price}
                  onChange={(e) => setFreeProduct({ ...freeProduct, price: e.target.value })}
                  style={{ flex: 1 }}
                />
                <input
                  type="number"
                  min="1"
                  placeholder="Cant."
                  value={freeProduct.quantity}
                  onChange={(e) => setFreeProduct({ ...freeProduct, quantity: e.target.value })}
                  style={{ width: 70 }}
                />
              </div>
            )}
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

          <div style={{ marginTop: 16, textAlign: 'right', fontSize: 14 }}>
            {isEnvioPrepagado && (
              <>
                <div style={{ color: 'var(--color-text-muted)' }}>Productos: {formatCurrency(precioProductos)}</div>
                <div style={{ color: 'var(--color-text-muted)' }}>Envío: {formatCurrency(precioEnvio)}</div>
              </>
            )}
            <div style={{ fontSize: 16, fontWeight: 600 }}>Total: {formatCurrency(total)}</div>
          </div>
        </div>
      </form>
    </Layout>
  );
}
