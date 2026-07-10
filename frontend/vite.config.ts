/// <reference types="vitest/config" />
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Separa as libs grandes de terceiros em chunks próprios (cache longo,
        // não invalidados a cada mudança de código da aplicação). As telas já
        // viram chunks separados via React.lazy nas rotas.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return
          if (id.includes('@tanstack')) return 'query-vendor'
          if (
            id.includes('react-hook-form') ||
            id.includes('@hookform') ||
            id.includes('/zod/')
          ) {
            return 'form-vendor'
          }
          if (
            id.includes('react-router') ||
            id.includes('react-dom') ||
            /node_modules\/react\//.test(id) ||
            id.includes('scheduler')
          ) {
            return 'react-vendor'
          }
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    // Bind-mounted source on Windows/Docker doesn't always propagate native
    // filesystem events into the Linux container, which can leave the dev
    // server silently serving a stale bundle after edits. Polling trades a
    // little CPU for HMR that's actually reliable in this setup.
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    // userEvent-driven tests can exceed the 5s default when the whole suite
    // runs in parallel on slower/Windows machines; a higher ceiling keeps the
    // full run stable without masking genuinely hung tests.
    testTimeout: 15000,
    // Cobertura via `npm run test:coverage` (requer @vitest/coverage-v8).
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/**/*.d.ts', 'src/components/ui/**'],
    },
  },
})
