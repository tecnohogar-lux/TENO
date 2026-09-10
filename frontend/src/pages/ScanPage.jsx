import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import Layout from '../components/Layout';
import useApi from '../hooks/useApi';

const SCAN_COOLDOWN_MS = 2000;

export default function ScanPage() {
  const { put, loading: delivering, error: deliverError } = useApi();
  const [batch, setBatch] = useState([]);
  const [scanFeedback, setScanFeedback] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const lastScan = useRef({ code: null, time: 0 });
  const batchRef = useRef(batch);
  batchRef.current = batch;

  useEffect(() => {
    const scanner = new Html5QrcodeScanner('qr-reader', { fps: 10, qrbox: 250 }, false);

    function handleScan(decodedText) {
      const now = Date.now();
      if (lastScan.current.code === decodedText && now - lastScan.current.time < SCAN_COOLDOWN_MS) {
        return;
      }
      lastScan.current = { code: decodedText, time: now };

      const match = decodedText.match(/TENO-(\d+)/);
      if (!match) {
        setScanFeedback(`Código QR no reconocido: ${decodedText}`);
        return;
      }

      const saleId = Number(match[1]);
      if (batchRef.current.some((item) => item.id === saleId)) {
        setScanFeedback(`Paquete #${saleId} ya está en la lista`);
        return;
      }

      setBatch((prev) => [...prev, { id: saleId, code: decodedText }]);
      setScanFeedback(`Paquete #${saleId} agregado`);
      setSuccessMsg('');
    }

    scanner.render(handleScan, () => {});

    return () => {
      scanner.clear().catch(() => {});
    };
  }, []);

  function removeFromBatch(id) {
    setBatch((prev) => prev.filter((item) => item.id !== id));
  }

  async function handleDeliver() {
    if (batch.length === 0) return;
    const result = await put('/api/sales/batch-status', {
      ids: batch.map((item) => item.id),
      status: 'en_camino',
    });
    if (result.success) {
      setSuccessMsg(`${result.data.sales.length} paquete(s) marcados como en camino`);
      setBatch([]);
      setScanFeedback('');
    }
  }

  return (
    <Layout>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Escanear paquetes</h1>
      <p style={{ color: 'var(--color-text-muted)', marginTop: 0, marginBottom: 28 }}>
        Escanea todos los paquetes que llevarás y presiona "Entregar" al final para marcarlos como "En camino"
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card" style={{ padding: 20 }}>
          <div id="qr-reader" />
          {scanFeedback && (
            <div style={{ marginTop: 12, fontSize: 13, color: 'var(--color-text-muted)' }}>{scanFeedback}</div>
          )}
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>Paquetes escaneados ({batch.length})</h3>

          {successMsg && <div className="alert alert-success">{successMsg}</div>}
          {deliverError && <div className="alert alert-error">{deliverError}</div>}

          {batch.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Aún no has escaneado ningún paquete</p>
          ) : (
            <table style={{ marginBottom: 20 }}>
              <thead>
                <tr>
                  <th>Paquete</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {batch.map((item) => (
                  <tr key={item.id}>
                    <td>#{item.id} · {item.code}</td>
                    <td>
                      <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => removeFromBatch(item.id)}>
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            disabled={batch.length === 0 || delivering}
            onClick={handleDeliver}
          >
            {delivering ? 'Enviando...' : `Entregar (${batch.length})`}
          </button>
        </div>
      </div>
    </Layout>
  );
}
