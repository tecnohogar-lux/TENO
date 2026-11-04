import { memo } from 'react';
import Badge from './Badge';
import BotonCopiarEtiqueta from './BotonCopiarEtiqueta';
import TagPrecioModificado from './TagPrecioModificado';
import TagReprogramado from './TagReprogramado';
import { DESPACHO_OPCIONES } from './MotivoDialog';
import { textoEtiquetaVenta } from '../utils/etiquetaTexto';
import { esReprogramadoPendiente } from '../utils/fechas';
import { formatCurrency, formatDate } from '../utils/format';
import { DELIVERY_STATUS_LABELS, DELIVERY_STATUS_OPTIONS, DELIVERY_TYPE_LABELS, DELIVERY_TYPE_OPTIONS, deliveryStatusLabel, deliveryTypeLabel, isSinCobro } from '../utils/labels';

const MOTIVO_STATUSES = ['cancelado', 'reprogramado'];

// Fila de la tabla de Delivery Santiago. Está memorizada: solo se vuelve a dibujar cuando cambian sus
// propios datos, así escribir en un formulario de la página no repinta cientos de filas (lag al teclear).
// Los manejadores deben llegar con identidad estable (ver useEventoEstable).
function FilaEnvio({ s, canManage, isAdmin, seleccionado, menuTipoAbierto, couriers, onToggleSelect, onCourierChange, onStatusChange, onToggleTypeMenu, onTypeChange, onEdit, onPrint, onDelete }) {
  return (
    <tr className={esReprogramadoPendiente(s) ? 'fila-reprogramada' : undefined}>
      {canManage && (
        <td data-label="Seleccionar">
          <input type="checkbox" checked={seleccionado} onChange={() => onToggleSelect(s.id)} />
        </td>
      )}
      <td data-label="Producto">{s.product_name}{s.precio_modificado && <> <TagPrecioModificado original={s.precio_original} /></>}</td>
      <td data-label="Cliente">{s.client_name}</td>
      <td data-label="Vendedor">{s.vendor_name}</td>
      <td data-label="Dirección">{s.address || '-'}</td>
      <td data-label="Comuna">{s.comuna || '-'}</td>
      <td data-label="Total">{isSinCobro(s) ? '—' : formatCurrency(s.total)}</td>
      <td data-label="Comisión">{isSinCobro(s) ? '—' : (s.comision !== null && s.comision !== undefined ? formatCurrency(s.comision) : '-')}</td>
      <td data-label="Courier">
        {canManage ? (
          <select
            value={s.courier_id || ''}
            onChange={(e) => onCourierChange(s, e.target.value)}
            style={{ fontSize: 12, padding: '4px 6px', borderRadius: 4, border: '1px solid var(--color-border)' }}
          >
            <option value="">Sin asignar</option>
            {couriers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        ) : (
          s.courier_name || '-'
        )}
      </td>
      <td data-label="Estado">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
          {esReprogramadoPendiente(s) && <TagReprogramado s={s} />}
          <Badge label={deliveryStatusLabel(s.delivery_status)} color={DELIVERY_STATUS_LABELS[s.delivery_status]?.color} />
          {s.delivery_status === 'cancelado' && s.despacho_cancelacion && (
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', maxWidth: 220, textAlign: 'right', whiteSpace: 'normal' }}>
              <strong>{DESPACHO_OPCIONES.find((o) => o.value === s.despacho_cancelacion)?.label}</strong>
            </div>
          )}
          {MOTIVO_STATUSES.includes(s.delivery_status) && s.motivo_estado && (
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', maxWidth: 220, textAlign: 'right', whiteSpace: 'normal' }}>
              <strong>Motivo:</strong> {s.motivo_estado}
            </div>
          )}
          {s.delivery_type !== 'delivery' && (
            <Badge label={deliveryTypeLabel(s.delivery_type)} color={DELIVERY_TYPE_LABELS[s.delivery_type]?.color} />
          )}
          {canManage && (
            <>
              <select
                value={s.delivery_status}
                onChange={(e) => onStatusChange(s, e.target.value)}
                style={{ fontSize: 12, padding: '4px 6px', borderRadius: 4, border: '1px solid var(--color-border)' }}
              >
                {DELIVERY_STATUS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{deliveryStatusLabel(opt)}</option>
                ))}
              </select>
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: 11, padding: '3px 8px' }}
                  onClick={() => onToggleTypeMenu(s.id)}
                >
                  Tipo de envío ▾
                </button>
                {menuTipoAbierto && (
                  <div className="card" style={{ position: 'absolute', top: '110%', right: 0, padding: 6, width: 190, zIndex: 20 }}>
                    {DELIVERY_TYPE_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        className="btn btn-secondary"
                        style={{ width: '100%', justifyContent: 'flex-start', fontSize: 12, marginBottom: 4 }}
                        onClick={() => onTypeChange(s, opt)}
                      >
                        {deliveryTypeLabel(opt)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </td>
      <td data-label="Fecha creación">{formatDate(s.created_at)}</td>
      <td data-label="Fecha en camino">{formatDate(s.en_camino_at)}</td>
      <td data-label="Acciones">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <BotonCopiarEtiqueta obtenerTexto={() => textoEtiquetaVenta(s)} />
          {canManage && (
            <>
              <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => onEdit(s)}>
                Editar
              </button>
              <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => onPrint(s)}>
                Imprimir etiqueta
              </button>
              {isAdmin && (
                <button
                  className="btn btn-secondary"
                  style={{ padding: '6px 10px', fontSize: 12, color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                  onClick={() => onDelete(s)}
                >
                  Eliminar
                </button>
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

export default memo(FilaEnvio);
