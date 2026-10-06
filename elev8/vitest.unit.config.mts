/**
 * Minimal vitest config for pure Node/server unit tests (no React/JSX).
 * Use: vitest run --config vitest.unit.config.mts tests/unit/...
 *
 * The main vitest.config.mts includes @vitejs/plugin-react for component tests.
 * That plugin requires Vite 8; current project uses Vite 5. This config skips
 * the React plugin so server-side unit tests can run without the version conflict.
 */
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: [],
    globals: true,
    include: ['tests/unit/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, './src'),
    },
  },
});
