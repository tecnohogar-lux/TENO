import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
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
