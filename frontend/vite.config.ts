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
  },
})
