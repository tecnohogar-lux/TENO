import { QRCodeSVG } from 'qrcode.react';
import { formatDate } from '../utils/format';

export default function LabelPrint({ sale, onClose }) {
  return (
    <div className="modal-overlay">
      <div className="modal-panel">
        <div className="print-label" style={{ padding: 16, border: '1px solid var(--color-border)', borderRadius: 8, marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>TENO ERP · Etiqueta de envío</div>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{sale.client_name}</div>
          <div style={{ fontSize: 14, marginBottom: 2 }}>{sale.address || 'Sin dirección registrada'}</div>
          <div style={{ fontSize: 14, marginBottom: 16 }}>{sale.phone || ''}</div>
          <div style={{ fontSize: 13, marginBottom: 12 }}>
            {sale.product_name} · Cant. {sale.quantity}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <QRCodeSVG value={sale.qr_code || `TENO-${sale.id}`} size={140} />
          </div>
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--color-text-muted)' }}>
            {sale.qr_code || `TENO-${sale.id}`} · {formatDate(sale.created_at)}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => window.print()}>
            Imprimir
          </button>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
