import logoUrl from '../assets/tecnohogar-logo.png';

export default function Logo({ height = 32, style }) {
  return (
    <img
      src={logoUrl}
      alt="TecnoHogar"
      style={{ height, width: 'auto', display: 'block', ...style }}
    />
  );
}
