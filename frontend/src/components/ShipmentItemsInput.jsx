import { useMemo, useState } from 'react';
import SearchableSelect from './SearchableSelect';
import PriceTypeToggle from './PriceTypeToggle';
import PriceTypeBadge from './PriceTypeBadge';
import { formatCurrency } from '../utils/format';
import { MIN_MAYOR, productPrice } from '../utils/priceType';

const FREE_PRODUCT_OPTION = [{ value: '__free__', label: 'Producto libre (no registrado)' }];

// Lista de productos de un envío. El botón SOL / MARKETPLACE define el precio de la
// línea que se agrega, así que el mismo producto puede repetirse con precios distintos.
export default function ShipmentItemsInput({ products, items, onChange, defaultPriceType = 'marketplace', allowMayor = false, hideSol = false }) {
  const [priceType, setPriceType] = useState(defaultPriceType);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [qty, setQty] = useState(1);
  const [free, setFree] = useState({ name: '', price: '' });
  const [mayorPrice, setMayorPrice] = useState('');

  const options = useMemo(
    () => products.map((p) => ({ value: p.id, label: priceType === 'mayor' ? `${p.title}${p.agotado ? ' (agotado)' : ''}` : `${p.title} · ${formatCurrency(productPrice(p, priceType))}${p.agotado ? ' (agotado)' : ''}` })),
    [products, priceType]
  );

  const isFree = selectedProductId === '__free__';
  const mayor = priceType === 'mayor';
  const minQty = mayor ? MIN_MAYOR : 1;
  const canAdd = isFree
    ? free.name.trim() && Number(free.price) > 0 && qty >= minQty
    : !!selectedProductId && qty >= minQty && (!mayor || Number(mayorPrice) > 0);
  const total = items.reduce((sum, i) => sum + i.quantity * i.price, 0);

  function addItem() {
    if (!canAdd) return;
    if (isFree) {
      onChange([...items, { key: Date.now(), product_name: free.name.trim(), quantity: Number(qty), price: Number(free.price), price_type: priceType }]);
      setFree({ name: '', price: '' });
    } else {
      const product = products.find((p) => String(p.id) === String(selectedProductId));
      if (!product) return;
      onChange([...items, { key: Date.now(), product_name: product.title, quantity: Number(qty), price: mayor ? Number(mayorPrice) : productPrice(product, priceType), price_type: priceType }]);
      setMayorPrice('');
    }
    setSelectedProductId('');
    setQty(minQty);
  }

  function handlePriceTypeChange(next) {
    setPriceType(next);
    if (next === 'mayor') setQty((q) => Math.max(Number(q) || 0, MIN_MAYOR));
  }

  function removeItem(key) {
    onChange(items.filter((i) => i.key !== key));
  }

  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <PriceTypeToggle value={priceType} onChange={handlePriceTypeChange} allowMayor={allowMayor} hideSol={hideSol} />
      {mayor && (
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: -4 }}>
          Venta al mayor: mínimo {MIN_MAYOR} unidades por producto y precio libre.
        </p>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: isFree ? 8 : 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <SearchableSelect
            value={selectedProductId}
            onChange={setSelectedProductId}
            options={options}
            pinnedOptions={FREE_PRODUCT_OPTION}
            placeholder="Selecciona un producto"
          />
        </div>
        <input type="number" min={minQty} value={qty} onChange={(e) => setQty(e.target.value)} style={{ width: 70 }} />
        <button type="button" className="btn btn-secondary" onClick={addItem} disabled={!canAdd}>
          Agregar
        </button>
      </div>

      {mayor && !isFree && selectedProductId && (
        <input
          type="number"
          min="0"
          placeholder="Precio unitario (libre)"
          value={mayorPrice}
          onChange={(e) => setMayorPrice(e.target.value)}
          style={{ width: '100%', marginBottom: 12 }}
        />
      )}

      {isFree && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input placeholder="Nombre del producto" value={free.name} onChange={(e) => setFree({ ...free, name: e.target.value })} style={{ flex: 2 }} />
          <input type="number" min="0" placeholder="Precio" value={free.price} onChange={(e) => setFree({ ...free, price: e.target.value })} style={{ flex: 1 }} />
        </div>
      )}

      <table className="responsive-stack" style={{ marginBottom: 8 }}>
        <thead>
          <tr>
            <th>Producto</th>
            <th>Precios</th>
            <th>Cant.</th>
            <th>Subtotal</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ color: 'var(--color-text-muted)' }}>Agrega al menos un producto</td>
            </tr>
          ) : (
            items.map((item) => (
              <tr key={item.key}>
                <td data-label="Producto">{item.product_name}</td>
                <td data-label="Precios"><PriceTypeBadge type={item.price_type} /></td>
                <td data-label="Cant.">{item.quantity}</td>
                <td data-label="Subtotal">{formatCurrency(item.quantity * item.price)}</td>
                <td data-label="Quitar">
                  <button type="button" className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => removeItem(item.key)}>
                    Quitar
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div style={{ textAlign: 'right', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Productos: {formatCurrency(total)}</div>
    </div>
  );
}
