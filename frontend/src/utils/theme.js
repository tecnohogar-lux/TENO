export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
  try {
    localStorage.setItem('teno_theme', theme);
  } catch {
    // localStorage no disponible, no es crítico
  }
}
