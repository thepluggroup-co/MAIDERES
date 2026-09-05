import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    css: false,
    // e2e/ contient des specs Playwright (test() incompatible avec le global vitest)
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@maideres/ui':     path.resolve(__dirname, '../../packages/ui/src/index.ts'),
      '@maideres/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@maideres/ai':     path.resolve(__dirname, '../../packages/ai/src/index.ts'),
      '@maideres/db':     path.resolve(__dirname, '../../packages/db/src/index.ts'),
    },
  },
})
