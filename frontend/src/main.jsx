import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import { applyTheme } from './utils/theme';

try {
  const cachedTheme = localStorage.getItem('teno_theme');
  if (cachedTheme) applyTheme(cachedTheme);
} catch {
  // localStorage no disponible, se usa el tema claro por defecto
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
