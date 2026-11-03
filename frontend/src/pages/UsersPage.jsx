import { useState } from 'react';
import Layout from '../components/Layout';
import useFetch from '../hooks/useFetch';
import useApi from '../hooks/useApi';
import useAuth from '../hooks/useAuth';
import useConfirm from '../hooks/useConfirm';
import { formatCurrency } from '../utils/format';

const emptyForm = { name: '', email: '', password: '', role: 'vendedor', marketplace_accounts: '' };

// Porcentaje de comisión que tiene un vendedor mientras un admin no le fije otro.
const COMISION_ESTANDAR = 25;
// Producto de ejemplo para mostrar el cálculo en el diálogo de comisión.
const EJEMPLO_PRECIO = 10000;
const EJEMPLO_COSTO = 6000;

function porcentajeDe(u) {
  return u.comision_porcentaje !== null && u.comision_porcentaje !== undefined ? Number(u.comision_porcentaje) : COMISION_ESTANDAR;
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const { data, loading, error, refetch } = useFetch('/api/users');
  const { post, put, del, loading: saving, error: saveError } = useApi();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [comisionUser, setComisionUser] = useState(null);
  const [comisionValor, setComisionValor] = useState('');
  const [comisionError, setComisionError] = useState('');
  const esAdmin = currentUser.role === 'admin';

  function openComision(u) {
    setComisionUser(u);
    setComisionValor(String(porcentajeDe(u)));
    setComisionError('');
  }

  async function handleComisionSubmit(e) {
    e.preventDefault();
    const porcentaje = Number(comisionValor);
    if (comisionValor.trim() === '' || !Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 100) {
      setComisionError('Ingresa un porcentaje entre 0 y 100');
      return;
    }
    const result = await put(`/api/users/${comisionUser.id}/comision`, { porcentaje });
    if (result.success) {
      setComisionUser(null);
      refetch();
    } else {
      setComisionError(result.error || 'No se pudo guardar la comisión');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const result = await post('/api/users', form);
    if (result.success) {
      setForm(emptyForm);
      setShowForm(false);
      refetch();
    }
  }

  function openEdit(u) {
    setEditingUser(u);
    setEditForm({ name: u.name, email: u.email, role: u.role, is_active: u.is_active, password: '', marketplace_accounts: u.marketplace_accounts || '' });
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    const payload = {
      name: editForm.name,
      email: editForm.email,
      role: editForm.role,
      is_active: editForm.is_active,
      marketplace_accounts: editForm.marketplace_accounts,
    };
    if (editForm.password) payload.password = editForm.password;
    const result = await put(`/api/users/${editingUser.id}`, payload);
    if (result.success) {
      setEditingUser(null);
      refetch();
    }
  }

  async function handleDelete(u) {
    setDeleteError('');
    const ok = await confirm(`¿Eliminar el usuario "${u.name}"? Esta acción no se puede deshacer.`, {
      title: 'Eliminar usuario',
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    const result = await del(`/api/users/${u.id}`);
    if (result.success) refetch();
    else if (result.error) setDeleteError(result.error);
  }

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Usuarios</h1>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancelar' : 'Nuevo usuario'}
        </button>
      </div>

      {deleteError && <div className="alert alert-error">{deleteError}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="card" style={{ padding: 20, marginBottom: 24 }}>
          {saveError && <div className="alert alert-error">{saveError}</div>}
          <div className="form-grid-2" style={{ gap: 16 }}>
            <div className="form-field">
              <label>Nombre</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>Usuario</label>
              <input type="text" autoCapitalize="none" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>Contraseña</label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>Rol</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="vendedor">Vendedor</option>
                <option value="operador">Operador</option>
                <option value="admin">Admin</option>
                <option value="escaneo">Escaneo</option>
                <option value="caja">Caja</option>
              </select>
            </div>
            <div className="form-field" style={{ gridColumn: '1 / -1' }}>
              <label>Nombre de Cuentas de Marketplace</label>
              <input
                placeholder="Ej: MercadoLibre - tienda123, Falabella - miNegocio"
                value={form.marketplace_accounts}
                onChange={(e) => setForm({ ...form, marketplace_accounts: e.target.value })}
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar usuario'}
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
          <table className="responsive-stack">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Cuentas de Marketplace</th>
                {esAdmin && <th>Comisión</th>}
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.users.length === 0 ? (
                <tr>
                  <td colSpan={esAdmin ? 7 : 6} style={{ color: 'var(--color-text-muted)' }}>Sin usuarios registrados</td>
                </tr>
              ) : (
                data.users.map((u) => (
                  <tr key={u.id}>
                    <td data-label="Nombre">{u.name}</td>
                    <td data-label="Usuario">{u.email}</td>
                    <td data-label="Rol">{u.role}</td>
                    <td data-label="Estado">{u.is_active ? 'Activo' : 'Inactivo'}</td>
                    <td data-label="Marketplace">{u.marketplace_accounts || '-'}</td>
                    {esAdmin && (
                      <td data-label="Comisión">
                        {u.role === 'vendedor' ? (
                          <span style={porcentajeDe(u) !== COMISION_ESTANDAR ? { fontWeight: 600, color: 'var(--color-primary)' } : undefined}>
                            {porcentajeDe(u)}%
                          </span>
                        ) : '-'}
                      </td>
                    )}
                    <td data-label="Acciones">
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        {esAdmin && u.role === 'vendedor' && (
                          <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => openComision(u)}>
                            Editar comisión
                          </button>
                        )}
                        <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => openEdit(u)}>
                          Editar
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '6px 10px', fontSize: 12, color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                          disabled={currentUser.id === u.id}
                          onClick={() => handleDelete(u)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {editingUser && editForm && (
        <div className="modal-overlay">
          <form className="modal-panel" onSubmit={handleEditSubmit}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Editar usuario</h3>
            {saveError && <div className="alert alert-error">{saveError}</div>}
            <div className="form-field">
              <label>Nombre</label>
              <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>Usuario</label>
              <input type="text" autoCapitalize="none" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>Nueva contraseña (opcional)</label>
              <input type="password" placeholder="Dejar en blanco para no cambiar" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Rol</label>
              <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                <option value="vendedor">Vendedor</option>
                <option value="operador">Operador</option>
                <option value="admin">Admin</option>
                <option value="escaneo">Escaneo</option>
                <option value="caja">Caja</option>
              </select>
            </div>
            <div className="form-field">
              <label>Estado</label>
              <select value={editForm.is_active ? 'true' : 'false'} onChange={(e) => setEditForm({ ...editForm, is_active: e.target.value === 'true' })}>
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </select>
            </div>
            <div className="form-field">
              <label>Nombre de Cuentas de Marketplace</label>
              <input
                placeholder="Ej: MercadoLibre - tienda123, Falabella - miNegocio"
                value={editForm.marketplace_accounts}
                onChange={(e) => setEditForm({ ...editForm, marketplace_accounts: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditingUser(null)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {comisionUser && (() => {
        const pct = Number(comisionValor);
        const valido = comisionValor.trim() !== '' && Number.isFinite(pct) && pct >= 0 && pct <= 100;
        const utilidad = EJEMPLO_PRECIO - EJEMPLO_COSTO;
        return (
          <div className="modal-overlay">
            <form className="modal-panel" onSubmit={handleComisionSubmit}>
              <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>Editar comisión</h3>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--color-text-muted)' }}>Vendedor: <strong style={{ color: 'var(--color-text)' }}>{comisionUser.name}</strong></p>
              {comisionError && <div className="alert alert-error">{comisionError}</div>}

              <div className="form-field">
                <label>Cálculo de la comisión</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>Comisión =</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="100"
                    step="0.01"
                    style={{ width: 90 }}
                    value={comisionValor}
                    onChange={(e) => { setComisionValor(e.target.value); setComisionError(''); }}
                    autoFocus
                    required
                  />
                  <span style={{ fontSize: 14 }}>%</span>
                </div>
                <div style={{ fontSize: 14, marginTop: 6 }}>× (precio de venta − costo)</div>
              </div>

              <div style={{ fontSize: 13, color: 'var(--color-text-muted)', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 12px', marginBottom: 16 }}>
                <div style={{ marginBottom: 4 }}>Ejemplo: producto de {formatCurrency(EJEMPLO_PRECIO)} con costo {formatCurrency(EJEMPLO_COSTO)}</div>
                <div>
                  {valido ? `${pct}% × ${formatCurrency(utilidad)} = ` : ''}
                  <strong style={{ color: 'var(--color-text)' }}>{valido ? formatCurrency(Math.round(utilidad * pct) / 100) : 'Ingresa un porcentaje válido'}</strong> por unidad
                </div>
              </div>

              <p style={{ margin: '0 0 16px', fontSize: 12, color: 'var(--color-text-muted)' }}>
                Solo cambia la comisión de este vendedor. El porcentaje estándar es {COMISION_ESTANDAR}%. Se aplica a las ventas que se registren o editen desde ahora; las ventas ya hechas conservan su comisión.
              </p>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving || !valido}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setComisionUser(null)}>Cancelar</button>
              </div>
              {pct !== COMISION_ESTANDAR && (
                <button type="button" className="btn btn-secondary" style={{ width: '100%', marginTop: 12, fontSize: 12 }} onClick={() => { setComisionValor(String(COMISION_ESTANDAR)); setComisionError(''); }}>
                  Volver al estándar ({COMISION_ESTANDAR}%)
                </button>
              )}
            </form>
          </div>
        );
      })()}

      {confirmDialog}
    </Layout>
  );
}
