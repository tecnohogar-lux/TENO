import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import Layout from '../components/Layout';
import apiClient from '../api/client';

const SCAN_COOLDOWN_MS = 4000;

export default function ScanPage() {
  const [results, setResults] = useState([]);
  const lastScan = useRef({ code: null, time: 0 });

  useEffect(() => {
    const scanner = new Html5QrcodeScanner('qr-reader', { fps: 10, qrbox: 250 }, false);

    async function handleScan(decodedText) {
      const now = Date.now();
      if (lastScan.current.code === decodedText && now - lastScan.current.time < SCAN_COOLDOWN_MS) {
        return;
      }
      lastScan.current = { code: decodedText, time: now };

      const match = decodedText.match(/TENO-(\d+)/);
      if (!match) {
        setResults((prev) => [{ code: decodedText, ok: false, message: 'Código QR no reconocido', time: now }, ...prev].slice(0, 10));
        return;
      }

      const saleId = match[1];
      try {
        await apiClient.put(`/api/sales/${saleId}/status`, { status: 'en_camino' });
        setResults((prev) => [{ code: decodedText, ok: true, message: `Venta #${saleId} marcada como en camino`, time: now }, ...prev].slice(0, 10));
      } catch (err) {
        const message = err.response?.data?.error || 'Error al actualizar el estado';
        setResults((prev) => [{ code: decodedText, ok: false, message, time: now }, ...prev].slice(0, 10));
      }
    }

    scanner.render(handleScan, () => {});

    return () => {
      scanner.clear().catch(() => {});
    };
  }, []);

  return (
    <Layout>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Escanear paquete</h1>
      <p style={{ color: 'var(--color-text-muted)', marginTop: 0, marginBottom: 28 }}>
        Escanea el código QR de una etiqueta para marcarla como "En camino"
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card" style={{ padding: 20 }}>
          <div id="qr-reader" />
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>Últimos escaneos</h3>
          {results.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Aún no has escaneado nada</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {results.map((r) => (
                <div
                  key={r.time}
                  className="alert"
                  style={{
                    margin: 0,
                    background: r.ok ? '#eaf2ea' : '#fbeceb',
                    color: r.ok ? 'var(--color-success)' : 'var(--color-danger)',
                    border: `1px solid ${r.ok ? '#cfe3cf' : '#f0d3d0'}`,
                  }}
                >
                  {r.message}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
