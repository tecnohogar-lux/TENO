import { useState } from 'react';
import Layout from '../components/Layout';
import useFetch from '../hooks/useFetch';
import useApi from '../hooks/useApi';
import useAuth from '../hooks/useAuth';
import useConfirm from '../hooks/useConfirm';

const emptyForm = { name: '', email: '', password: '', role: 'vendedor', marketplace_accounts: '' };

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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-field">
              <label>Nombre</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
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
                <th>Email</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Cuentas de Marketplace</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.users.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ color: 'var(--color-text-muted)' }}>Sin usuarios registrados</td>
                </tr>
              ) : (
                data.users.map((u) => (
                  <tr key={u.id}>
                    <td data-label="Nombre">{u.name}</td>
                    <td data-label="Email">{u.email}</td>
                    <td data-label="Rol">{u.role}</td>
                    <td data-label="Estado">{u.is_active ? 'Activo' : 'Inactivo'}</td>
                    <td data-label="Marketplace">{u.marketplace_accounts || '-'}</td>
                    <td data-label="Acciones">
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
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
              <label>Email</label>
              <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} required />
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

      {confirmDialog}
    </Layout>
  );
}
