import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Hoja carta horizontal con el mismo margen que usaba la hoja impresa (0.25in),
// así cada imagen de página cae exactamente donde caía la grilla de 6 etiquetas.
const PAGE_WIDTH_IN = 11;
const PAGE_HEIGHT_IN = 8.5;
const MARGIN_IN = 0.25;
const CONTENT_WIDTH_IN = PAGE_WIDTH_IN - MARGIN_IN * 2;
const CONTENT_HEIGHT_IN = PAGE_HEIGHT_IN - MARGIN_IN * 2;

// Genera y descarga un PDF ya formateado a partir de los nodos DOM de cada
// página (uno por hoja), en vez de depender del "Imprimir" del navegador —
// evita la paginación inconsistente de los distintos motores de impresión.
export async function downloadLabelsPdf(pageElements, filename) {
  const elements = pageElements.filter(Boolean);
  if (elements.length === 0) return;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'in', format: 'letter' });

  for (let i = 0; i < elements.length; i++) {
    const canvas = await html2canvas(elements[i], { scale: 1.5, backgroundColor: '#ffffff' });
    // JPEG en vez de PNG: el ruido de alto contraste del QR hace que PNG pese
    // 10+ MB por página; en JPEG de buena calidad queda nítido y liviano.
    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    if (i > 0) doc.addPage();
    doc.addImage(imgData, 'JPEG', MARGIN_IN, MARGIN_IN, CONTENT_WIDTH_IN, CONTENT_HEIGHT_IN);
  }

  doc.save(filename);
}
