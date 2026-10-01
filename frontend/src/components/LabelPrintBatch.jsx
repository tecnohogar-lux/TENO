import { useRef, useState } from 'react';
import LabelCard from './LabelCard';
import useApi from '../hooks/useApi';
import { downloadLabelsPdf } from '../utils/labelPdf';

const PER_PAGE = 6;
// Tamaño de cada página "fuente" que se captura para el PDF: 100px por pulgada
// sobre el área imprimible de una hoja carta horizontal (10.5in x 8in).
const PAGE_PX_WIDTH = 1050;
const PAGE_PX_HEIGHT = 800;
const PREVIEW_SCALE = 0.35;

function chunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

export default function LabelPrintBatch({ sales, onClose, onPrinted }) {
  const { put } = useApi();
  const [downloading, setDownloading] = useState(false);
  const pages = chunk(sales, PER_PAGE);
  const pdfRefs = useRef([]);
  pdfRefs.current = [];

  async function handleDownload() {
    if (downloading) return;
    setDownloading(true);
    try {
      const idsToUpdate = sales.filter((s) => s.delivery_status === 'listo_para_imprimir').map((s) => s.id);
      if (idsToUpdate.length > 0) {
        await put('/api/sales/batch-status', { ids: idsToUpdate, status: 'impreso' });
        onPrinted?.();
      }
      const today = new Date().toISOString().slice(0, 10);
      await downloadLabelsPdf(pdfRefs.current, `etiquetas_${today}.pdf`);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-panel" style={{ width: 420, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>
          {sales.length} etiqueta(s) · {pages.length} página(s)
        </h3>

        <div style={{ overflowY: 'auto', marginBottom: 20 }}>
          {pages.map((page, i) => (
            <div key={i} style={{ width: PAGE_PX_WIDTH * PREVIEW_SCALE, height: PAGE_PX_HEIGHT * PREVIEW_SCALE, marginBottom: 12, overflow: 'hidden' }}>
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
                {page.map((sale) => (
                  <LabelCard key={sale.id} sale={sale} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Copia oculta a tamaño real (100px/pulgada) que se captura para el PDF;
            fuera de pantalla para no afectar la vista previa compacta de arriba. */}
        <div style={{ position: 'fixed', left: -99999, top: 0 }}>
          {pages.map((page, i) => (
            <div
              key={i}
              ref={(el) => { pdfRefs.current[i] = el; }}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(2, 1fr)', gap: 14, width: PAGE_PX_WIDTH, height: PAGE_PX_HEIGHT }}
            >
              {page.map((sale) => (
                <LabelCard key={sale.id} sale={sale} />
              ))}
            </div>
          ))}
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
