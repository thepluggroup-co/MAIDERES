import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { getTableConfig } from 'drizzle-orm/pg-core'
import {
  profilesPg, auditLogPg, categoriesServicesPg, prestatairesPg, clientsPg, demandesPg,
  matchingsPg, transactionsPg, avisPg, reversementsPg, notificationsLogPg,
  roleEnum, prestataireStatutEnum, demandeCanalEnum, demandeStatutEnum,
  matchingStatutEnum, paiementStatutEnum, reversementStatutEnum,
  notifCanalEnum, notifStatutEnum,
} from '../src/schema.pg'

const __dirname = dirname(fileURLToPath(import.meta.url))

function columnNames(table: Parameters<typeof getTableConfig>[0]): string[] {
  return getTableConfig(table).columns.map((c) => c.name)
}

describe('Tables marketplace — noms et colonnes', () => {
  it('categories_services : id, libelle, actif', () => {
    const cfg = getTableConfig(categoriesServicesPg)
    expect(cfg.name).toBe('categories_services')
    expect(columnNames(categoriesServicesPg)).toEqual(['id', 'libelle', 'actif'])
  })

  it('prestataires : colonnes attendues + FK profile_id -> profiles', () => {
    const cfg = getTableConfig(prestatairesPg)
    expect(cfg.name).toBe('prestataires')
    expect(columnNames(prestatairesPg)).toEqual([
      'id', 'profile_id', 'nom', 'telephone', 'categories', 'quartier',
      'geoloc_lat', 'geoloc_lng', 'statut', 'note_moyenne', 'taux_commission',
      'date_recrutement',
    ])
    expect(cfg.foreignKeys).toHaveLength(1)
    expect(cfg.foreignKeys[0].reference().foreignTable).toBe(profilesPg)
  })

  it('clients : colonnes attendues + FK profile_id -> profiles', () => {
    const cfg = getTableConfig(clientsPg)
    expect(cfg.name).toBe('clients')
    expect(columnNames(clientsPg)).toEqual(['id', 'profile_id', 'nom', 'telephone', 'quartier'])
    expect(cfg.foreignKeys).toHaveLength(1)
    expect(cfg.foreignKeys[0].reference().foreignTable).toBe(profilesPg)
  })

  it('demandes : colonnes attendues + FK client_id/categorie_id', () => {
    const cfg = getTableConfig(demandesPg)
    expect(cfg.name).toBe('demandes')
    expect(columnNames(demandesPg)).toEqual([
      'id', 'client_id', 'categorie_id', 'description', 'localisation',
      'canal', 'statut', 'created_at',
    ])
    expect(cfg.foreignKeys).toHaveLength(2)
    const targets = cfg.foreignKeys.map((fk) => fk.reference().foreignTable)
    expect(targets).toContain(clientsPg)
    expect(targets).toContain(categoriesServicesPg)
  })

  it('matchings : colonnes attendues + FK demande_id/prestataire_id/operateur_id', () => {
    const cfg = getTableConfig(matchingsPg)
    expect(cfg.name).toBe('matchings')
    expect(columnNames(matchingsPg)).toEqual([
      'id', 'demande_id', 'prestataire_id', 'operateur_id', 'statut',
      'motif_echec', 'proposed_at', 'closed_at',
    ])
    expect(cfg.foreignKeys).toHaveLength(3)
    const targets = cfg.foreignKeys.map((fk) => fk.reference().foreignTable)
    expect(targets).toContain(demandesPg)
    expect(targets).toContain(prestatairesPg)
    expect(targets).toContain(profilesPg)
  })

  it('transactions : colonnes attendues + FK matching_id (unique)', () => {
    const cfg = getTableConfig(transactionsPg)
    expect(cfg.name).toBe('transactions')
    expect(columnNames(transactionsPg)).toEqual([
      'id', 'matching_id', 'montant_service', 'commission_taux',
      'commission_montant', 'statut_paiement', 'ref_notchpay', 'created_at',
    ])
    expect(cfg.foreignKeys).toHaveLength(1)
    expect(cfg.foreignKeys[0].reference().foreignTable).toBe(matchingsPg)
  })

  it('avis : colonnes attendues (note 1-5 vérifiée en migration SQL)', () => {
    const cfg = getTableConfig(avisPg)
    expect(cfg.name).toBe('avis')
    expect(columnNames(avisPg)).toEqual(['id', 'matching_id', 'note', 'commentaire', 'created_at'])
    expect(cfg.foreignKeys).toHaveLength(1)
    expect(cfg.foreignKeys[0].reference().foreignTable).toBe(matchingsPg)
  })

  it('reversements : colonnes attendues + FK prestataire_id', () => {
    const cfg = getTableConfig(reversementsPg)
    expect(cfg.name).toBe('reversements')
    expect(columnNames(reversementsPg)).toEqual(['id', 'prestataire_id', 'montant', 'statut', 'ref', 'created_at'])
    expect(cfg.foreignKeys).toHaveLength(1)
    expect(cfg.foreignKeys[0].reference().foreignTable).toBe(prestatairesPg)
  })

  it('notifications_log : colonnes attendues + FK cible -> profiles', () => {
    const cfg = getTableConfig(notificationsLogPg)
    expect(cfg.name).toBe('notifications_log')
    expect(columnNames(notificationsLogPg)).toEqual(['id', 'cible', 'canal', 'contenu', 'statut', 'created_at'])
    expect(cfg.foreignKeys).toHaveLength(1)
    expect(cfg.foreignKeys[0].reference().foreignTable).toBe(profilesPg)
  })

  it('profiles : inchangé (non renommé, cf. contrainte Phase 1)', () => {
    expect(columnNames(profilesPg)).toEqual([
      'id', 'email', 'nom', 'role', 'telephone', 'avatar_url', 'actif',
      'created_at', 'updated_at',
    ])
  })

  it('audit_log : colonnes attendues + FK user_id -> profiles (journal générique auditMiddleware)', () => {
    const cfg = getTableConfig(auditLogPg)
    expect(cfg.name).toBe('audit_log')
    expect(columnNames(auditLogPg)).toEqual([
      'id', 'user_id', 'action', 'table_name', 'record_id', 'new_data',
      'ip_address', 'user_agent', 'created_at',
    ])
    expect(cfg.foreignKeys).toHaveLength(1)
    expect(cfg.foreignKeys[0].reference().foreignTable).toBe(profilesPg)
  })
})

