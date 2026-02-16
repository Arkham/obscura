import { defineWorkspace } from 'vitest/config';
import react from '@vitejs/plugin-react';
import glsl from 'vite-plugin-glsl';

export default defineWorkspace([
  {
    plugins: [react(), glsl()],
    test: {
      name: 'unit',
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      exclude: ['src/**/*.browser-test.ts'],
    },
  },
  {
    plugins: [react(), glsl()],
    test: {
      name: 'browser',
      include: ['src/**/*.browser-test.ts'],
      browser: {
        enabled: true,
        provider: 'playwright',
        instances: [
          { browser: 'chromium' },
        ],
        headless: true,
      },
    },
  },
]);
