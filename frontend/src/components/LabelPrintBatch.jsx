import LabelCard from './LabelCard';
import useApi from '../hooks/useApi';

function chunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

export default function LabelPrintBatch({ sales, onClose, onPrinted }) {
  const { put } = useApi();
  const rows = chunk(sales, 3);

  async function handlePrint() {
    const idsToUpdate = sales.filter((s) => s.delivery_status === 'listo_para_imprimir').map((s) => s.id);
    if (idsToUpdate.length > 0) {
      await put('/api/sales/batch-status', { ids: idsToUpdate, status: 'impreso' });
      onPrinted?.();
    }
    window.print();
  }

  return (
    <div className="modal-overlay">
      <div className="modal-panel" style={{ width: 420, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>{sales.length} etiqueta(s) a imprimir</h3>

        <div className="print-label" style={{ overflowY: 'auto', marginBottom: 20 }}>
          {rows.map((row, i) => (
            <div key={i} className="label-row" style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              {row.map((sale) => (
                <LabelCard key={sale.id} sale={sale} />
              ))}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handlePrint}>
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
