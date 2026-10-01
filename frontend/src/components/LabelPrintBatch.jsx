import { useState } from 'react';
import LabelCard from './LabelCard';
import useApi from '../hooks/useApi';

const PER_PAGE = 6;

function chunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

export default function LabelPrintBatch({ sales, onClose, onPrinted }) {
  const { put } = useApi();
  const [printing, setPrinting] = useState(false);
  const pages = chunk(sales, PER_PAGE);

  async function handlePrint() {
    if (printing) return;
    setPrinting(true);
    try {
      const idsToUpdate = sales.filter((s) => s.delivery_status === 'listo_para_imprimir').map((s) => s.id);
      if (idsToUpdate.length > 0) {
        await put('/api/sales/batch-status', { ids: idsToUpdate, status: 'impreso' });
        onPrinted?.();
      }
      window.print();
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-panel" style={{ width: 420, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>
          {sales.length} etiqueta(s) a imprimir · {pages.length} página(s)
        </h3>

        <div className="print-label" style={{ overflowY: 'auto', marginBottom: 20 }}>
          {pages.map((page, i) => (
            <div
              key={i}
              className="label-page"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(2, 1fr)', gap: 12, marginBottom: 24, minHeight: 420 }}
            >
              {page.map((sale) => (
                <LabelCard key={sale.id} sale={sale} />
              ))}
            </div>
          ))}
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
