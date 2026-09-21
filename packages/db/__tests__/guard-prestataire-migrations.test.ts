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

const derniere = readdirSync(DIR)
  .filter((f) => /^\d{4}_.*\.sql$/.test(f))
  .sort()
  .map((f) => ({ f, sql: readFileSync(join(DIR, f), 'utf-8') }))
  .filter(({ sql }) => /CREATE OR REPLACE FUNCTION public\.guard_prestataire_self_update/.test(sql))
  .at(-1)!

describe('guard_prestataire_self_update — dernière définition', () => {
  it('contourne les écritures sans session utilisateur (service role)', () => {
    expect(derniere.sql, derniere.f).toMatch(/auth\.uid\(\) IS NULL/)
  })
  it('protège toujours statut, taux_commission, note_moyenne et pilote', () => {
    for (const col of ['statut', 'taux_commission', 'note_moyenne', 'pilote']) {
      expect(derniere.sql, derniere.f).toContain(`NEW.${col} IS DISTINCT FROM OLD.${col}`)
    }
  })
})

describe('note_moyenne synchronisée avec les avis (0037)', () => {
  const tous = readdirSync(DIR).filter((f) => /^\d{4}_.*\.sql$/.test(f)).map((f) => readFileSync(join(DIR, f), 'utf-8')).join('\n')
  it('un trigger recalcule la moyenne à chaque avis créé / modifié / supprimé', () => {
    expect(tous).toMatch(/CREATE TRIGGER trg_avis_sync_note_moyenne\s+AFTER INSERT OR UPDATE OF note OR DELETE ON public\.avis/)
  })
  it('la garde n\u2019autorise le recalcul que via le drapeau de transaction, uniquement pour note_moyenne', () => {
    expect(derniere.sql).toContain("current_setting('maideres.sync_note', true)")
  })
})
