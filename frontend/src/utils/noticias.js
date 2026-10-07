// Presentación de las noticias: encabezado, recorte de títulos largos y cambios de producto.

export const TITULO_MAX = 30;

// Texto del encabezado (lo que va antes del título entre comillas) y estilo de cada tipo.
export const NOTICIA_TIPOS = {
  manual: { tag: 'Aviso', encabezado: null, color: '#1b2a82', icon: 'megaphone' },
  producto_creado: { tag: 'Nuevo', encabezado: 'Producto nuevo', color: '#237a4d', icon: 'sparkle' },
  producto_editado: { tag: 'Editado', encabezado: 'Producto editado', color: '#2a63a0', icon: 'pencil' },
  producto_agotado: { tag: 'Agotado', encabezado: 'Producto Agotado', color: '#b3423a', icon: 'alert' },
  producto_disponible: { tag: 'Disponible', encabezado: 'Producto disponible', color: '#12806f', icon: 'check' },
  producto_eliminado: { tag: 'Eliminado', encabezado: 'Producto eliminado', color: '#566072', icon: 'trash' },
};

export function tipoNoticia(tipo) {
  return NOTICIA_TIPOS[tipo] || NOTICIA_TIPOS.manual;
}

// "Microfono inalambrico bluetooth pro" -> "Microfono inalambrico bluetoo..." (30 caracteres + "...")
export function tituloCorto(titulo, max = TITULO_MAX) {
  const t = String(titulo || '').trim();
  return t.length > max ? `${t.slice(0, max).trimEnd()}...` : t;
}

// Título completo del producto de la noticia. Las noticias antiguas (sin `datos`) lo traen
// dentro del texto, entre comillas: Se creó el producto "X" / Producto "X" marcado como agotado.
export function tituloNoticia(n) {
  if (n.datos?.titulo) return n.datos.titulo;
  if (!NOTICIA_TIPOS[n.tipo]?.encabezado) return null;
  const m = /"([\s\S]+)"/.exec(n.texto || '');
  return m ? m[1] : null;
}

// Encabezado de la tarjeta: Producto nuevo "Titulo..." (con título recortado) o, en las
// noticias manuales y masivas, el texto tal cual.
export function encabezadoNoticia(n, { completo = false } = {}) {
  const info = tipoNoticia(n.tipo);
  const titulo = tituloNoticia(n);
  if (!info.encabezado || !titulo) return n.texto;
  return `${info.encabezado} "${completo ? titulo : tituloCorto(titulo)}"`;
}

// Cambios de una edición de producto, ya redactados. `corto` es lo que se ve en la tarjeta
// cerrada; `largo` el detalle al abrirla.
export function cambiosNoticia(n, formatCurrency) {
  const cambios = Array.isArray(n.datos?.cambios) ? n.datos.cambios : [];
  return cambios.map((c) => {
    if (c.campo === 'precio') {
      const texto = `Precio: ${formatCurrency(c.de)} → ${formatCurrency(c.a)}`;
      return { campo: c.campo, corto: texto, largo: texto };
    }
    if (c.campo === 'titulo') {
      return { campo: c.campo, corto: 'Título modificado', largo: `Título: "${c.de}" → "${c.a}"` };
    }
    if (c.campo === 'descripcion') {
      return { campo: c.campo, corto: 'Descripción modificada', largo: 'Descripción modificada' };
    }
    return { campo: 'otros', corto: 'Otros datos', largo: 'Otros datos actualizados' };
  });
}
