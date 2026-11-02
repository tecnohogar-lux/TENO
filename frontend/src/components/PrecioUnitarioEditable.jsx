import { formatCurrency } from '../utils/format';
import { conPrecio, lineaEditable } from '../utils/precioLinea';
import TagPrecioModificado from './TagPrecioModificado';

// Precio unitario de una línea del carrito. Quien puede editar (admin/operador/caja) lo cambia aquí, solo para
// esta venta; los demás lo ven fijo. Si difiere del catálogo, muestra la marca y el precio original.
export default function PrecioUnitarioEditable({ item, editable, onChange }) {
  if (!editable || !lineaEditable(item)) {
    return <>{formatCurrency(Number(item.price))}{item.precio_modificado && <> <TagPrecioModificado original={item.precio_catalogo} /></>}</>;
  }
  return (
    <div className="precio-editable">
      <input
        type="number"
        min="1"
        step="any"
        required
        value={item.price}
        onChange={(e) => onChange(conPrecio(item, e.target.value))}
        aria-label={`Precio unitario de ${item.product_name}`}
      />
      {item.precio_modificado && (
        <div className="precio-editable-aviso">
          <TagPrecioModificado original={item.precio_catalogo} />
          <span>Catálogo: {formatCurrency(Number(item.precio_catalogo))}</span>
        </div>
      )}
    </div>
  );
}
