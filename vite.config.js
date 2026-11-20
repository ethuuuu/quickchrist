import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// basicSsl gives the dev server HTTPS. Phones only allow GPS on HTTPS pages.
// host: true makes the server reachable from the phone on the same network.
// base: './' makes the build work from any folder (for example GitHub Pages).
export default defineConfig({
  base: './',
  plugins: [basicSsl()],
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  build: {
    target: 'es2020',
    sourcemap: false,
    cssCodeSplit: false,
  },
});
