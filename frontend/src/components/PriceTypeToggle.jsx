// Selector SOL / MARKETPLACE: define qué precio del catálogo se usa para el producto que se
// agrega a continuación (cada producto guarda su propio tipo, así que se pueden mezclar).
// `compact`: versión en una sola barra segmentada, sin título (para el encabezado de un paso del formulario).
export default function PriceTypeToggle({ value, onChange, allowMayor = false, hideSol = false, compact = false }) {
  if (compact) {
    const opciones = [
      ...(hideSol ? [] : [['sol', 'SOL']]),
      ['marketplace', 'MARKETPLACE'],
      ...(allowMayor ? [['mayor', 'AL MAYOR']] : []),
    ];
    return (
      <div className="segmentado" role="group" aria-label="Tipo de precio del producto que vas a agregar">
        {opciones.map(([valor, etiqueta]) => (
          <button key={valor} type="button" aria-pressed={value === valor} onClick={() => onChange(valor)}>{etiqueta}</button>
        ))}
      </div>
    );
  }

  return (
    <div className="form-field" style={{ marginBottom: 12 }}>
      <label>Tipo de precio del producto que vas a agregar</label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {!hideSol && (
        <button
          type="button"
          className={value === 'sol' ? 'btn btn-primary' : 'btn btn-secondary'}
          style={{ flex: 1, padding: '6px' }}
          onClick={() => onChange('sol')}
        >
          SOL
        </button>
        )}
        <button
          type="button"
          className={value === 'marketplace' ? 'btn btn-primary' : 'btn btn-secondary'}
          style={{ flex: 1, padding: '6px' }}
          onClick={() => onChange('marketplace')}
        >
          MARKETPLACE
        </button>
        {allowMayor && (
          <button
            type="button"
            className={value === 'mayor' ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ flex: 1, padding: '6px' }}
            onClick={() => onChange('mayor')}
          >
            VENTA AL MAYOR
          </button>
        )}
      </div>
    </div>
  );
}
