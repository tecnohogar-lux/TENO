import { useMemo, useState } from 'react';
import SearchableSelect from '../SearchableSelect';
import useApi from '../../hooks/useApi';

const NUEVA = '__nueva__';
const PINNED = [{ value: NUEVA, label: '+ Agregar una contraparte nueva' }];

// A quién se le paga / quién nos paga. Se elige de la lista de contrapartes guardadas, o se agrega
// una nueva ahí mismo (queda guardada para usarla en otros pagos).
export default function ContraparteSelect({ contrapartes, value, onChange, onCreated, required = true }) {
  const { post, loading, error } = useApi();
  const [nombre, setNombre] = useState('');
  const options = useMemo(() => contrapartes.map((c) => ({ value: c.id, label: c.nombre })), [contrapartes]);
  const creando = value === NUEVA;

  async function guardar() {
    if (!nombre.trim()) return;
    const result = await post('/api/recepcion-pagos/contrapartes', { nombre });
    if (result.success) {
      onCreated?.(result.data.contraparte);
      onChange(String(result.data.contraparte.id));
      setNombre('');
    }
  }

  return (
    <div>
      <SearchableSelect
        value={value}
        onChange={onChange}
        options={options}
        pinnedOptions={PINNED}
        placeholder="Selecciona o agrega una contraparte"
        required={required && !creando}
      />
      {creando && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              autoFocus
              placeholder="Nombre (ej. Juan Pérez, Blue Express)"
              value={nombre}
              maxLength={150}
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); guardar(); } }}
              style={{ flex: 1, minWidth: 0 }}
            />
            <button type="button" className="btn btn-primary" onClick={guardar} disabled={loading || !nombre.trim()}>
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
          {error && <div className="alert alert-error" style={{ marginTop: 8 }}>{error}</div>}
        </div>
      )}
    </div>
  );
}
