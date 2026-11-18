// Cantidad con botones − y + (más cómodo en el teléfono que escribirla). `value` puede ser texto mientras se escribe.
export default function CantidadStepper({ value, onChange, min = 1 }) {
  const actual = Number.isFinite(Number(value)) && String(value) !== '' ? Number(value) : min;
  return (
    <div className="stepper">
      <button type="button" aria-label="Una unidad menos" onClick={() => onChange(String(Math.max(min, actual - 1)))} disabled={actual <= min}>−</button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Cantidad"
      />
      <button type="button" aria-label="Una unidad más" onClick={() => onChange(String(actual + 1))}>+</button>
    </div>
  );
}
