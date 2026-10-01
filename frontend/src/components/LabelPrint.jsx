import { useState } from 'react';
import LabelCard from './LabelCard';
import useApi from '../hooks/useApi';

export default function LabelPrint({ sale, onClose, onPrinted }) {
  const { put } = useApi();
  const [printing, setPrinting] = useState(false);

  async function handlePrint() {
    if (printing) return;
    setPrinting(true);
    try {
      if (sale.delivery_status === 'listo_para_imprimir') {
        await put(`/api/sales/${sale.id}/status`, { status: 'impreso' });
        onPrinted?.();
      }
      window.print();
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-panel">
        <div className="print-label" style={{ marginBottom: 20 }}>
          <div
            className="label-page"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(2, 1fr)', gap: 12, minHeight: 420 }}
          >
            <LabelCard sale={sale} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handlePrint} disabled={printing}>
            {printing ? 'Imprimiendo...' : 'Imprimir'}
          </button>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose} disabled={printing}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
