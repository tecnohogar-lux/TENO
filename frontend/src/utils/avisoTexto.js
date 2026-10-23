// Texto del aviso a pantalla completa: borrador inicial y lectura del formato simple que escribe el admin.
//
// Formato (lo que se escribe en Administración → Avisos):
//   - Una línea en blanco separa los párrafos.
//   - "# Texto"          -> subtítulo.
//   - "- Texto"          -> viñetas (una por línea).
//   - "1. Texto"         -> pasos numerados (uno por línea).
//   - "!! Texto"         -> caja naranja de advertencia.
//   - "ok Texto"         -> caja verde (tranquilidad).
//   - "info Texto"       -> caja azul (explicación).
//   - **texto**          -> negrita.

export const AVISO_TITULO_BORRADOR = 'Estamos actualizando el sistema';

export const AVISO_MENSAJE_BORRADOR = `Ahora mismo estamos instalando una **actualización de seguridad** en TENO. Es como cuando el celular se actualiza: por un rato no se puede usar.

info **¿Por qué lo hacemos?** Revisamos la seguridad del sistema con herramientas automáticas, incluida inteligencia artificial, y encontramos algunas piezas internas desactualizadas con fallas de seguridad conocidas. Hoy se descubren fallas nuevas muy rápido, y alguien con malas intenciones podría intentar aprovecharlas. Por eso las estamos cambiando **antes de que causen un problema**, para cuidar tu información y la de la empresa.

!! **Durante unos minutos el sitio puede dejar de funcionar.** Puede que la página no cargue, se quede en blanco o muestre un error. Es normal: no hace falta llamar a nadie ni hacer nada raro.

# ¿Qué tienes que hacer?

1. **Termina lo que estés haciendo** (por ejemplo, la venta o la etiqueta que estás llenando) y guárdalo.
2. **Cierra la página por completo** (la pestaña del navegador o la aplicación del celular).
3. **Espera unos minutos** y vuelve a abrir el sistema desde cero.
4. Si al volver ves un error o la pantalla en blanco, **espera 2 minutos más** y vuelve a abrirla.

ok **Tu información está a salvo.** Las ventas, los envíos y todo lo que ya está guardado no se pierde con esta actualización.`;

const PREFIJOS_CAJA = [
  { re: /^!!\s*/, tipo: 'alerta' },
  { re: /^ok\s+/i, tipo: 'ok' },
  { re: /^info\s+/i, tipo: 'info' },
];

// Devuelve una lista de bloques: { tipo: 'parrafo'|'subtitulo'|'viñetas'|'pasos'|'alerta'|'ok'|'info', ... }
export function leerMensajeAviso(texto) {
  const bloques = [];
  for (const crudo of String(texto || '').replace(/\r\n/g, '\n').split(/\n\s*\n/)) {
    const lineas = crudo.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lineas.length === 0) continue;
    const primera = lineas[0];

    const caja = PREFIJOS_CAJA.find((p) => p.re.test(primera));
    if (caja) {
      bloques.push({ tipo: caja.tipo, lineas: [primera.replace(caja.re, ''), ...lineas.slice(1)] });
    } else if (/^#\s+/.test(primera)) {
      bloques.push({ tipo: 'subtitulo', lineas: [primera.replace(/^#\s+/, '')] });
      if (lineas.length > 1) bloques.push({ tipo: 'parrafo', lineas: lineas.slice(1) });
    } else if (lineas.every((l) => /^[-•]\s+/.test(l))) {
      bloques.push({ tipo: 'viñetas', lineas: lineas.map((l) => l.replace(/^[-•]\s+/, '')) });
    } else if (lineas.every((l) => /^\d+[.)]\s+/.test(l))) {
      bloques.push({ tipo: 'pasos', lineas: lineas.map((l) => l.replace(/^\d+[.)]\s+/, '')) });
    } else {
      bloques.push({ tipo: 'parrafo', lineas });
    }
  }
  return bloques;
}

// Parte un texto en fragmentos { texto, negrita } según **negrita** (sin HTML: se muestran como texto).
export function partirNegritas(linea) {
  return String(linea).split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((t) => (
    /^\*\*[^*]+\*\*$/.test(t) ? { texto: t.slice(2, -2), negrita: true } : { texto: t, negrita: false }
  ));
}
