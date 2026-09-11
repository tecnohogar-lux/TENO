import logoUrl from '../assets/tecnos-erp-logo.png';

export default function Logo({ height = 32, style }) {
  return (
    <img
      src={logoUrl}
      alt="TecnOS ERP"
      style={{ height, width: 'auto', display: 'block', ...style }}
    />
  );
}
