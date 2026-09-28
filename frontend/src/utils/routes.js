export function defaultRouteFor(role) {
  if (role === 'escaneo') return '/shipping';
  if (role === 'caja') return '/caja';
  return '/dashboard';
}
