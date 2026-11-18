import { formatCurrency } from '../utils/format';

// Un paso del formulario para la lista de pendientes del resumen: ok si no falta nada.
export function pasoResumen(nombre, faltan) {
  return { ok: faltan.length === 0, texto: faltan.length === 0 ? nombre : `${nombre}: falta ${faltan.join(', ')}` };
}

// Resumen del formulario con el total y el botón de guardar. En escritorio es una tarjeta que acompaña al
// formulario; en teléfono se convierte en una barra fija abajo con el total y el botón siempre a la vista.
//  - lineas: [{ etiqueta, valor }] detalle de montos (productos, envío).
//  - pasos: salida de pasoResumen() de cada paso; se muestra qué falta antes de guardar.
//  - totalNota: texto chico bajo el total (por ejemplo "envío aparte").
export default function ResumenFormulario({ lineas, total, totalNota = '', textoBoton, guardando = false, pasos = [] }) {
  const pendientes = pasos.filter((p) => !p.ok).map((p) => p.texto);
  return (
    <aside className="resumen-form" aria-label="Resumen">
      <div className="resumen-form__titulo">Resumen</div>
      <div className="resumen-form__lineas">
        {lineas.map((l) => (
          <div key={l.etiqueta}><span>{l.etiqueta}</span><span>{l.valor}</span></div>
        ))}
      </div>
      <div className="resumen-form__total">
        <small>Total{totalNota ? ` · ${totalNota}` : ''}</small>
        <strong>{formatCurrency(total)}</strong>
      </div>
      <button type="submit" className="btn btn-primary resumen-form__guardar" disabled={guardando}>
        {guardando ? 'Guardando...' : textoBoton}
      </button>
      {pasos.length > 0 && (
        <ul className="resumen-form__pasos">
          {pasos.map((p) => (
            <li key={p.texto} className={p.ok ? '' : 'pendiente'}>{p.ok ? '✓' : '○'} {p.texto}</li>
          ))}
        </ul>
      )}
      {pendientes.length > 0 && <div className="resumen-form__faltan-corto">{pendientes[0]}</div>}
    </aside>
  );
}
