import { defineConfig } from 'vitest/config'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    testTimeout: 15_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/__tests__/**',
        'src/index.ts',
        'src/types.ts',
        // Services d'infrastructure externe — non testables en unit sans infra réelle
        'src/services/sms.service.ts',
        'src/services/offline-fallback.ts',
        'src/services/workflow-notifications.service.ts',
        // Routes sans tests
        'src/routes/admin.ts',
        // Middleware non testables en unit (rate-limit login = infra)
        'src/middleware/loginRateLimit.middleware.ts',
      ],
      thresholds: {
        lines:      50,
        branches:   50,
        functions:  60,
        statements: 50,
      },
    },
  },
  resolve: {
    alias: {
      '@forge/db/supabase': path.resolve(__dirname, '../../packages/db/src/supabase-client.ts'),
      '@forge/db':          path.resolve(__dirname, '../../packages/db/src/index.ts'),
      '@forge/ai':          path.resolve(__dirname, '../../packages/ai/src/index.ts'),
      '@forge/shared':      path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
})
