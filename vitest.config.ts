import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  test: {
    include: [
      'packages/**/tests/unit/**/*.{test,spec}.ts',
      'packages/**/tests/**/*.unit.{test,spec}.ts',
      'apps/**/tests/unit/**/*.{test,spec}.ts',
      'scripts/**/*.test.ts',
    ],
    name: 'unit',
    environment: 'node',
    testTimeout: 10000,
  },
})
