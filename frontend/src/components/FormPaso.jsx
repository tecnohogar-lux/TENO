// Tarjeta numerada de un formulario por pasos (Cliente, Productos, Entrega).
// `acciones`: contenido opcional a la derecha del título (por ejemplo, el selector de tipo de precio).
// `error`: marca el paso en rojo cuando falta algo después de intentar guardar.
export default function FormPaso({ numero, titulo, acciones = null, error = false, children }) {
  return (
    <section className={`form-paso${error ? ' con-error' : ''}`}>
      <header className="form-paso__encabezado">
        <span className="form-paso__numero" aria-hidden="true">{numero}</span>
        <h3 className="form-paso__titulo">{titulo}</h3>
        {acciones && <div className="form-paso__acciones">{acciones}</div>}
      </header>
      {children}
    </section>
  );
}