describe('Enums — valeurs exactes', () => {
  it('role reste admin|superviseur|operateur|apprenant (non modifié)', () => {
    expect(roleEnum.enumValues).toEqual(['admin', 'superviseur', 'operateur', 'apprenant'])
  })

  it('prestataire_statut', () => {
    expect(prestataireStatutEnum.enumValues).toEqual(['en_attente', 'actif', 'suspendu'])
  })

  it('demande_canal', () => {
    expect(demandeCanalEnum.enumValues).toEqual(['web', 'whatsapp', 'manuel'])
  })

  it('demande_statut', () => {
    expect(demandeStatutEnum.enumValues).toEqual(['nouvelle', 'en_traitement', 'matchee', 'realisee', 'annulee'])
  })

  it('matching_statut', () => {
    expect(matchingStatutEnum.enumValues).toEqual(['propose', 'accepte', 'refuse', 'realise', 'echoue'])
  })

  it('paiement_statut', () => {
    expect(paiementStatutEnum.enumValues).toEqual(['en_attente', 'paye', 'echoue', 'rembourse'])
  })

  it('reversement_statut', () => {
    expect(reversementStatutEnum.enumValues).toEqual(['en_attente', 'traite', 'echoue'])
  })

  it('notif_canal', () => {
    expect(notifCanalEnum.enumValues).toEqual(['sms', 'whatsapp', 'email'])
  })

  it('notif_statut', () => {
    expect(notifStatutEnum.enumValues).toEqual(['en_attente', 'envoye', 'echoue'])
  })
})

describe('Migrations générées', () => {
  const drizzleDir = join(__dirname, '..', 'drizzle')

  it('la migration initiale crée les 10 tables (9 marketplace + profiles)', () => {
    const files = readFileSync(join(drizzleDir, '0000_common_cerebro.sql'), 'utf8')
    for (const table of [
      'profiles', 'categories_services', 'prestataires', 'clients', 'demandes',
      'matchings', 'transactions', 'avis', 'reversements', 'notifications_log',
    ]) {
      expect(files).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS "${table}"`))
    }
  })

  it('la migration RLS active RLS sur les 10 tables et vérifie la plage de avis.note', () => {
    const sql = readFileSync(join(drizzleDir, '0001_rls_policies.sql'), 'utf8')
    for (const table of [
      'profiles', 'categories_services', 'prestataires', 'clients', 'demandes',
      'matchings', 'transactions', 'avis', 'reversements', 'notifications_log',
    ]) {
      expect(sql).toMatch(new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`))
    }
    expect(sql).toMatch(/avis_note_range CHECK \(note BETWEEN 1 AND 5\)/)
  })

  it("la migration RLS restreint les prestataires visibles par un client aux statut='actif'", () => {
    const sql = readFileSync(join(drizzleDir, '0001_rls_policies.sql'), 'utf8')
    expect(sql).toMatch(/prestataires_select_actifs_client[\s\S]*?statut = 'actif'/)
  })

  it('audit_log est créée (0002) et RLS activée dessus (0003), staff uniquement', () => {
    const createSql = readFileSync(join(drizzleDir, '0002_smooth_red_hulk.sql'), 'utf8')
    expect(createSql).toMatch(/CREATE TABLE IF NOT EXISTS "audit_log"/)

    const rlsSql = readFileSync(join(drizzleDir, '0003_audit_log_rls.sql'), 'utf8')
    expect(rlsSql).toMatch(/ALTER TABLE public\.audit_log ENABLE ROW LEVEL SECURITY/)
    expect(rlsSql).toMatch(/audit_log_select_staff[\s\S]*?is_staff\(\)/)
  })
})
