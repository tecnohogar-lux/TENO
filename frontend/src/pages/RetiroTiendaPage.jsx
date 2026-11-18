import BotonCopiarEtiqueta from '../components/BotonCopiarEtiqueta';
import { textoEtiquetaRetiro } from '../utils/etiquetaTexto';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import Badge from '../components/Badge';
import Pagination from '../components/Pagination';
import TablaCompacta from '../components/TablaCompacta';
import VistaToggle from '../components/VistaToggle';
import useVistaCompacta from '../hooks/useVistaCompacta';
import SearchableSelect from '../components/SearchableSelect';
import PriceTypeToggle from '../components/PriceTypeToggle';
import useFetch from '../hooks/useFetch';
import useApi from '../hooks/useApi';
import useAuth from '../hooks/useAuth';
import useConfirm from '../hooks/useConfirm';
import { formatCurrency, formatDate } from '../utils/format';
import PriceTypeBadge from '../components/PriceTypeBadge';
import { lineaParaEnviar, precioCatalogoDeGuardada } from '../utils/precioLinea';
import { showNewSale } from '../store/useNuevaVentaStore';
import { MIN_MAYOR, productPrice } from '../utils/priceType';
import BuscadorConBoton from '../components/BuscadorConBoton';
import BarraCarga from '../components/BarraCarga';
import useBorrador from '../hooks/useBorrador';
import useRepreciarBorrador from '../hooks/useRepreciarBorrador';
import FormPaso from '../components/FormPaso';
import CantidadStepper from '../components/CantidadStepper';
import LineasProductos from '../components/LineasProductos';
import NotaOpcional from '../components/NotaOpcional';
import ResumenFormulario, { pasoResumen } from '../components/ResumenFormulario';
import { irAlPrimerError } from '../utils/formulario';

const PAGE_SIZE = 25;
const emptyForm = { nombre: '', apellido: '', notes: '' };

