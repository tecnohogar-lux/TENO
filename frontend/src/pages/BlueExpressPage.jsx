import { useMemo, useState } from 'react';
import Layout from '../components/Layout';
import Badge from '../components/Badge';
import LabelPrint from '../components/LabelPrint';
import LabelPrintBatch from '../components/LabelPrintBatch';
import SearchableSelect from '../components/SearchableSelect';
import ShipmentItemsInput from '../components/ShipmentItemsInput';
import useFetch from '../hooks/useFetch';
import useApi from '../hooks/useApi';
import useAuth from '../hooks/useAuth';
import useConfirm from '../hooks/useConfirm';
import useDebouncedValue from '../hooks/useDebouncedValue';
import { formatCurrency, formatDate } from '../utils/format';
import { productPrice } from '../utils/priceType';
import { DELIVERY_STATUS_LABELS, DELIVERY_STATUS_OPTIONS, deliveryStatusLabel } from '../utils/labels';

const FREE_PRODUCT_OPTION = [{ value: '__free__', label: 'Producto libre (no registrado)' }];

const emptyCreateForm = {
  vendor_id: '',
  nombre: '',
  apellido: '',
  items: [],
  region: '',
  comuna: '',
  precio_envio: '',
  address: '',
  phone: '',
  notes: '',
};

