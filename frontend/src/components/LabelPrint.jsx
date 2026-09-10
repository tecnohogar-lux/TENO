import LabelCard from './LabelCard';
import useApi from '../hooks/useApi';

export default function LabelPrint({ sale, onClose, onPrinted }) {
  const { put } = useApi();

  async function handlePrint() {
    if (sale.delivery_status === 'listo_para_imprimir') {
      await put(`/api/sales/${sale.id}/status`, { status: 'impreso' });
      onPrinted?.();
    }
    window.print();
  }

  return (
    <div className="modal-overlay">
      <div className="modal-panel">
        <div className="print-label" style={{ marginBottom: 20 }}>
          <div className="label-row">
            <LabelCard sale={sale} />
          </div>
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