export default function RetiroTiendaPage() {
  const { user } = useAuth();
  // Vista completa (todos los datos) o compacta (cliente, vendedor, producto y día/mes). Se recuerda.
  const [compacta, cambiarVista] = useVistaCompacta('teno_retiros_vista');
  const navigate = useNavigate();
  const canManage = user.role === 'operador' || user.role === 'admin' || user.role === 'caja';
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, loading, error, refetch } = useFetch(
    `/api/retiros-tienda?page=${page}&limit=${PAGE_SIZE}&search=${encodeURIComponent(search)}`,
    { deps: [page, search] }
  );
  const { data: productsData } = useFetch('/api/products/catalog');
  const { post, put, del, loading: saving, error: saveError } = useApi();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [editingRetiro, setEditingRetiro] = useState(null);
  const [actionError, setActionError] = useState('');

  function handleSearchChange(value) {
    setSearch(value);
    setPage(1);
  }

  // Un retiro nuevo se guarda como borrador (no se pierde si el teléfono descarta la pestaña al minimizar);
  // al editar uno existente no se guarda nada.
  const borrador = { activo: !editingRetiro };
  const [showForm, setShowForm] = useBorrador('retiro.abierto', false, borrador);
  const [form, setForm] = useBorrador('retiro.form', emptyForm, borrador);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedQty, setSelectedQty] = useState(1);
  const [cart, setCart, carritoRestaurado] = useBorrador('retiro.carrito', [], borrador);
  useRepreciarBorrador(carritoRestaurado, productsData?.products, (fn) => setCart(fn));

  // Acceso directo "Registrar retiro en tienda" del dashboard: llega con state.abrirFormulario y despliega el formulario.
  const location = useLocation();
  useEffect(() => {
    if (!location.state?.abrirFormulario) return;
    setShowForm(true);
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);
  const [successMsg, setSuccessMsg] = useState('');
  // Tipo de precio del próximo producto que se agregue (cada línea guarda el suyo).
  // En Retiro en Tienda el valor por defecto es MARKETPLACE.
  const [priceType, setPriceType] = useBorrador('retiro.precio', 'marketplace', borrador);
  const [mayorPrice, setMayorPrice] = useState('');
  const [agotadoError, setAgotadoError] = useState('');

  const total = cart.reduce((sum, item) => sum + item.quantity * item.price, 0);

  // Qué falta para guardar, por paso. Se muestra en el resumen y, después de intentar guardar, en rojo en cada campo.
  const [intento, setIntento] = useState(false);
  useEffect(() => { if (!showForm) setIntento(false); }, [showForm]);
  const sinNombre = !form.nombre.trim();
  const sinApellido = !form.apellido.trim();
  const sinProductos = cart.length === 0;
  const precioInvalido = cart.some((i) => !(Number(i.price) > 0));
  const faltanCliente = [sinNombre && 'nombre', sinApellido && 'apellido'].filter(Boolean);
  const faltanProductos = [sinProductos && 'productos', precioInvalido && 'precio de un producto'].filter(Boolean);
  const pasosResumen = [pasoResumen('Cliente', faltanCliente), pasoResumen('Productos', faltanProductos)];
  const cantidadProductos = cart.reduce((sum, i) => sum + Number(i.quantity), 0);
  const campoConError = (falta) => `form-field${intento && falta ? ' con-error' : ''}`;
  const mensajeError = (falta, texto) => (intento && falta ? <div className="campo-error">{texto}</div> : null);
  const productOptions = useMemo(
    () => (productsData?.products || []).map((p) => ({ value: p.id, label: priceType === 'mayor' ? `${p.title}${p.agotado ? ' (agotado)' : ''}` : `${p.title} · ${formatCurrency(productPrice(p, priceType))}${p.agotado ? ' (agotado)' : ''}` })),
    [productsData, priceType]
  );

  function addToCart() {
    const product = productsData?.products.find((p) => String(p.id) === selectedProductId);
    if (!product || selectedQty < 1) return;
    // Los vendedores ven los productos agotados en la lista, pero no pueden agregarlos.
    if (user.role === 'vendedor' && product.agotado) {
      setAgotadoError(`Producto agotado: "${product.title}". No se puede agregar al retiro.`);
      return;
    }
    setAgotadoError('');
    if (priceType === 'mayor' && (Number(selectedQty) < MIN_MAYOR || !(Number(mayorPrice) > 0))) return;
    setCart((prev) => [
      ...prev,
      {
        key: Date.now(), product_id: product.id, product_name: product.title, price: priceType === 'mayor' ? Number(mayorPrice) : productPrice(product, priceType), quantity: Number(selectedQty), price_type: priceType,
        ...(priceType === 'mayor' ? {} : { precio_catalogo: productPrice(product, priceType) }),
      },
    ]);
    setSelectedProductId('');
    setSelectedQty(priceType === 'mayor' ? MIN_MAYOR : 1);
    setMayorPrice('');
  }

  function handlePriceTypeChange(next) {
    setPriceType(next);
    if (next === 'mayor') setSelectedQty((q) => Math.max(Number(q) || 0, MIN_MAYOR));
  }

  function cambiarLinea(nueva) {
    setCart((prev) => prev.map((item) => (item.key === nueva.key ? nueva : item)));
  }

  function removeFromCart(key) {
    setCart((prev) => prev.filter((item) => item.key !== key));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSuccessMsg('');
    if (faltanCliente.length + faltanProductos.length > 0) {
      setIntento(true);
      irAlPrimerError();
      return;
    }

    const payload = {
      client_name: `${form.nombre.trim()} ${form.apellido.trim()}`,
      items: cart.map(lineaParaEnviar).map(({ product_id, quantity, price_type, price, precio_modificado, precio_original }) => ({ product_id, quantity, price_type, price, precio_modificado, precio_original })),
      notes: form.notes,
    };

    const result = editingRetiro
      ? await put(`/api/retiros-tienda/${editingRetiro.id}`, payload)
      : await post('/api/retiros-tienda', payload);
    if (result.success) {
      // Animación de "¡Nueva venta!" para el vendedor que registra un retiro nuevo
      if (!editingRetiro && user.role === 'vendedor') {
        const retiro = result.data?.retiro;
        showNewSale({ type: 'retiro', seller: user.name, orderId: retiro?.id, total: Number(retiro?.total ?? total) });
      }
      setSuccessMsg(editingRetiro
        ? 'Retiro actualizado correctamente'
        : `Retiro registrado: ${cart.length} producto(s), total ${formatCurrency(total)}`);
      closeForm();
      refetch();
    }
  }

  function closeForm() {
    setForm(emptyForm);
    setCart([]);
    setEditingRetiro(null);
    setPriceType('marketplace');
    setShowForm(false);
  }

  function openEdit(retiro) {
    setSuccessMsg('');
    setActionError('');
    setEditingRetiro(retiro);
    const [nombre, ...resto] = (retiro.client_name || '').split(' ');
    setForm({ nombre: nombre || '', apellido: resto.join(' '), notes: retiro.notes || '' });
    setCart(retiro.items.map((i, idx) => {
      const price_type = i.price_type || retiro.price_type || 'marketplace';
      const precio_catalogo = precioCatalogoDeGuardada({ ...i, price_type });
      return {
        key: `${retiro.id}-${idx}`, product_id: i.product_id, product_name: i.product_name, price: Number(i.price), quantity: Number(i.quantity), price_type,
        ...(precio_catalogo !== null ? { precio_catalogo } : {}),
        ...(i.precio_modificado ? { precio_modificado: true } : {}),
      };
    }));
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDelete(retiro) {
    setSuccessMsg('');
    setActionError('');
    const aviso = retiro.status === 'entregado' ? ' Ya fue entregado: la venta registrada en Caja no se elimina.' : '';
    const ok = await confirm(`¿Eliminar el retiro de "${retiro.client_name}"?${aviso}`, { title: 'Eliminar retiro', confirmLabel: 'Eliminar', danger: true });
    if (!ok) return;
    const result = await del(`/api/retiros-tienda/${retiro.id}`);
    if (result.success) refetch();
    else if (result.error) setActionError(result.error);
  }

  function procesarEnCaja(retiro) {
    navigate('/caja', {
      state: {
        retiroId: retiro.id,
        priceType: retiro.price_type,
        vendorId: retiro.vendor_id,
        clientId: retiro.client_id,
        clientName: retiro.client_name,
        items: retiro.items,
      },
    });
  }

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>Retiro en Tienda</h1>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 4, marginBottom: 0, fontSize: 13 }}>
            Propuestas de venta para clientes que pasarán a retirar. No cuentan como venta hasta que se procesan en Caja al entregar.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <BuscadorConBoton value={search} onSearch={handleSearchChange} placeholder="Buscar por cliente, vendedor o producto..." loading={loading} />
          <button className="btn btn-primary" onClick={() => (showForm ? closeForm() : setShowForm(true))}>
            {showForm ? 'Cancelar' : 'Registrar Retiro En Tienda'}
          </button>
        </div>
      </div>

      {actionError && <div className="alert alert-error">{actionError}</div>}
      {successMsg && <div className="card" style={{ padding: 16, marginBottom: 20, color: 'var(--color-success)' }}>{successMsg}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="card form-etiqueta" noValidate>
          {editingRetiro && <h3 className="form-etiqueta__titulo">Editar retiro</h3>}
          {editingRetiro?.status === 'entregado' && (
            <div className="alert alert-error">Este retiro ya fue entregado: los cambios no modifican la venta ya registrada en Caja.</div>
          )}
          {saveError && <div className="alert alert-error">{saveError}</div>}
          <div className="form-etiqueta__grid">
            <div className="form-etiqueta__pasos">
              <FormPaso numero={1} titulo="Cliente" error={intento && faltanCliente.length > 0}>
                <div className="form-fila form-fila--cliente">
                  <div className="form-field">
                    <label>Vendedor</label>
                    <input value={editingRetiro ? editingRetiro.vendor_name : user.name} disabled />
                  </div>
                  <div className={campoConError(sinNombre)}>
                    <label>Nombre</label>
                    <input placeholder="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
                    {mensajeError(sinNombre, 'Falta el nombre')}
                  </div>
                  <div className={campoConError(sinApellido)}>
                    <label>Apellido</label>
                    <input placeholder="Apellido" value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} />
                    {mensajeError(sinApellido, 'Falta el apellido')}
                  </div>
                </div>
                <NotaOpcional value={form.notes} onChange={(notes) => setForm({ ...form, notes })} />
              </FormPaso>

              <FormPaso
                numero={2}
                titulo="Productos"
                error={intento && faltanProductos.length > 0}
                acciones={<PriceTypeToggle compact value={priceType} onChange={handlePriceTypeChange} allowMayor hideSol={user.role === 'vendedor'} />}
              >
                <p className="form-paso__nota">
                  {priceType === 'mayor'
                    ? `Venta al mayor: mínimo ${MIN_MAYOR} unidades por producto y precio libre.`
                    : 'El tipo de precio elegido arriba vale para el próximo producto que agregues.'}
                </p>
                <div className="agregar-producto">
                  <div className="agregar-producto__buscar buscador-producto">
                    <SearchableSelect
                      value={selectedProductId}
                      onChange={(v) => { setSelectedProductId(v); setAgotadoError(''); }}
                      options={productOptions}
                      placeholder="Buscar producto por nombre"
                    />
                  </div>
                  <div className="agregar-producto__acciones">
                    <CantidadStepper value={selectedQty} onChange={setSelectedQty} min={priceType === 'mayor' ? MIN_MAYOR : 1} />
                    <button
                      type="button"
                      className="btn btn-add"
                      onClick={addToCart}
                      disabled={!selectedProductId || (priceType === 'mayor' && (Number(selectedQty) < MIN_MAYOR || !(Number(mayorPrice) > 0)))}
                    >
                      Agregar
                    </button>
                  </div>
                </div>
                {agotadoError && <div className="alert alert-error" role="alert">{agotadoError}</div>}

                {priceType === 'mayor' && selectedProductId && (
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    placeholder="Precio unitario (libre)"
                    value={mayorPrice}
                    onChange={(e) => setMayorPrice(e.target.value)}
                    className="campo-suelto"
                  />
                )}

                <LineasProductos items={cart} canEditPrice={canManage} onChangeLinea={cambiarLinea} onRemove={removeFromCart} error={intento && sinProductos} />
              </FormPaso>
            </div>

            <ResumenFormulario
              lineas={[{ etiqueta: `Productos (${cantidadProductos})`, valor: formatCurrency(total) }]}
              total={total}
              textoBoton={editingRetiro ? 'Guardar cambios' : 'Registrar retiro'}
              guardando={saving}
              pasos={pasosResumen}
            />
          </div>
        </form>
      )}

      {loading && !data && (
        <div className="page-loading">
          <div className="spinner" />
        </div>
      )}
      <BarraCarga activo={loading && !!data} />
      {error && <div className="alert alert-error">{error}</div>}

      <VistaToggle compacta={compacta} onChange={cambiarVista} />

      {data && compacta && (
        <div className={`card${loading ? ' cargando' : ''}`} style={{ padding: 20 }}>
          <TablaCompacta rows={data.retiros} vacio="Sin retiros en tienda registrados" />
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
        </div>
      )}

      {data && !compacta && (
        <div className={`card${loading ? ' cargando' : ''}`} style={{ padding: 20 }}>
          <table className="responsive-stack tabla-fija">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Vendedor</th>
                <th>Productos</th>
                <th>Total</th>
                <th>Precios</th>
                <th>Estado</th>
                <th>Fecha registro</th>
                <th>Fecha retiro</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.retiros.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 9 : 9} style={{ color: 'var(--color-text-muted)' }}>Sin retiros en tienda registrados</td>
                </tr>
              ) : (
                data.retiros.map((r) => (
                  <tr key={r.id}>
                    <td data-label="Cliente">{r.client_name}</td>
                    <td data-label="Vendedor">{r.vendor_name}</td>
                    <td data-label="Productos" style={{ fontSize: 13 }}>
                      {r.items.map((i) => `${i.product_name} x${i.quantity}`).join(', ')}
                      {r.notes && (
                        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--color-text-muted)', overflowWrap: 'anywhere', whiteSpace: 'pre-line' }}>
                          <strong>Notas:</strong> {r.notes}
                        </div>
                      )}
                    </td>
                    <td data-label="Total">{formatCurrency(r.total)}</td>
                    <td data-label="Precios">
                      <PriceTypeBadge type={r.price_type} />
                    </td>
                    <td data-label="Estado">
                      {r.status ? (
                        <Badge
                          label={r.status === 'entregado' ? 'Entregado' : 'Pendiente'}
                          color={r.status === 'entregado' ? 'var(--color-success)' : 'var(--color-warning)'}
                        />
                      ) : (
                        // Retiro de otro vendedor: el estado en tienda es privado de su dueño.
                        <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                      )}
                    </td>
                    <td data-label="Fecha registro">{formatDate(r.created_at)}</td>
                    <td data-label="Fecha retiro">{formatDate(r.delivered_at)}</td>
                    <td data-label="Acciones">
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <BotonCopiarEtiqueta obtenerTexto={() => textoEtiquetaRetiro(r)} />
                        {canManage && (
                          <>
                          {r.status === 'pendiente' && (
                            <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => procesarEnCaja(r)}>
                              Entregado
                            </button>
                          )}
                          <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => openEdit(r)}>
                            Editar
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '6px 10px', fontSize: 12, color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                            onClick={() => handleDelete(r)}
                          >
                            Eliminar
                          </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
        </div>
      )}
      {confirmDialog}
    </Layout>
  );
}
