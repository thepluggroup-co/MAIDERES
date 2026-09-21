/**
 * Garde-fou de régression : la DERNIÈRE définition de
 * guard_prestataire_self_update() doit garder le contournement des écritures
 * sans session Supabase (`auth.uid() IS NULL` — API en service role) ET la
 * garde `pilote`. 0034 avait perdu le contournement (cf. 0036).
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = join(__dirname, '..', 'drizzle')

describe('guard_prestataire_self_update — dernière définition', () => {
  const derniere = readdirSync(DIR)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort()
    .map((f) => ({ f, sql: readFileSync(join(DIR, f), 'utf-8') }))
    .filter(({ sql }) => /CREATE OR REPLACE FUNCTION public\.guard_prestataire_self_update/.test(sql))
    .at(-1)!

  it('contourne les écritures sans session utilisateur (service role)', () => {
    expect(derniere.sql, derniere.f).toMatch(/auth\.uid\(\) IS NULL/)
  })
  it('protège toujours statut, taux_commission, note_moyenne et pilote', () => {
    for (const col of ['statut', 'taux_commission', 'note_moyenne', 'pilote']) {
      expect(derniere.sql, derniere.f).toContain(`NEW.${col} IS DISTINCT FROM OLD.${col}`)
    }
  })
})