// Envíos Regiones: mismo módulo que Delivery Santiago, pero para despachos
// fuera de la Región Metropolitana a través del courier BlueExpress (por eso
// el campo de región, además de dirección/comuna). Los vendedores pueden
// crearlos igual que en Delivery Santiago.
export default function BlueExpressPage() {
  const { user } = useAuth();
  const canManage = user.role === 'operador' || user.role === 'admin' || user.role === 'caja';
  const isAdmin = user.role === 'admin';

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const { data, loading, error, refetch } = useFetch(
    `/api/sales?tipo_venta=ENVIO_REGION&search=${encodeURIComponent(debouncedSearch)}`,
    { deps: [debouncedSearch] }
  );
  const { data: usersData } = useFetch('/api/users', { enabled: canManage });
  const { data: productsData } = useFetch('/api/products/catalog');
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
  const editProductOptions = useMemo(
    () => (productsData?.products || []).map((p) => ({ value: p.id, label: `${p.title} · ${formatCurrency(productPrice(p, editingSale?.price_type))}${p.agotado ? ' (agotado)' : ''}` })),
    [productsData, editingSale]
  );

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
    const ok = await confirm(`¿Eliminar el envío a región "${sale.product_name}" de ${sale.client_name}? Podrás recuperarlo desde la Papelera.`, {
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
    const matchingProduct = (productsData?.products || []).find((p) => p.title === sale.product_name);
    setEditForm({
      vendor_id: String(sale.vendor_id),
      client_name: sale.client_name,
      productSelection: matchingProduct ? String(matchingProduct.id) : '__free__',
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

  function handleEditProductSelect(value) {
    if (value === '__free__') {
      setEditForm({ ...editForm, productSelection: value, product_name: '' });
      return;
    }
    const product = (productsData?.products || []).find((p) => String(p.id) === value);
    setEditForm({ ...editForm, productSelection: value, product_name: product ? product.title : '' });
  }

  const precioProductoCreate = createForm.items.reduce((sum, i) => sum + i.quantity * i.price, 0);

  async function handleCreateSubmit(e) {
    e.preventDefault();
    if (createForm.items.length === 0) return;
    if (!createForm.nombre.trim() || !createForm.apellido.trim()) return;
    const payload = {
      tipo_venta: 'ENVIO_REGION',
      items: createForm.items.map(({ product_name, quantity, price, price_type }) => ({ product_name, quantity, price, price_type })),
      precio_envio: Number(createForm.precio_envio) || 0,
      address: createForm.address,
      comuna: createForm.comuna,
      region: createForm.region,
      phone: createForm.phone,
      notes: createForm.notes,
      client: { name: `${createForm.nombre.trim()} ${createForm.apellido.trim()}` },
    };
    if (canManage) payload.vendor_id = Number(createForm.vendor_id);

    const result = await post('/api/sales', payload);
    if (result.success) {
      setCreateForm(emptyCreateForm);
      setShowCreateForm(false);
      refetch();
    }
  }

  return (
    <Layout>
      <div className="card" style={{ padding: 20, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>Cotizador de Blue Express</h3>
          <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: 13 }}>
            Cotiza el envío por origen, destino y talla.
          </p>
        </div>
        <a
          className="btn btn-primary"
          href="https://www.blue.cl/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: 'none' }}
        >
          Abrir cotizador
        </a>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>Envíos Regiones</h1>
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
          <div className="form-grid-2" style={{ gap: 16 }}>
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
              <div style={{ display: 'flex', gap: 8 }}>
                <input placeholder="Nombre" value={createForm.nombre} onChange={(e) => setCreateForm({ ...createForm, nombre: e.target.value })} required style={{ flex: 1, minWidth: 0 }} />
                <input placeholder="Apellido" value={createForm.apellido} onChange={(e) => setCreateForm({ ...createForm, apellido: e.target.value })} required style={{ flex: 1, minWidth: 0 }} />
              </div>
            </div>

            <ShipmentItemsInput
              hideSol={user.role === 'vendedor'}
              products={productsData?.products || []}
              items={createForm.items}
              onChange={(items) => setCreateForm({ ...createForm, items })}
            />

            <div className="form-field">
              <label>Región</label>
              <input value={createForm.region} onChange={(e) => setCreateForm({ ...createForm, region: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>Comuna</label>
              <input value={createForm.comuna} onChange={(e) => setCreateForm({ ...createForm, comuna: e.target.value })} required />
            </div>

            <div className="form-field">
              <label>Precio producto</label>
              <input value={formatCurrency(precioProductoCreate)} readOnly />
            </div>
            <div className="form-field">
              <label>Precio envío</label>
              <input type="number" min="0" value={createForm.precio_envio} onChange={(e) => setCreateForm({ ...createForm, precio_envio: e.target.value })} required />
            </div>

            <div className="form-field">
              <label>Dirección</label>
              <input value={createForm.address} onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>Teléfono</label>
              <input value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} required />
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 13, color: 'var(--color-text-muted)', marginTop: -4, marginBottom: 12 }}>
            Total: {formatCurrency(precioProductoCreate + (Number(createForm.precio_envio) || 0))}
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
                  <td colSpan={canManage ? 11 : 9} style={{ color: 'var(--color-text-muted)' }}>Sin envíos a regiones que coincidan con el filtro</td>
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
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Editar envío a región</h3>
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
              <input value={editForm.client_name} disabled />
            </div>
            {editingSale.items ? (
              <div className="form-field">
                <label>Productos</label>
                <div style={{ fontSize: 14, lineHeight: 1.5 }}>{editingSale.product_name}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
                  Este envío tiene varios productos con su propio tipo de precio; no se pueden editar aquí.
                </div>
              </div>
            ) : (
              <>
            <div className="form-field">
              <label>Producto</label>
              <SearchableSelect
                value={editForm.productSelection}
                onChange={handleEditProductSelect}
                options={editProductOptions}
                pinnedOptions={FREE_PRODUCT_OPTION}
                placeholder="Selecciona un producto"
                required
              />
              {editForm.productSelection === '__free__' && (
                <input
                  placeholder="Nombre del producto"
                  value={editForm.product_name}
                  onChange={(e) => setEditForm({ ...editForm, product_name: e.target.value })}
                  style={{ marginTop: 8 }}
                  required
                />
              )}
            </div>
            <div className="form-field">
              <label>Cantidad</label>
              <input type="number" min="1" value={editForm.quantity} onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>Monto total</label>
              <input type="number" min="0" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} required />
            </div>
              </>
            )}
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
