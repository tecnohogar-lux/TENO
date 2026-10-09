import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import VentasCajaHoy from '../components/VentasCajaHoy';
import SearchableSelect from '../components/SearchableSelect';
import PriceTypeToggle from '../components/PriceTypeToggle';
import PriceTypeBadge from '../components/PriceTypeBadge';
import useFetch from '../hooks/useFetch';
import useApi from '../hooks/useApi';
import { formatCurrency } from '../utils/format';
import { MIN_MAYOR, productPrice } from '../utils/priceType';
import { PAYMENT_METHODS, paymentMethodLabel } from '../utils/labels';

const FREE_PRODUCT_OPTION = [{ value: '__free__', label: 'Producto libre (no registrado)' }];

const emptyNewClient = { nombre: '', apellido: '' };

export default function CajaPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const retiro = location.state?.retiroId ? location.state : null;

  const { data: usersData } = useFetch('/api/users');
  const { data: productsData } = useFetch('/api/products/catalog');
  const { data: shippingCostsData } = useFetch('/api/shipping-costs');
  const { data: cajaActualData, loading: loadingCajaActual } = useFetch('/api/cash-register/current');
  const { post, loading: saving, error: saveError } = useApi();

  const cajaAbierta = !!cajaActualData?.caja;

  const vendedores = (usersData?.users || []).filter((u) => u.role === 'vendedor' && u.is_active);
  const vendorOptions = useMemo(() => vendedores.map((v) => ({ value: v.id, label: v.name })), [vendedores]);
  // Tipo de precio del próximo producto que se agregue (cada línea guarda el suyo).
  const [priceType, setPriceType] = useState('sol');
  const [mayorPrice, setMayorPrice] = useState('');
  const productOptions = useMemo(
    () => (productsData?.products || []).map((p) => ({ value: p.id, label: priceType === 'mayor' ? `${p.title}${p.agotado ? ' (agotado)' : ''}` : `${p.title} · ${formatCurrency(productPrice(p, priceType))}${p.agotado ? ' (agotado)' : ''}` })),
    [productsData, priceType]
  );

  const [retiroId, setRetiroId] = useState(retiro?.retiroId || null);
  const [tipo, setTipo] = useState('TIENDA');
  const [vendorId, setVendorId] = useState(retiro?.vendorId ? String(retiro.vendorId) : '');
  const [newClient, setNewClient] = useState(emptyNewClient);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedQty, setSelectedQty] = useState(1);
  const [freeProduct, setFreeProduct] = useState({ name: '', price: '', quantity: 1 });
  const [cart, setCart] = useState(
    retiro?.items
      ? retiro.items.map((item, idx) => ({ key: `retiro-${idx}`, product_id: item.product_id, product_name: item.product_name, price: Number(item.price), quantity: Number(item.quantity), price_type: item.price_type || retiro.priceType || 'marketplace' }))
      : []
  );
  // Cambia cada vez que se registra una venta, para refrescar la lista de ventas de hoy.
  const [ventasRefresh, setVentasRefresh] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [transferenciaVerificada, setTransferenciaVerificada] = useState(false);
  // Pago mixto: monto por cada forma de pago (string vacío = no se usa esa forma).
  const [breakdownAmounts, setBreakdownAmounts] = useState({});
  const [breakdownVerificada, setBreakdownVerificada] = useState(false);
  const [notes, setNotes] = useState('');
  const [address, setAddress] = useState('');
  const [comuna, setComuna] = useState('');
  const [phone, setPhone] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const isEnvioPrepagado = tipo === 'ENVIO_PREPAGADO';
  const precioEnvio = comuna ? (shippingCostsData?.costos || []).find((c) => c.comuna === comuna)?.precio || 0 : 0;
  const precioProductos = cart.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const total = precioProductos + (isEnvioPrepagado ? Number(precioEnvio) : 0);

  const breakdownLegs = PAYMENT_METHODS
    .map((method) => ({ method, amount: Number(breakdownAmounts[method]) || 0 }))
    .filter((leg) => leg.amount > 0);
  const breakdownSum = breakdownLegs.reduce((sum, leg) => sum + leg.amount, 0);
  const breakdownRestante = total - breakdownSum;
  const breakdownOk = paymentMethod !== 'mixto' || (breakdownLegs.length >= 2 && Math.abs(breakdownRestante) < 1);

  function handlePriceTypeChange(next) {
    setPriceType(next);
    if (next === 'mayor') {
      setSelectedQty((q) => Math.max(Number(q) || 0, MIN_MAYOR));
      setFreeProduct((f) => ({ ...f, quantity: Math.max(Number(f.quantity) || 0, MIN_MAYOR) }));
    }
  }

  function addToCart() {
    if (isEnvioPrepagado && cart.length >= 1) return;

    if (selectedProductId === '__free__') {
      if (!freeProduct.name || !freeProduct.price || freeProduct.quantity < 1) return;
      if (priceType === 'mayor' && Number(freeProduct.quantity) < MIN_MAYOR) return;
      setCart((prev) => [
        ...prev,
        { key: Date.now(), product_name: freeProduct.name, price: Number(freeProduct.price), quantity: Number(freeProduct.quantity), price_type: priceType },
      ]);
      setFreeProduct({ name: '', price: '', quantity: 1 });
      setSelectedProductId('');
      return;
    }

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

  const mayorOk = priceType !== 'mayor' || (selectedProductId === '__free__'
    ? Number(freeProduct.quantity) >= MIN_MAYOR
    : Number(selectedQty) >= MIN_MAYOR && Number(mayorPrice) > 0);
  const canAddToCart = (isEnvioPrepagado ? cart.length < 1 : true) && mayorOk && (
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
    if (isEnvioPrepagado && (!address || !comuna || !phone)) return;
    if (!retiroId && (!newClient.nombre.trim() || !newClient.apellido.trim())) return;
    if (!breakdownOk) return;

    const payload = {
      tipo,
      vendor_id: Number(vendorId),
      items: cart.map(({ product_name, price, quantity, price_type }) => ({ product_name, price, quantity, price_type })),
      payment_method: paymentMethod,
      transferencia_verificada: paymentMethod === 'transferencia' ? transferenciaVerificada : false,
      notes,
    };

    if (paymentMethod === 'mixto') {
      payload.payment_breakdown = breakdownLegs.map((leg) => ({
        method: leg.method,
        amount: leg.amount,
        transferencia_verificada: leg.method === 'transferencia' ? breakdownVerificada : undefined,
      }));
    }

    if (isEnvioPrepagado) {
      payload.address = address;
      payload.comuna = comuna;
      payload.phone = phone;
    }

    if (retiroId) {
      payload.client_id = Number(retiro.clientId);
      payload.retiro_id = retiroId;
    } else {
      payload.client = { name: `${newClient.nombre.trim()} ${newClient.apellido.trim()}` };
    }

    const result = await post('/api/caja/sale', payload);
    if (result.success) {
      setVentasRefresh((n) => n + 1);
      setSuccessMsg(
        isEnvioPrepagado
          ? `Envío prepagado registrado. Total ${formatCurrency(total)}`
          : `Venta registrada: ${cart.length} producto(s), total ${formatCurrency(total)}`
      );
      setCart([]);
      setNewClient(emptyNewClient);
      setNotes('');
      setAddress('');
      setComuna('');
      setPhone('');
      setTransferenciaVerificada(false);
      setBreakdownAmounts({});
      setBreakdownVerificada(false);
      setRetiroId(null);
    }
  }

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Caja</h1>
        <button className="btn btn-secondary" onClick={() => navigate('/sales')}>Ver ventas</button>
      </div>

      {loadingCajaActual && (
        <div className="page-loading">
          <div className="spinner" />
        </div>
      )}

      {!loadingCajaActual && !cajaAbierta && (
        <div className="card" style={{ padding: 24, maxWidth: 480, borderLeft: '4px solid var(--color-warning)' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>No hay una caja abierta</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: 0, marginBottom: 16 }}>
            Para registrar ventas en Caja primero debes abrir la caja del día desde Apertura/Cierre de Caja.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/cash-register')}>
            Ir a Apertura/Cierre de Caja
          </button>
        </div>
      )}

      {!loadingCajaActual && cajaAbierta && (
      <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, maxWidth: 420 }}>
        <button type="button" className={tipo === 'TIENDA' ? 'btn btn-primary' : 'btn btn-secondary'} style={{ flex: 1 }} onClick={() => handleTipoChange('TIENDA')}>
          Tienda
        </button>
        <button type="button" className={isEnvioPrepagado ? 'btn btn-primary' : 'btn btn-secondary'} style={{ flex: 1 }} onClick={() => handleTipoChange('ENVIO_PREPAGADO')}>
          Envío prepagado
        </button>
      </div>

      {retiroId && (
        <div className="card" style={{ padding: 16, marginBottom: 20, borderColor: 'var(--color-primary)' }}>
          Procesando Retiro en Tienda de <strong>{retiro?.clientName}</strong>. Al registrar la venta se marcará como entregado.
        </div>
      )}

      {successMsg && <div className="card" style={{ padding: 16, marginBottom: 20, color: 'var(--color-success)' }}>{successMsg}</div>}
      {saveError && <div className="alert alert-error">{saveError}</div>}

      <form onSubmit={handleSubmit} className="form-grid-2" style={{ gap: 20 }}>
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>Datos de la venta</h3>

          <div className="form-field">
            <label>Vendedor</label>
            <SearchableSelect
              value={vendorId}
              onChange={setVendorId}
              options={vendorOptions}
              placeholder="Selecciona un vendedor"
              required
            />
          </div>

          {retiroId ? (
            <div className="form-field">
              <label>Cliente</label>
              <input value={retiro.clientName} disabled />
            </div>
          ) : (
            <div className="form-field">
              <label>Cliente</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input placeholder="Nombre" value={newClient.nombre} onChange={(e) => setNewClient({ ...newClient, nombre: e.target.value })} required style={{ flex: 1, minWidth: 0 }} />
                <input placeholder="Apellido" value={newClient.apellido} onChange={(e) => setNewClient({ ...newClient, apellido: e.target.value })} required style={{ flex: 1, minWidth: 0 }} />
              </div>
            </div>
          )}

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
                <input value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </div>
            </>
          )}

          <div className="form-field">
            <label>Forma de pago</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} required>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>{paymentMethodLabel(m)}</option>
              ))}
              <option value="mixto">Mixto (varias formas de pago)</option>
            </select>
          </div>

          {paymentMethod === 'transferencia' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 16 }}>
              <input type="checkbox" checked={transferenciaVerificada} onChange={(e) => setTransferenciaVerificada(e.target.checked)} />
              Transferencia verificada
            </label>
          )}

          {paymentMethod === 'mixto' && (
            <div className="form-field">
              <label>Montos por forma de pago</label>
              {PAYMENT_METHODS.map((m) => (
                <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ flex: 1, fontSize: 13 }}>{paymentMethodLabel(m)}</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="$0"
                    value={breakdownAmounts[m] || ''}
                    onChange={(e) => setBreakdownAmounts({ ...breakdownAmounts, [m]: e.target.value })}
                    style={{ width: 120 }}
                  />
                </div>
              ))}
              {breakdownAmounts.transferencia > 0 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, margin: '4px 0 8px' }}>
                  <input type="checkbox" checked={breakdownVerificada} onChange={(e) => setBreakdownVerificada(e.target.checked)} />
                  Transferencia verificada
                </label>
              )}
              <div style={{ fontSize: 13, fontWeight: 600, color: breakdownOk ? 'var(--color-success)' : 'var(--color-error)' }}>
                {breakdownRestante === 0
                  ? 'Montos completos'
                  : breakdownRestante > 0
                    ? `Faltan ${formatCurrency(breakdownRestante)} por asignar`
                    : `Excede el total por ${formatCurrency(-breakdownRestante)}`}
              </div>
            </div>
          )}

          <div className="form-field">
            <label>Notas</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={saving || cart.length === 0 || !breakdownOk}>
            {saving ? 'Guardando...' : `Registrar venta (${formatCurrency(total)})`}
          </button>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>Productos</h3>
          <PriceTypeToggle value={priceType} onChange={handlePriceTypeChange} allowMayor />
          {priceType === 'mayor' && (
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: -4 }}>
              Venta al mayor: mínimo {MIN_MAYOR} unidades por producto y precio libre.
            </p>
          )}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: selectedProductId === '__free__' ? 8 : 0 }}>
              <div style={{ flex: 1 }}>
                <SearchableSelect
                  value={selectedProductId}
                  onChange={setSelectedProductId}
                  options={productOptions}
                  pinnedOptions={FREE_PRODUCT_OPTION}
                  placeholder="Selecciona un producto"
                  disabled={isEnvioPrepagado && cart.length >= 1}
                />
              </div>
              {selectedProductId !== '__free__' && (
                <input type="number" min={priceType === 'mayor' ? MIN_MAYOR : 1} value={selectedQty} onChange={(e) => setSelectedQty(e.target.value)} style={{ width: 70 }} disabled={isEnvioPrepagado && cart.length >= 1} />
              )}
              <button type="button" className="btn btn-secondary" onClick={addToCart} disabled={!canAddToCart}>
                Agregar
              </button>
            </div>

            {priceType === 'mayor' && selectedProductId && selectedProductId !== '__free__' && (
              <input
                type="number"
                min="0"
                placeholder="Precio unitario (libre)"
                value={mayorPrice}
                onChange={(e) => setMayorPrice(e.target.value)}
                style={{ marginTop: 8, width: '100%' }}
              />
            )}

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
                  min={priceType === 'mayor' ? MIN_MAYOR : 1}
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
      </>
      )}

      {/* Ventas de caja del día en curso, debajo del formulario de registro */}
      <VentasCajaHoy refreshKey={ventasRefresh} />
    </Layout>
  );
}
