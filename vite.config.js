import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      // injectManifest: vi skriver vår egen SW med Workbox + push-handlers.
      // vite-plugin-pwa kompilerar src/service-worker.js → dist/sw.js och
      // injicerar precache-manifestet (self.__WB_MANIFEST) automatiskt vid build.
      strategies:   'injectManifest',
      srcDir:       'src',
      filename:     'service-worker.js',
      registerType: 'autoUpdate',

      // Vi har vår egen public/manifest.json — låt inte pluginet generera en ny.
      manifest: false,

      // Workbox-konfiguration för injectManifest
      injectManifest: {
        // Inkludera allt som ska precachas (JS-chunks, CSS, HTML, ikoner, fonter)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // Hoppa över map-filer och SW:n själv
        globIgnores:  ['**/*.map', '**/sw.js'],
      },

      devOptions: {
        // Aktivera SW i dev-läge för testning
        enabled: false,
        type:    'module',
      },
    }),
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  build: {
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-[hash]-v2.js`,
        chunkFileNames: `assets/[name]-[hash]-v2.js`,
        assetFileNames: `assets/[name]-[hash]-v2.[ext]`,
      },
    },
  },

  test: {
    environment: 'node',
    globals: true,
  },
});
