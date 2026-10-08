import { useState } from 'react';
import useFetch from '../../hooks/useFetch';
import useApi from '../../hooks/useApi';
import useConfirm from '../../hooks/useConfirm';

// Lista de contrapartes guardadas (a quién se le paga / quién nos paga): agregar, renombrar y
// eliminar las que no tienen cuentas.
export default function ContrapartesModal({ onClose, onChanged }) {
  const { data, loading, error, refetch } = useFetch('/api/recepcion-pagos/contrapartes');
  const { post, put, del, loading: saving, error: actionError } = useApi();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [nuevo, setNuevo] = useState('');
  const [editando, setEditando] = useState(null); // { id, nombre }

  const lista = data?.contrapartes || [];

  function cambio() {
    refetch();
    onChanged?.();
  }

  async function agregar(e) {
    e.preventDefault();
    if (!nuevo.trim()) return;
    const result = await post('/api/recepcion-pagos/contrapartes', { nombre: nuevo });
    if (result.success) { setNuevo(''); cambio(); }
  }

  async function guardarNombre(e) {
    e.preventDefault();
    const result = await put(`/api/recepcion-pagos/contrapartes/${editando.id}`, { nombre: editando.nombre });
    if (result.success) { setEditando(null); cambio(); }
  }

  async function eliminar(c) {
    const ok = await confirm(`¿Eliminar "${c.nombre}" de la lista?`, { title: 'Eliminar contraparte', confirmLabel: 'Eliminar', danger: true });
    if (!ok) return;
    const result = await del(`/api/recepcion-pagos/contrapartes/${c.id}`);
    if (result.success) cambio();
  }

  return (
    <div className="modal-overlay">
      <div className="modal-panel" style={{ width: 480, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ margin: 0, fontSize: 17 }}>Contrapartes</h3>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--color-text-muted)' }}>
          A quiénes se les paga y quiénes nos pagan. Quedan guardados para elegirlos en cualquier cuenta.
        </p>

        <form onSubmit={agregar} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <input placeholder="Nueva contraparte" value={nuevo} maxLength={150} onChange={(e) => setNuevo(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
          <button type="submit" className="btn btn-primary" disabled={saving || !nuevo.trim()}>Agregar</button>
        </form>

        {(error || actionError) && <div className="alert alert-error">{error || actionError}</div>}
        {loading && !data && <div className="page-loading"><div className="spinner" /></div>}

        {data && lista.length === 0 && <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Todavía no hay contrapartes guardadas.</div>}

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {lista.map((c) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
              {editando?.id === c.id ? (
                <form onSubmit={guardarNombre} style={{ display: 'flex', gap: 6, flex: 1, minWidth: 0 }}>
                  <input autoFocus value={editando.nombre} maxLength={150} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} style={{ flex: 1, minWidth: 0 }} />
                  <button type="submit" className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 12 }} disabled={saving}>Guardar</button>
                  <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setEditando(null)}>Cancelar</button>
                </form>
              ) : (
                <>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{c.nombre}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{c.cuentas} cuenta(s)</div>
                  </div>
                  <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setEditando({ id: c.id, nombre: c.nombre })}>Renombrar</button>
                  {c.cuentas === 0 && (
                    <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12, color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={() => eliminar(c)}>Eliminar</button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
      {confirmDialog}
    </div>
  );
}
