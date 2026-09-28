import Badge from './Badge';
import { PRICE_TYPE_LABELS, priceTypeLabel } from '../utils/priceType';

export default function PriceTypeBadge({ type }) {
  return <Badge label={priceTypeLabel(type)} color={PRICE_TYPE_LABELS[type]?.color} />;
}
