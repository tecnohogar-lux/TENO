import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // React y el router en un chunk propio (se cachea entre despliegues); xlsx y el
        // lector de QR ya quedan aparte porque solo se importan desde páginas puntuales.
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return 'react-vendor';
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
    fs: {
      strict: false,
    },
    watch: {
      // El watcher nativo de Windows falla (assertion en fs-event.c) cuando el proceso
      // se lanza con una ruta corta (8.3) que no coincide con la ruta larga real.
      // Polling evita ese watcher nativo por completo.
      usePolling: true,
      interval: 300,
    },
  },
});
