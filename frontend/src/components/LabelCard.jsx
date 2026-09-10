import { QRCodeSVG } from 'qrcode.react';
import { formatCurrency } from '../utils/format';

export default function LabelCard({ sale }) {
  return (
    <div
      className="label-card"
      style={{
        border: '2px solid #000',
        display: 'flex',
        flexDirection: 'column',
        breakInside: 'avoid',
      }}
    >
      <div style={{ display: 'flex', gap: 10, padding: '10px 12px', borderBottom: '2px solid #000' }}>
        <div style={{ flexShrink: 0, fontWeight: 700, fontSize: 13, lineHeight: 1.1, paddingTop: 2 }}>
          TecnoHogar
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12 }}>Cant: {sale.quantity}</div>
          <div style={{ fontWeight: 700, fontSize: 13, textTransform: 'uppercase', lineHeight: 1.25 }}>
            {sale.product_name}
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 20, padding: '6px 8px', borderBottom: '2px solid #000' }}>
        {sale.comuna || '-'}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', padding: 10, borderBottom: '2px solid #000' }}>
        <QRCodeSVG value={sale.qr_code || `TENO-${sale.id}`} size={100} />
      </div>

      <div style={{ padding: '8px 12px', borderBottom: '2px solid #000', fontSize: 12, lineHeight: 1.5 }}>
        <div>Cliente: {sale.client_name}</div>
        <div>Tel: {sale.phone || '-'}</div>
        <div>Dir: {sale.address || '-'}</div>
      </div>

      <div style={{ padding: '8px 12px', fontSize: 16, fontWeight: 700 }}>
        TOTAL: {formatCurrency(sale.total)}
      </div>
    </div>
  );
}
