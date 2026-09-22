import { useMemo, useState } from 'react';
import Layout from '../components/Layout';
import Badge from '../components/Badge';
import LabelPrint from '../components/LabelPrint';
import LabelPrintBatch from '../components/LabelPrintBatch';
import SearchableSelect from '../components/SearchableSelect';
import useFetch from '../hooks/useFetch';
import useApi from '../hooks/useApi';
import useAuth from '../hooks/useAuth';
import useConfirm from '../hooks/useConfirm';
import useDebouncedValue from '../hooks/useDebouncedValue';
import { formatCurrency, formatDate } from '../utils/format';
import { DELIVERY_STATUS_LABELS, DELIVERY_STATUS_OPTIONS, deliveryStatusLabel } from '../utils/labels';

const emptyNewClient = { name: '', address: '', phone: '', email: '' };
const emptyCreateForm = {
  vendor_id: '',
  useExistingClient: true,
  client_id: '',
  newClient: emptyNewClient,
  product_name: '',
  quantity: '',
  region: '',
  comuna: '',
  precio_producto: '',
  precio_envio: '',
  address: '',
  phone: '',
  notes: '',
};

// Envíos BlueExpress: mismo módulo que Delivery Santiago, pero para despachos
// fuera de la Región Metropolitana a través del courier BlueExpress (por eso
// el campo de región, además de dirección/comuna). Los vendedores pueden
// crearlos igual que en Delivery Santiago.
export default function BlueExpressPage() {
  const { user } = useAuth();
  const canManage = user.role === 'operador' || user.role === 'admin';
  const isAdmin = user.role === 'admin';

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const { data, loading, error, refetch } = useFetch(
    `/api/sales?search=${encodeURIComponent(debouncedSearch)}`,
    { deps: [debouncedSearch] }
  );
  const { data: usersData } = useFetch('/api/users', { enabled: canManage });
  const { data: clientsData } = useFetch('/api/clients');
  const { data: regionShippingData } = useFetch('/api/region-shipping');
  const { post, put, del, loading: saving, error: saveError } = useApi();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [statusFilter, setStatusFilter] = useState('todos');
  const [selectedIds, setSelectedIds] = useState([]);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [bulkStatusPanel, setBulkStatusPanel] = useState(false);
  const [bulkStatusValue, setBulkStatusValue] = useState('en_camino');
  const [printSale, setPrintSale] = useState(null);
  const [printBatch, setPrintBatch] = useState(null);
  const [editingSale, setEditingSale] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [actionError, setActionError] = useState('');

  const vendedores = (usersData?.users || []).filter((u) => u.role === 'vendedor' && u.is_active);
  const vendorOptions = useMemo(() => vendedores.map((v) => ({ value: v.id, label: v.name })), [vendedores]);
  const clientOptions = useMemo(() => (clientsData?.clients || []).map((c) => ({ value: c.id, label: c.name })), [clientsData]);
  const regiones = [...new Set((regionShippingData?.costos || []).map((c) => c.region))].sort();
  const comunasDeRegion = (regionShippingData?.costos || []).filter((c) => c.region === createForm.region);

  const shipments = useMemo(() => {
    const all = (data?.sales || []).filter((s) => s.tipo_venta === 'ENVIO_REGION');
    if (statusFilter === 'todos') return all;
    return all.filter((s) => s.delivery_status === statusFilter);
  }, [data, statusFilter]);

  const allSelected = shipments.length > 0 && selectedIds.length === shipments.length;

  function toggleSelect(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleSelectAll() {
    setSelectedIds(allSelected ? [] : shipments.map((s) => s.id));
  }

  async function handleStatusChange(sale, newStatus) {
    setActionError('');
    const result = await put(`/api/sales/${sale.id}/status`, { status: newStatus });
    if (result.success) refetch();
    else if (result.error) setActionError(result.error);
  }

  async function handleBulkStatus() {
    setActionError('');
    const result = await put('/api/sales/batch-status', { ids: selectedIds, status: bulkStatusValue });
    if (result.success) {
      setSelectedIds([]);
      setBulkStatusPanel(false);
      setActionsOpen(false);
      refetch();
    } else if (result.error) {
      setActionError(result.error);
    }
  }

  async function handleDelete(sale) {
    setActionError('');
    const ok = await confirm(`¿Eliminar el envío BlueExpress "${sale.product_name}" de ${sale.client_name}? Podrás recuperarlo desde la Papelera.`, {
      title: 'Eliminar envío',
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    const result = await del(`/api/sales/${sale.id}`);
    if (result.success) refetch();
    else if (result.error) setActionError(result.error);
  }

  function openBulkPrint() {
    const selected = shipments.filter((s) => selectedIds.includes(s.id));
    setPrintBatch(selected);
    setActionsOpen(false);
  }

  function openEdit(sale) {
    setEditingSale(sale);
    setEditForm({
      vendor_id: String(sale.vendor_id),
      client_id: String(sale.client_id),
      product_name: sale.product_name,
      quantity: sale.quantity,
      price: sale.total,
      address: sale.address || '',
      comuna: sale.comuna || '',
      phone: sale.phone || '',
      notes: sale.notes || '',
    });
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    const quantity = Number(editForm.quantity);
    // El campo "Monto total" es el total, no el precio unitario que espera el backend.
    const price = Number(editForm.price) / quantity;
    const payload = {
      product_name: editForm.product_name,
      quantity,
      price,
      client_id: Number(editForm.client_id),
      address: editForm.address,
      comuna: editForm.comuna,
      phone: editForm.phone,
      notes: editForm.notes,
    };
    if (canManage) payload.vendor_id = Number(editForm.vendor_id);

    const result = await put(`/api/sales/${editingSale.id}`, payload);
    if (result.success) {
      setEditingSale(null);
      refetch();
    }
  }

  function handleRegionComunaChange(comuna) {
    const match = comunasDeRegion.find((c) => c.comuna === comuna);
    setCreateForm({ ...createForm, comuna, precio_envio: match ? String(match.precio) : createForm.precio_envio });
  }

  async function handleCreateSubmit(e) {
    e.preventDefault();
    const quantity = Number(createForm.quantity);
    const precioProducto = Number(createForm.precio_producto);
    const precioEnvio = Number(createForm.precio_envio) || 0;
    const total = precioProducto + precioEnvio;
    // El backend calcula total = cantidad * price; despejamos el precio unitario para que coincida.
    const price = total / quantity;
    const payload = {
      tipo_venta: 'ENVIO_REGION',
      product_name: createForm.product_name,
      quantity,
      price,
      precio_producto: precioProducto,
      precio_envio: precioEnvio,
      address: createForm.address,
      comuna: createForm.comuna,
      region: createForm.region,
      phone: createForm.phone,
      notes: createForm.notes,
    };
    if (canManage) payload.vendor_id = Number(createForm.vendor_id);
    if (createForm.useExistingClient) payload.client_id = Number(createForm.client_id);
    else payload.client = createForm.newClient;

    const result = await post('/api/sales', payload);
    if (result.success) {
      setCreateForm(emptyCreateForm);
      setShowCreateForm(false);
      refetch();
    }
  }

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>Envíos BlueExpress</h1>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 4, marginBottom: 0, fontSize: 13 }}>
            Despachos a regiones fuera de la Región Metropolitana.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            placeholder="Buscar por vendedor, cliente, producto, comuna..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--color-border)', width: 260, background: 'var(--color-surface)', color: 'var(--color-text)' }}
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--color-border)' }}>
            <option value="todos">Todos los estados</option>
            {DELIVERY_STATUS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{deliveryStatusLabel(opt)}</option>
            ))}
          </select>

          {canManage && (
            <div style={{ position: 'relative' }}>
              <button
                className="btn btn-secondary"
                disabled={selectedIds.length === 0}
                onClick={() => setActionsOpen((v) => !v)}
              >
                Acciones ({selectedIds.length}) ▾
              </button>
              {actionsOpen && selectedIds.length > 0 && (
                <div className="card" style={{ position: 'absolute', top: '110%', right: 0, padding: 8, width: 220, zIndex: 20 }}>
                  <button
                    className="btn btn-secondary"
                    style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 4 }}
                    onClick={() => setBulkStatusPanel((v) => !v)}
                  >
                    Editar estado
                  </button>
                  {bulkStatusPanel && (
                    <div style={{ display: 'flex', gap: 6, padding: '6px 4px 10px' }}>
                      <select
                        value={bulkStatusValue}
                        onChange={(e) => setBulkStatusValue(e.target.value)}
                        style={{ flex: 1, fontSize: 12, padding: '4px 6px', borderRadius: 4, border: '1px solid var(--color-border)' }}
                      >
                        {DELIVERY_STATUS_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{deliveryStatusLabel(opt)}</option>
                        ))}
                      </select>
                      <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={handleBulkStatus}>
                        Aplicar
                      </button>
                    </div>
                  )}
                  <button
                    className="btn btn-secondary"
                    style={{ width: '100%', justifyContent: 'flex-start' }}
                    onClick={openBulkPrint}
                  >
                    Imprimir etiquetas
                  </button>
                </div>
              )}
            </div>
          )}

          <button className="btn btn-primary" onClick={() => setShowCreateForm((v) => !v)}>
            {showCreateForm ? 'Cancelar' : 'Nueva etiqueta'}
          </button>
        </div>
      </div>

      {actionError && <div className="alert alert-error">{actionError}</div>}

      {showCreateForm && (
        <form onSubmit={handleCreateSubmit} className="card" style={{ padding: 20, marginBottom: 24 }}>
          {saveError && <div className="alert alert-error">{saveError}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-field">
              <label>Vendedor</label>
              {canManage ? (
                <SearchableSelect
                  value={createForm.vendor_id}
                  onChange={(v) => setCreateForm({ ...createForm, vendor_id: v })}
                  options={vendorOptions}
                  placeholder="Selecciona un vendedor"
                  required
                />
              ) : (
                <input value={user.name} disabled />
              )}
            </div>

            <div className="form-field">
              <label>Cliente</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <button type="button" className={createForm.useExistingClient ? 'btn btn-primary' : 'btn btn-secondary'} style={{ flex: 1, padding: '6px' }} onClick={() => setCreateForm({ ...createForm, useExistingClient: true })}>
                  Existente
                </button>
                <button type="button" className={!createForm.useExistingClient ? 'btn btn-primary' : 'btn btn-secondary'} style={{ flex: 1, padding: '6px' }} onClick={() => setCreateForm({ ...createForm, useExistingClient: false })}>
                  Nuevo
                </button>
              </div>
              {createForm.useExistingClient ? (
                <SearchableSelect
                  value={createForm.client_id}
                  onChange={(v) => setCreateForm({ ...createForm, client_id: v })}
                  options={clientOptions}
                  placeholder="Selecciona un cliente"
                  required={createForm.useExistingClient}
                />
              ) : (
                <input
                  placeholder="Nombre del cliente nuevo"
                  value={createForm.newClient.name}
                  onChange={(e) => setCreateForm({ ...createForm, newClient: { ...createForm.newClient, name: e.target.value } })}
                  required={!createForm.useExistingClient}
                />
              )}
            </div>

            <div className="form-field">
              <label>Producto</label>
              <input value={createForm.product_name} onChange={(e) => setCreateForm({ ...createForm, product_name: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>Cantidad</label>
              <input type="number" min="1" value={createForm.quantity} onChange={(e) => setCreateForm({ ...createForm, quantity: e.target.value })} required />
            </div>

            <div className="form-field">
              <label>Región</label>
              <select value={createForm.region} onChange={(e) => setCreateForm({ ...createForm, region: e.target.value, comuna: '', precio_envio: '' })} required>
                <option value="">Selecciona una región</option>
                {regiones.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Comuna</label>
              <select value={createForm.comuna} onChange={(e) => handleRegionComunaChange(e.target.value)} required disabled={!createForm.region}>
                <option value="">Selecciona una comuna</option>
                {comunasDeRegion.map((c) => (
                  <option key={c.id} value={c.comuna}>{c.comuna} · {formatCurrency(c.precio)}</option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>Precio producto</label>
              <input type="number" min="0" value={createForm.precio_producto} onChange={(e) => setCreateForm({ ...createForm, precio_producto: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>Precio envío</label>
              <input type="number" min="0" value={createForm.precio_envio} onChange={(e) => setCreateForm({ ...createForm, precio_envio: e.target.value })} required />
            </div>

            <div className="form-field">
              <label>Dirección</label>
              <input value={createForm.address} onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Teléfono</label>
              <input value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} />
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 13, color: 'var(--color-text-muted)', marginTop: -4, marginBottom: 12 }}>
            Total: {formatCurrency((Number(createForm.precio_producto) || 0) + (Number(createForm.precio_envio) || 0))}
          </div>
          <div className="form-field">
            <label>Notas</label>
            <textarea rows={2} value={createForm.notes} onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar etiqueta'}
          </button>
        </form>
      )}

      {loading && (
        <div className="page-loading">
          <div className="spinner" />
        </div>
      )}
      {error && <div className="alert alert-error">{error}</div>}

      {data && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ overflowX: 'auto' }}>
          <table className="responsive-stack">
            <thead>
              <tr>
                {canManage && (
                  <th style={{ width: 24 }}>
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                  </th>
                )}
                <th>Producto</th>
                <th>Cliente</th>
                <th>Vendedor</th>
                <th>Región</th>
                <th>Comuna</th>
                <th>Dirección</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Fecha</th>
                {canManage && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {shipments.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 11 : 9} style={{ color: 'var(--color-text-muted)' }}>Sin envíos BlueExpress que coincidan con el filtro</td>
                </tr>
              ) : (
                shipments.map((s) => (
                  <tr key={s.id}>
                    {canManage && (
                      <td data-label="Seleccionar">
                        <input type="checkbox" checked={selectedIds.includes(s.id)} onChange={() => toggleSelect(s.id)} />
                      </td>
                    )}
                    <td data-label="Producto">{s.product_name}</td>
                    <td data-label="Cliente">{s.client_name}</td>
                    <td data-label="Vendedor">{s.vendor_name}</td>
                    <td data-label="Región">{s.region || '-'}</td>
                    <td data-label="Comuna">{s.comuna || '-'}</td>
                    <td data-label="Dirección">{s.address || '-'}</td>
                    <td data-label="Total">{formatCurrency(s.total)}</td>
                    <td data-label="Estado">
                      {canManage ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                          <Badge label={deliveryStatusLabel(s.delivery_status)} color={DELIVERY_STATUS_LABELS[s.delivery_status]?.color} />
                          <select
                            value={s.delivery_status}
                            onChange={(e) => handleStatusChange(s, e.target.value)}
                            style={{ fontSize: 12, padding: '4px 6px', borderRadius: 4, border: '1px solid var(--color-border)' }}
                          >
                            {DELIVERY_STATUS_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>{deliveryStatusLabel(opt)}</option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <Badge label={deliveryStatusLabel(s.delivery_status)} color={DELIVERY_STATUS_LABELS[s.delivery_status]?.color} />
                      )}
                    </td>
                    <td data-label="Fecha">{formatDate(s.created_at)}</td>
                    {canManage && (
                      <td data-label="Acciones">
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => openEdit(s)}>
                            Editar
                          </button>
                          <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => setPrintSale(s)}>
                            Imprimir etiqueta
                          </button>
                          {isAdmin && (
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '6px 10px', fontSize: 12, color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                              onClick={() => handleDelete(s)}
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {printSale && <LabelPrint sale={printSale} onClose={() => setPrintSale(null)} onPrinted={refetch} />}
      {printBatch && <LabelPrintBatch sales={printBatch} onClose={() => setPrintBatch(null)} onPrinted={refetch} />}

      {editingSale && editForm && (
        <div className="modal-overlay">
          <form className="modal-panel" style={{ width: 460, maxHeight: '85vh', overflowY: 'auto' }} onSubmit={handleEditSubmit}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Editar envío BlueExpress</h3>
            {saveError && <div className="alert alert-error">{saveError}</div>}

            {canManage && (
              <div className="form-field">
                <label>Vendedor</label>
                <SearchableSelect
                  value={editForm.vendor_id}
                  onChange={(v) => setEditForm({ ...editForm, vendor_id: v })}
                  options={vendorOptions}
                  placeholder="Selecciona un vendedor"
                  required
                />
              </div>
            )}
            <div className="form-field">
              <label>Cliente</label>
              <SearchableSelect
                value={editForm.client_id}
                onChange={(v) => setEditForm({ ...editForm, client_id: v })}
                options={clientOptions}
                placeholder="Selecciona un cliente"
                required
              />
            </div>
            <div className="form-field">
              <label>Producto</label>
              <input value={editForm.product_name} onChange={(e) => setEditForm({ ...editForm, product_name: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>Cantidad</label>
              <input type="number" min="1" value={editForm.quantity} onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>Monto total</label>
              <input type="number" min="0" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>Dirección</label>
              <input value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Comuna</label>
              <input value={editForm.comuna} onChange={(e) => setEditForm({ ...editForm, comuna: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Teléfono</label>
              <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Notas</label>
              <textarea rows={2} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditingSale(null)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {confirmDialog}
    </Layout>
  );
}
