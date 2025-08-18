import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 85,
        branches: 75,
        functions: 85,
        statements: 85
      },
      exclude: [
        'dist/**',
        'test/**',
        '**/*.test.ts',
        '**/*.spec.ts'
      ]
    }
  }
});