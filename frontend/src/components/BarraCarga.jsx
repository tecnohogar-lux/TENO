// Barra fina de progreso en la parte superior de la pantalla mientras se recarga una lista
// (búsqueda, cambio de página). La primera carga usa el spinner de siempre.
export default function BarraCarga({ activo }) {
  if (!activo) return null;
  return (
    <div className="barra-carga" role="progressbar" aria-label="Cargando">
      <div className="barra-carga__avance" />
    </div>
  );
}
