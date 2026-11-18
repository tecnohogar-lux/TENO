import PriceTypeBadge from './PriceTypeBadge';
import PrecioUnitarioEditable from './PrecioUnitarioEditable';
import { formatCurrency } from '../utils/format';

// Productos ya agregados a un envío o retiro: una fila por producto con su tipo de precio, precio unitario
// (editable para quien puede), cantidad y subtotal. Reemplaza a la tabla de varias columnas.
export default function LineasProductos({ items, canEditPrice = false, onChangeLinea, onRemove, error = false }) {
  if (items.length === 0) {
    return <div className={`lineas-vacio${error ? ' con-error' : ''}`}>{error ? 'Agrega al menos un producto' : 'Aún no agregaste productos'}</div>;
  }
  return (
    <ul className="lineas-productos">
      {items.map((item) => (
        <li key={item.key} className="linea-producto">
          <div className="linea-producto__info">
            <div className="linea-producto__nombre">{item.product_name}</div>
            <div className="linea-producto__detalle">
              <PriceTypeBadge type={item.price_type} />
              <PrecioUnitarioEditable item={item} editable={canEditPrice} onChange={onChangeLinea} />
              <span>× {item.quantity}</span>
            </div>
          </div>
          <div className="linea-producto__subtotal">{formatCurrency(item.quantity * item.price)}</div>
          <button type="button" className="linea-producto__quitar" onClick={() => onRemove(item.key)} aria-label={`Quitar ${item.product_name}`}>×</button>
        </li>
      ))}
    </ul>
  );
}
