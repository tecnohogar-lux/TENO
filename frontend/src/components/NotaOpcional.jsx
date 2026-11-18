import { useEffect, useState } from 'react';

// Notas del formulario: cerradas detrás de "Agregar nota" salvo que ya tengan texto (por ejemplo un borrador
// recuperado o un registro que se está editando).
export default function NotaOpcional({ value, onChange, rows = 2 }) {
  const [abierta, setAbierta] = useState(!!value);
  useEffect(() => { if (value) setAbierta(true); }, [value]);

  if (!abierta) {
    return <button type="button" className="btn-enlace" onClick={() => setAbierta(true)}>+ Agregar nota</button>;
  }
  return (
    <div className="form-field">
      <label>Notas</label>
      <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} autoFocus={!value} />
    </div>
  );
}
