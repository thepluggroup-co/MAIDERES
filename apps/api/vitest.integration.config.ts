import { defineConfig } from 'vitest/config'

/**
 * Config dédiée aux tests d'intégration (src/__tests__/integration/**) :
 * vraie instance Supabase de test, aucun mock, pas de setupFiles (le fichier
 * de test gère lui-même process.env avant d'importer l'app). Timeout plus
 * long : appels réseau réels + polling audit_log. Voir README §
 * "Tests d'intégration" pour la configuration des identifiants.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/__tests__/integration/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
