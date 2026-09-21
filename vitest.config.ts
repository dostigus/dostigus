import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [
      'packages/**/tests/unit/**/*.{test,spec}.ts',
      'packages/**/tests/**/*.unit.{test,spec}.ts',
      'apps/**/tests/unit/**/*.{test,spec}.ts',
    ],
    name: 'unit',
    environment: 'node',
    testTimeout: 10000,
  },
})
