/**
 * Vitest config for component/integration tests (jsdom environment).
 * For pure Node/server unit tests, use vitest.unit.config.mts instead.
 *
 * Note: @vitejs/plugin-react is intentionally omitted — the project uses
 * Next.js (not Vite) for compilation, and this project's Vite version (5.x)
 * is incompatible with plugin-react 6.x which requires Vite 8.
 * Server-side unit tests run via vitest.unit.config.mts.
 */
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, './src'),
    },
  },
});
