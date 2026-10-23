import { Fragment } from 'react';
import { leerMensajeAviso, partirNegritas } from '../utils/avisoTexto';

// Aviso a pantalla completa con el título y el mensaje que escribió el admin (Administración → Avisos).
// Lo usan el aviso real (AvisoActualizacion) y la vista previa de esa pantalla.
function Linea({ texto }) {
  return partirNegritas(texto).map((f, i) => (f.negrita ? <strong key={i}>{f.texto}</strong> : <Fragment key={i}>{f.texto}</Fragment>));
}

function Lineas({ lineas }) {
  return lineas.map((l, i) => (
    <Fragment key={i}>{i > 0 && <br />}<Linea texto={l} /></Fragment>
  ));
}

function Bloque({ b }) {
  switch (b.tipo) {
    case 'subtitulo': return <h3 className="aviso-subtitulo"><Linea texto={b.lineas[0]} /></h3>;
    case 'viñetas': return <ul className="aviso-pasos">{b.lineas.map((l, i) => <li key={i}><Linea texto={l} /></li>)}</ul>;
    case 'pasos': return <ol className="aviso-pasos">{b.lineas.map((l, i) => <li key={i}><Linea texto={l} /></li>)}</ol>;
    case 'alerta':
    case 'ok':
    case 'info': return <div className={`aviso-caja aviso-caja--${b.tipo}`}><span><Lineas lineas={b.lineas} /></span></div>;
    default: return <p className="aviso-texto"><Lineas lineas={b.lineas} /></p>;
  }
}

export default function AvisoActualizacionPantalla({ titulo, mensaje, onEntendido, onCerrarSesion }) {
  return (
    <div className="aviso-overlay" role="alertdialog" aria-modal="true" aria-labelledby="aviso-titulo">
      <div className="aviso-panel">
        <div className="aviso-icono" aria-hidden="true">🛠️</div>
        <h2 id="aviso-titulo" className="aviso-titulo">{titulo}</h2>

        {leerMensajeAviso(mensaje).map((b, i) => <Bloque key={i} b={b} />)}

        <div className="aviso-botones">
          <button type="button" className="btn btn-primary aviso-boton" onClick={onEntendido} autoFocus>
            Entendido
          </button>
          {onCerrarSesion && (
            <button type="button" className="btn btn-secondary aviso-boton" onClick={onCerrarSesion}>
              Cerrar sesión
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
