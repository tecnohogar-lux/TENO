import { useMemo, useState } from 'react';
import SearchableSelect from './SearchableSelect';
import PriceTypeToggle from './PriceTypeToggle';
import FormPaso from './FormPaso';
import CantidadStepper from './CantidadStepper';
import LineasProductos from './LineasProductos';
import { formatCurrency } from '../utils/format';
import { MIN_MAYOR, productPrice } from '../utils/priceType';

const FREE_PRODUCT_OPTION = [{ value: '__free__', label: 'Producto libre (no registrado)' }];

// Paso "Productos" de un envío. El selector SOL / MARKETPLACE / AL MAYOR define el precio del producto que se
// agrega, así que el mismo producto puede repetirse con precios distintos.
//  - numero: número del paso en el formulario.
//  - error: marca el paso en rojo (falta agregar productos o algún precio es inválido).
export default function ShipmentItemsInput({ products, items, onChange, numero = 2, error = false, defaultPriceType = 'marketplace', allowMayor = false, hideSol = false, blockAgotado = false, canEditPrice = false }) {
  const [priceType, setPriceType] = useState(defaultPriceType);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [qty, setQty] = useState(1);
  const [free, setFree] = useState({ name: '', price: '' });
  const [mayorPrice, setMayorPrice] = useState('');
  const [agotadoError, setAgotadoError] = useState('');

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

  function addItem() {
    if (!canAdd) return;
    if (isFree) {
      onChange([...items, { key: Date.now(), product_name: free.name.trim(), quantity: Number(qty), price: Number(free.price), price_type: priceType }]);
      setFree({ name: '', price: '' });
    } else {
      const product = products.find((p) => String(p.id) === String(selectedProductId));
      if (!product) return;
      // blockAgotado (vendedores): el producto agotado se ve en la lista, pero no se puede agregar.
      if (blockAgotado && product.agotado) {
        setAgotadoError(`Producto agotado: "${product.title}". No se puede agregar al envío.`);
        return;
      }
      const catalogo = productPrice(product, priceType);
      onChange([...items, { key: Date.now(), product_name: product.title, quantity: Number(qty), price: mayor ? Number(mayorPrice) : catalogo, price_type: priceType, ...(mayor ? {} : { precio_catalogo: catalogo }) }]);
      setMayorPrice('');
    }
    setAgotadoError('');
    setSelectedProductId('');
    setQty(minQty);
  }

  function handlePriceTypeChange(next) {
    setPriceType(next);
    if (next === 'mayor') setQty((q) => Math.max(Number(q) || 0, MIN_MAYOR));
  }

  function cambiarLinea(nueva) {
    onChange(items.map((i) => (i.key === nueva.key ? nueva : i)));
  }

  function removeItem(key) {
    onChange(items.filter((i) => i.key !== key));
  }

  return (
    <FormPaso
      numero={numero}
      titulo="Productos"
      error={error}
      acciones={<PriceTypeToggle compact value={priceType} onChange={handlePriceTypeChange} allowMayor={allowMayor} hideSol={hideSol} />}
    >
      <p className="form-paso__nota">
        {mayor
          ? `Venta al mayor: mínimo ${MIN_MAYOR} unidades por producto y precio libre.`
          : 'El tipo de precio elegido arriba vale para el próximo producto que agregues.'}
      </p>

      <div className="agregar-producto">
        <div className="agregar-producto__buscar buscador-producto">
          <SearchableSelect
            value={selectedProductId}
            onChange={(v) => { setSelectedProductId(v); setAgotadoError(''); }}
            options={options}
            pinnedOptions={FREE_PRODUCT_OPTION}
            placeholder="Buscar producto por nombre"
          />
        </div>
        <div className="agregar-producto__acciones">
          <CantidadStepper value={qty} onChange={setQty} min={minQty} />
          <button type="button" className="btn btn-add" onClick={addItem} disabled={!canAdd}>
            Agregar
          </button>
        </div>
      </div>

      {agotadoError && <div className="alert alert-error" role="alert">{agotadoError}</div>}

      {mayor && !isFree && selectedProductId && (
        <input
          type="number"
          inputMode="decimal"
          min="0"
          placeholder="Precio unitario (libre)"
          value={mayorPrice}
          onChange={(e) => setMayorPrice(e.target.value)}
          className="campo-suelto"
        />
      )}

      {isFree && (
        <div className="form-fila form-fila--2 form-fila--libre">
          <input placeholder="Nombre del producto" value={free.name} onChange={(e) => setFree({ ...free, name: e.target.value })} className="campo-suelto" />
          <input type="number" inputMode="decimal" min="0" placeholder="Precio unitario" value={free.price} onChange={(e) => setFree({ ...free, price: e.target.value })} className="campo-suelto" />
        </div>
      )}

      <LineasProductos items={items} canEditPrice={canEditPrice} onChangeLinea={cambiarLinea} onRemove={removeItem} error={error && items.length === 0} />
    </FormPaso>
  );
}
