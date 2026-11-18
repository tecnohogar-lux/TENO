// Después de un intento de guardar con datos faltantes: lleva la vista al primer campo o paso marcado en rojo
// (clase `con-error`) y le da el foco.
export function irAlPrimerError() {
  requestAnimationFrame(() => {
    const marcado = document.querySelector('.form-etiqueta .con-error');
    if (!marcado) return;
    marcado.scrollIntoView({ block: 'center', behavior: 'smooth' });
    marcado.querySelector('input:not([type=hidden]):not([tabindex="-1"]), select, textarea')?.focus({ preventScroll: true });
  });
}
