import { formatCurrency } from '../utils/format';

// Marca de una venta (o línea) cuyo precio se cambió a mano respecto del catálogo.
// `original` es el precio unitario del catálogo, si se conoce.
export default function TagPrecioModificado({ original }) {
  const tieneOriginal = original !== null && original !== undefined && original !== '' && Number(original) > 0;
  return (
    <span
      className="tag-precio-modificado"
      title={tieneOriginal ? `Precio original: ${formatCurrency(Number(original))}` : 'Precio distinto del catálogo'}
    >
      Precio modificado
    </span>
  );
}
