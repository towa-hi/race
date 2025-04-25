import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    hmr: false   // disables the eval-based hot-reload runtime
  }
}); 