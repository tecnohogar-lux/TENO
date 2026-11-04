import { useNavigate } from 'react-router-dom';

// Dos accesos directos del dashboard: abren el formulario de registro de cada módulo.
// La página destino lee `state.abrirFormulario` y despliega el formulario al llegar.
export default function AccesosRapidos() {
  const navigate = useNavigate();
  return (
    <div className="accesos-rapidos">
      <button type="button" className="btn btn-primary" onClick={() => navigate('/retiro-tienda', { state: { abrirFormulario: true } })}>
        Registrar Retiro en Tienda
      </button>
      <button type="button" className="btn btn-primary" onClick={() => navigate('/shipping', { state: { abrirFormulario: true } })}>
        Registrar Delivery Santiago
      </button>
    </div>
  );
}
