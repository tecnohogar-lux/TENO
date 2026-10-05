import { QRCodeSVG } from 'qrcode.react';
import { formatCurrency } from '../utils/format';
import { saleLines } from '../utils/saleLines';
import { deliveryTypeLabel, isSinCobro } from '../utils/labels';

const IG_CAPTION = 'Síguenos en IG y descubre miles de productos';
const IG_URL = 'https://www.instagram.com/tecnohogar.cl/';

export default function LabelCard({ sale }) {
  const lines = saleLines(sale);

  return (
    <div
      className="label-card"
      style={{
        border: '2px solid #000',
        display: 'flex',
        flexDirection: 'column',
        breakInside: 'avoid',
        height: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 13, padding: '4px 8px', borderBottom: '2px solid #000', background: '#000', color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {deliveryTypeLabel(sale.delivery_type || 'delivery')}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderBottom: '2px solid #000' }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>TecnoHogar</div>
        <div style={{ fontSize: 11 }}>#{sale.id}</div>
      </div>

      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 22, padding: '6px 8px', borderBottom: '2px solid #000' }}>
        {sale.comuna || '-'}
      </div>

      <div style={{ padding: '4px 10px', borderBottom: '2px solid #000', flex: '1 1 auto', overflow: 'hidden' }}>
        {lines.map((l, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 10,
              padding: '5px 0',
              borderTop: i > 0 ? '1px solid #000' : 'none',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 24, lineHeight: 1, flexShrink: 0 }}>{l.quantity}</div>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', lineHeight: 1.25 }}>{l.product_name}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, padding: '8px 10px', borderBottom: '2px solid #000' }}>
        <div style={{ flex: 1, fontSize: 10, fontWeight: 700, lineHeight: 1.5, minWidth: 0 }}>
          <div>Cliente: {sale.client_name}</div>
          <div>Tel: {sale.phone || '-'}</div>
          <div>Dir: {sale.address || '-'}</div>
          {sale.notes && <div>Notas: {sale.notes}</div>}
        </div>
        <div style={{ textAlign: 'center', flexShrink: 0, width: 90 }}>
          <div style={{ fontSize: 9, fontWeight: 700, lineHeight: 1.2, marginBottom: 4 }}>{IG_CAPTION}</div>
          <QRCodeSVG value={IG_URL} size={80} />
        </div>
      </div>

      {/* Los envíos sin cobro (solo envío, solo entrega, cambio de producto) no muestran monto. */}
      {!isSinCobro(sale) && (
        <div style={{ padding: '6px 10px', fontSize: 16, fontWeight: 700, textAlign: 'right' }}>
          TOTAL: {formatCurrency(sale.total)}
        </div>
      )}
    </div>
  );
}
