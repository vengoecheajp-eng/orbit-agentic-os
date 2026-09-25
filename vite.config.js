import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Follow the control plane's PORT from the local .env file.
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  return {
    plugins: [react()],
    server: {
      port: Number(env.ORBIT_DEV_PORT || 5173),
      proxy: { '/api': `http://127.0.0.1:${env.PORT || 8787}` }
    },
    // Keep framework and icon code in long-lived cacheable files. Orbit's
    // application code changes frequently; React and Lucide generally do not.
    build: {
      rolldownOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('lucide-react')) return 'icons';
            if (id.includes('/react/') || id.includes('/react-dom/')) return 'react-vendor';
            return 'vendor';
          }
        }
      }
    },
    test: {
      globalSetup: './test/global-setup.mjs',
      testTimeout: 10_000
    }
  };
});
