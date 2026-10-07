// backend/utils/noticiasTexto.js
// Arma el texto y el detalle (`datos`) de las noticias automáticas de productos.
// El front dibuja las tarjetas a partir de `datos` (y recorta los títulos largos); `texto` queda como resumen legible
// (auditoría, noticias antiguas, cualquier otro consumidor).

const ENCABEZADOS = {
  producto_creado: 'Producto nuevo',
  producto_editado: 'Producto editado',
  producto_agotado: 'Producto Agotado',
  producto_disponible: 'Producto disponible',
  producto_eliminado: 'Producto eliminado',
};

const clp = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(n) || 0);

function describirCambio(c) {
  if (c.campo === 'precio') return `Precio: ${clp(c.de)} → ${clp(c.a)}`;
  if (c.campo === 'titulo') return `Título: "${c.de}" → "${c.a}"`;
  if (c.campo === 'descripcion') return 'Descripción modificada';
  return 'Otros datos actualizados';
}

// Noticia de un producto: { texto, datos } listos para crearNoticia().
function noticiaProducto(tipo, titulo, cambios = []) {
  const base = `${ENCABEZADOS[tipo]} "${titulo}"`;
  const detalle = cambios.map(describirCambio).join(' · ');
  return {
    texto: detalle ? `${base} — ${detalle}` : base,
    datos: { titulo, ...(cambios.length ? { cambios } : {}) },
  };
}

// Qué cambió entre dos versiones de un producto. No se informan valores de costo
// (las noticias las ven todos los roles): un cambio de costo/SKU/imagen solo figura
// como "otros datos".
function detectarCambios(antes, despues) {
  const cambios = [];
  if (Number(antes.price) !== Number(despues.price)) {
    cambios.push({ campo: 'precio', de: Number(antes.price), a: Number(despues.price) });
  }
  if ((antes.title || '') !== (despues.title || '')) {
    cambios.push({ campo: 'titulo', de: antes.title, a: despues.title });
  }
  if ((antes.caracteristicas || '') !== (despues.caracteristicas || '')) {
    cambios.push({ campo: 'descripcion' });
  }
  const otros = (antes.sku || '') !== (despues.sku || '')
    || (antes.cover_image_url || '') !== (despues.cover_image_url || '')
    || Number(antes.costo ?? -1) !== Number(despues.costo ?? -1);
  if (otros) cambios.push({ campo: 'otros' });
  return cambios;
}

module.exports = { ENCABEZADOS, noticiaProducto, detectarCambios };
