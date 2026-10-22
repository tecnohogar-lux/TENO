import { formatDia } from '../utils/fechas';

// Marca morada de un envío reprogramado que sigue pendiente, para que no se lo salten.
// Si todavía espera su fecha (estado "reprogramado") muestra para qué día quedó.
export default function TagReprogramado({ s }) {
  return (
    <span className="tag-reprogramado-wrap">
      <span className="tag-reprogramado">Delivery Reprogramado</span>
      {s.delivery_status === 'reprogramado' && (
        <span className="tag-reprogramado-fecha">para el {formatDia(s.reprogramado_para)}</span>
      )}
    </span>
  );
}
