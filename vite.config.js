import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { execSync } from 'node:child_process';

const appBuildId = new Date().toISOString();

function resolveBuildCommit() {
  const envCommit = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || process.env.COMMIT_SHA;
  if (envCommit) return String(envCommit).slice(0, 7);

  try {
    return execSync('git rev-parse --short HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString().trim();
  } catch {
    return 'lokal';
  }
}

const appBuildCommit = resolveBuildCommit();

export default defineConfig({
  define: {
    __APP_BUILD_ID__: JSON.stringify(appBuildId),
    __APP_BUILD_COMMIT__: JSON.stringify(appBuildCommit),
  },

  plugins: [
    react(),

    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'service-worker.js',
      registerType: 'autoUpdate',
      manifest: false,
      devOptions: { enabled: false },
      injectManifest: {
        // Säkerställ att workbox-moduler bundlas korrekt
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
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
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@supabase')) return 'supabase-vendor';
          if (id.includes('framer-motion')) return 'motion-vendor';
          if (id.includes('recharts') || id.includes('d3-')) return 'charts-vendor';
          if (id.includes('lucide-react')) return 'icons-vendor';
          return undefined;
        },
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
