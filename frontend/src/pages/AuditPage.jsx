import Layout from '../components/Layout';
import useFetch from '../hooks/useFetch';
import { formatDate } from '../utils/format';

const ACTION_LABELS = {
  crear_venta: 'Creó venta',
  editar_venta: 'Editó venta',
  reasignar_vendedor: 'Reasignó vendedor',
  cambiar_estado_paquete: 'Cambió estado de paquete',
  cambiar_estado_paquete_lote: 'Cambió estado de paquete (lote)',
  eliminar_venta: 'Eliminó venta',
  restaurar_venta: 'Restauró venta',
  crear_usuario: 'Creó usuario',
  editar_usuario: 'Editó usuario',
  eliminar_usuario: 'Eliminó usuario',
};

function describeAction(entry) {
  return ACTION_LABELS[entry.action] || entry.action;
}

function summarizeChange(entry) {
  if (entry.action === 'reasignar_vendedor' && entry.old_values && entry.new_values) {
    return `Vendedor: ${entry.old_values.vendor_id} → ${entry.new_values.vendor_id}`;
  }
  if (entry.action === 'cambiar_estado_paquete' || entry.action === 'cambiar_estado_paquete_lote') {
    return `${entry.old_values?.delivery_status || '-'} → ${entry.new_values?.delivery_status || '-'}`;
  }
  if (entry.action === 'crear_usuario' && entry.new_values) {
    return `${entry.new_values.name} (${entry.new_values.role})`;
  }
  if (entry.action === 'editar_usuario' && entry.new_values) {
    return `${entry.new_values.name}`;
  }
  return '-';
}

export default function AuditPage() {
  const { data, loading, error } = useFetch('/api/audit');

  return (
    <Layout>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Auditoría</h1>
      <p style={{ color: 'var(--color-text-muted)', marginTop: 0, marginBottom: 24 }}>
        Historial de cambios importantes: quién hizo qué y cuándo.
      </p>

      {loading && (
        <div className="page-loading">
          <div className="spinner" />
        </div>
      )}
      {error && <div className="alert alert-error">{error}</div>}

      {data && (
        <div className="card" style={{ padding: 20 }}>
          <table className="responsive-stack">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Acción</th>
                <th>Tabla</th>
                <th>Registro</th>
                <th>Detalle</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ color: 'var(--color-text-muted)' }}>Sin actividad registrada</td>
                </tr>
              ) : (
                data.entries.map((entry) => (
                  <tr key={entry.id}>
                    <td data-label="Usuario">{entry.user_name || '-'}</td>
                    <td data-label="Acción">{describeAction(entry)}</td>
                    <td data-label="Tabla">{entry.table_name}</td>
                    <td data-label="Registro">#{entry.record_id}</td>
                    <td data-label="Detalle" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{summarizeChange(entry)}</td>
                    <td data-label="Fecha">{formatDate(entry.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
