/**
 * Garde-fou anti-drift : les enums déclarés ici (enums.ts) doivent rester
 * un miroir exact des `pgEnum` de packages/db/src/schema.pg.ts. On ne peut
 * pas importer schema.pg.ts directement (dépendance à drizzle-orm/pg,
 * cf. commentaire d'en-tête de enums.ts) — donc on compare aux valeurs
 * telles qu'observées dans les migrations SQL, qui sont la source de
 * vérité réellement appliquée en base.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  RoleSchema, PrestataireStatutSchema, DemandeCanalSchema, DemandeStatutSchema,
  MatchingStatutSchema, PaiementStatutSchema, ReversementStatutSchema,
  NotifCanalSchema, NotifStatutSchema, TypeClientSchema, SourceClientSchema,
  TypeCommissionSchema, StatutInterventionSchema, TypeEvenementSchema, NiveauUrgenceSchema,
} from './enums'

const __dirname = dirname(fileURLToPath(import.meta.url))
const drizzleDir = join(__dirname, '..', '..', 'db', 'drizzle')

// Un enum peut être créé dans une migration puis complété dans une autre
// (ex. demande_statut : 'en_cours' ajouté en 0007, cf. schema.pg.ts) — on
// concatène donc TOUTES les migrations plutôt que d'en pointer une par une,
// robuste aux futures migrations sans maintenance de cette liste.
const allMigrationsConcatenated = readdirSync(drizzleDir)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => readFileSync(join(drizzleDir, f), 'utf8'))
  .join('\n')

function expectEnumValuesInMigrations(values: readonly string[]) {
  for (const v of values) {
    expect(allMigrationsConcatenated, `valeur d'enum '${v}' absente des migrations SQL`).toMatch(new RegExp(`'${v}'`))
  }
}

describe('Enums — pas de drift avec les migrations SQL (source de vérité DB)', () => {
  it('role', () => expectEnumValuesInMigrations(RoleSchema.options))
  it('prestataire_statut', () => expectEnumValuesInMigrations(PrestataireStatutSchema.options))
  it('demande_canal', () => expectEnumValuesInMigrations(DemandeCanalSchema.options))
  it('demande_statut', () => expectEnumValuesInMigrations(DemandeStatutSchema.options))
  it('matching_statut', () => expectEnumValuesInMigrations(MatchingStatutSchema.options))
  it('paiement_statut', () => expectEnumValuesInMigrations(PaiementStatutSchema.options))
  it('reversement_statut', () => expectEnumValuesInMigrations(ReversementStatutSchema.options))
  it('notif_canal', () => expectEnumValuesInMigrations(NotifCanalSchema.options))
  it('notif_statut', () => expectEnumValuesInMigrations(NotifStatutSchema.options))
  it('type_client', () => expectEnumValuesInMigrations(TypeClientSchema.options))
  it('source_client', () => expectEnumValuesInMigrations(SourceClientSchema.options))
  it('type_commission', () => expectEnumValuesInMigrations(TypeCommissionSchema.options))
  it('statut_intervention', () => expectEnumValuesInMigrations(StatutInterventionSchema.options))
  it('type_evenement', () => expectEnumValuesInMigrations(TypeEvenementSchema.options))
  it('niveau_urgence', () => expectEnumValuesInMigrations(NiveauUrgenceSchema.options))

  it('le dossier de migrations est bien lu (sanity check du chemin de lecture)', () => {
    expect(allMigrationsConcatenated.length).toBeGreaterThan(1000)
  })
})
