// Iconos de categoría (src/assets/icons/<nombre>.svg). Se pintan como máscara con
// currentColor para que tomen el color de cada categoría y del tema; todos están
// recortados a un cuadrado ajustado, así que con el mismo `size` se ven del mismo tamaño.
const ICON_URLS = import.meta.glob('../assets/icons/*.svg', { eager: true, query: '?url', import: 'default' });

export default function CategoryIcon({ name, size = 18, style }) {
  const url = ICON_URLS[`../assets/icons/${name}.svg`];
  if (!url) return null;

  // Entre comillas: la ruta puede traer espacios (ej. "Windows 10 Pro") y rompería el url().
  const maskImage = `url("${url}")`;

  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        flexShrink: 0,
        backgroundColor: 'currentColor',
        WebkitMaskImage: maskImage,
        maskImage,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        ...style,
      }}
    />
  );
}
