import { useRef, useState } from 'react';
import LabelCard from './LabelCard';
import useApi from '../hooks/useApi';
import { downloadLabelsPdf } from '../utils/labelPdf';

const PAGE_PX_WIDTH = 1050;
const PAGE_PX_HEIGHT = 800;
const PREVIEW_SCALE = 0.35;

export default function LabelPrint({ sale, onClose, onPrinted }) {
  const { put } = useApi();
  const [downloading, setDownloading] = useState(false);
  const pdfRef = useRef(null);

  async function handleDownload() {
    if (downloading) return;
    setDownloading(true);
    try {
      if (sale.delivery_status === 'listo_para_imprimir') {
        await put(`/api/sales/${sale.id}/status`, { status: 'impreso' });
        onPrinted?.();
      }
      await downloadLabelsPdf([pdfRef.current], `etiqueta_${sale.id}.pdf`);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-panel">
        <div style={{ width: PAGE_PX_WIDTH * PREVIEW_SCALE, height: PAGE_PX_HEIGHT * PREVIEW_SCALE, marginBottom: 20, overflow: 'hidden' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gridTemplateRows: 'repeat(2, 1fr)',
              gap: 14,
              width: PAGE_PX_WIDTH,
              height: PAGE_PX_HEIGHT,
              transform: `scale(${PREVIEW_SCALE})`,
              transformOrigin: 'top left',
            }}
          >
            <LabelCard sale={sale} />
          </div>
        </div>

        {/* Copia oculta a tamaño real que se captura para el PDF. */}
        <div style={{ position: 'fixed', left: -99999, top: 0 }}>
          <div
            ref={pdfRef}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(2, 1fr)', gap: 14, width: PAGE_PX_WIDTH, height: PAGE_PX_HEIGHT }}
          >
            <LabelCard sale={sale} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleDownload} disabled={downloading}>
            {downloading ? 'Generando PDF...' : 'Descargar PDF'}
          </button>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose} disabled={downloading}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
