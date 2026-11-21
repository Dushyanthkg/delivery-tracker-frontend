import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    // Pure logic runs in Node; files that need a DOM opt in with `// @vitest-environment jsdom`.
    environment: 'node',
    restoreMocks: true,
  },
});
