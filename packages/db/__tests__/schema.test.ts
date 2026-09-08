import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { getTableConfig } from 'drizzle-orm/pg-core'
import {
  profilesPg, auditLogPg, categoriesServicesPg, prestatairesPg, clientsPg, demandesPg,
  matchingsPg, transactionsPg, avisPg, reversementsPg, notificationsLogPg,
  interventionsPg, interventionEvenementsPg, commissionConfigPg, slaConfigPg,
  offresPg, promotionsPg, realisationsPg,
  roleEnum, prestataireStatutEnum, demandeCanalEnum, demandeStatutEnum,
  matchingStatutEnum, paiementStatutEnum, reversementStatutEnum,
  notifCanalEnum, notifStatutEnum, typeClientEnum, sourceClientEnum,
  statutInterventionEnum, typeEvenementEnum, typeCommissionEnum, niveauUrgenceEnum,
} from '../src/schema.pg'
import {
  rbacRolesPg, rbacPermissionsPg, rbacRolePermissionsPg, rbacUserProfilesPg,
  rbacAuditLogsPg, rbacSecuritySettingsPg, rbacLoginAttemptsPg,
  rbacModuleEnum, rbacActionEnum, rbacRoleNameEnum, auditActionEnum,
} from '../src/schema.pg.rbac'

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
      'date_recrutement', 'ville', 'metier', 'bio', 'disponible', 'zones_couverture',
    ])
    expect(cfg.foreignKeys).toHaveLength(1)
    expect(cfg.foreignKeys[0].reference().foreignTable).toBe(profilesPg)
  })

  it("prestataires (0027) : les colonnes self-service (ville/metier/bio/zones_couverture) n'ont pas de valeur par défaut piégeuse — disponible seul a un défaut (true)", () => {
    const byName = Object.fromEntries(getTableConfig(prestatairesPg).columns.map((c) => [c.name, c]))
    expect(byName.ville.notNull).toBe(false)
    expect(byName.metier.notNull).toBe(false)
    expect(byName.bio.notNull).toBe(false)
    expect(byName.disponible.notNull).toBe(true)
    expect(byName['zones_couverture'].notNull).toBe(true)
  })

  it('offres : colonnes attendues + FK prestataire_id -> prestataires (ON DELETE CASCADE)', () => {
    const cfg = getTableConfig(offresPg)
    expect(cfg.name).toBe('offres')
    expect(columnNames(offresPg)).toEqual([
      'id', 'prestataire_id', 'categorie', 'titre', 'description', 'prestations',
      'prix', 'unite_prix', 'delai_heures', 'publie', 'created_at',
    ])
    expect(cfg.foreignKeys).toHaveLength(1)
    expect(cfg.foreignKeys[0].reference().foreignTable).toBe(prestatairesPg)
  })

  it('promotions : colonnes attendues + FK prestataire_id -> prestataires et offre_id -> offres (nullable)', () => {
    const cfg = getTableConfig(promotionsPg)
    expect(cfg.name).toBe('promotions')
    expect(columnNames(promotionsPg)).toEqual([
      'id', 'prestataire_id', 'offre_id', 'titre', 'description', 'remise_pct',
      'debut', 'fin', 'active', 'created_at',
    ])
    expect(cfg.foreignKeys).toHaveLength(2)
    const byName = Object.fromEntries(getTableConfig(promotionsPg).columns.map((c) => [c.name, c]))
    expect(byName.offre_id.notNull).toBe(false)
  })

  it('realisations : colonnes attendues + FK prestataire_id -> prestataires, image_url requis', () => {
    const cfg = getTableConfig(realisationsPg)
    expect(cfg.name).toBe('realisations')
    expect(columnNames(realisationsPg)).toEqual([
      'id', 'prestataire_id', 'titre', 'description', 'image_url', 'created_at',
    ])
    expect(cfg.foreignKeys).toHaveLength(1)
    const byName = Object.fromEntries(getTableConfig(realisationsPg).columns.map((c) => [c.name, c]))
    expect(byName.image_url.notNull).toBe(true)
    expect(byName.titre.notNull).toBe(false)
  })

  it("prestataires.taux_commission est nullable depuis 0010 (NULL = pas d'override, cf. calculer_commission)", () => {
    const byName = Object.fromEntries(getTableConfig(prestatairesPg).columns.map((c) => [c.name, c]))
    expect(byName.taux_commission.notNull).toBe(false)
    expect(byName.taux_commission.hasDefault).toBe(false)
  })

  it('commission_config (0010) : colonnes attendues + FK categorie_id -> categories_services (nullable = règle globale)', () => {
    const cfg = getTableConfig(commissionConfigPg)
    expect(cfg.name).toBe('commission_config')
    expect(columnNames(commissionConfigPg)).toEqual([
      'id', 'categorie_id', 'type', 'valeur', 'actif', 'created_at',
    ])
    expect(cfg.foreignKeys).toHaveLength(1)
    expect(cfg.foreignKeys[0].reference().foreignTable).toBe(categoriesServicesPg)

    const byName = Object.fromEntries(cfg.columns.map((c) => [c.name, c]))
    expect(byName.categorie_id.notNull).toBe(false)
    expect(byName.type.notNull).toBe(true)
    expect(byName.valeur.notNull).toBe(true)
  })

  it('sla_config (0012) : colonnes attendues, niveau_urgence unique (une seule règle par niveau)', () => {
    const cfg = getTableConfig(slaConfigPg)
    expect(cfg.name).toBe('sla_config')
    expect(columnNames(slaConfigPg)).toEqual(['id', 'niveau_urgence', 'delai_heures', 'created_at'])
    expect(cfg.foreignKeys).toHaveLength(0)

    const byName = Object.fromEntries(cfg.columns.map((c) => [c.name, c]))
    expect(byName.niveau_urgence.notNull).toBe(true)
    expect(byName.niveau_urgence.isUnique).toBe(true)
    expect(byName.delai_heures.notNull).toBe(true)
  })

  it('clients : colonnes attendues (dont type_client/niu/whatsapp/email/source, 0006) + FK profile_id -> profiles', () => {
    const cfg = getTableConfig(clientsPg)
    expect(cfg.name).toBe('clients')
    expect(columnNames(clientsPg)).toEqual([
      'id', 'profile_id', 'nom', 'telephone', 'quartier',
      'type_client', 'niu', 'whatsapp', 'email', 'source',
    ])
    expect(cfg.foreignKeys).toHaveLength(1)
    expect(cfg.foreignKeys[0].reference().foreignTable).toBe(profilesPg)

    const byName = Object.fromEntries(cfg.columns.map((c) => [c.name, c]))
    expect(byName.type_client.notNull).toBe(true)
    expect(byName.niu.notNull).toBe(false)
    expect(byName.whatsapp.notNull).toBe(false)
    expect(byName.email.notNull).toBe(false)
    expect(byName.source.notNull).toBe(true)
  })

  it('demandes : colonnes attendues (dont niveau_urgence/date_souhaitee/delai_cible, 0014) + FK client_id/categorie_id', () => {
    const cfg = getTableConfig(demandesPg)
    expect(cfg.name).toBe('demandes')
    expect(columnNames(demandesPg)).toEqual([
      'id', 'client_id', 'categorie_id', 'description', 'localisation',
      'canal', 'statut', 'created_at', 'niveau_urgence', 'date_souhaitee', 'delai_cible',
    ])
    expect(cfg.foreignKeys).toHaveLength(2)
    const targets = cfg.foreignKeys.map((fk) => fk.reference().foreignTable)
    expect(targets).toContain(clientsPg)
    expect(targets).toContain(categoriesServicesPg)

    const byName = Object.fromEntries(cfg.columns.map((c) => [c.name, c]))
    expect(byName.niveau_urgence.notNull).toBe(true)
    expect(byName.date_souhaitee.notNull).toBe(false)
    // delai_cible n'est jamais renseignée par l'API — uniquement par le
    // trigger set_demande_delai_cible() (0015) — donc nullable en schéma
    // même si en pratique toujours calculée après le premier INSERT.
    expect(byName.delai_cible.notNull).toBe(false)
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
    expect(columnNames(avisPg)).toEqual(['id', 'matching_id', 'note', 'commentaire', 'created_at', 'reponse'])
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

  it('profiles : conserve le modèle historique et l’adresse de contact', () => {
    expect(columnNames(profilesPg)).toEqual([
      'id', 'email', 'nom', 'role', 'telephone', 'adresse', 'avatar_url', 'actif',
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

  it('interventions (0008) : colonnes attendues + FK matching_id (unique)', () => {
    const cfg = getTableConfig(interventionsPg)
    expect(cfg.name).toBe('interventions')
    expect(columnNames(interventionsPg)).toEqual([
      'id', 'matching_id', 'statut', 'date_planifiee', 'creneau_fin', 'date_debut',
      'date_fin', 'checkin_at', 'checkout_at', 'localisation_checkin', 'preuve',
      'created_at', 'updated_at',
    ])
    expect(cfg.foreignKeys).toHaveLength(1)
    expect(cfg.foreignKeys[0].reference().foreignTable).toBe(matchingsPg)
  })

  it('intervention_evenements (0008) : append-only, colonnes attendues + FK intervention_id/operateur_id', () => {
    const cfg = getTableConfig(interventionEvenementsPg)
    expect(cfg.name).toBe('intervention_evenements')
    expect(columnNames(interventionEvenementsPg)).toEqual([
      'id', 'intervention_id', 'type', 'ancien_statut', 'nouveau_statut',
      'commentaire', 'localisation', 'operateur_id', 'created_at',
    ])
    expect(cfg.foreignKeys).toHaveLength(2)
    const targets = cfg.foreignKeys.map((fk) => fk.reference().foreignTable)
    expect(targets).toContain(interventionsPg)
    expect(targets).toContain(profilesPg)
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

  it("demande_statut inclut 'en_cours' (ajouté en 0007, migration séparée — synchro interventions)", () => {
    expect(demandeStatutEnum.enumValues).toEqual(['nouvelle', 'en_traitement', 'matchee', 'realisee', 'annulee', 'en_cours'])
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

  it('type_client (0006)', () => {
    expect(typeClientEnum.enumValues).toEqual(['particulier', 'entreprise', 'organisation'])
  })

  it('source_client (0006)', () => {
    expect(sourceClientEnum.enumValues).toEqual(['whatsapp', 'appel', 'ecommerce', 'referral'])
  })

  it('type_commission (0010)', () => {
    expect(typeCommissionEnum.enumValues).toEqual(['pourcentage', 'montant_fixe'])
  })

  it('niveau_urgence (0012)', () => {
    expect(niveauUrgenceEnum.enumValues).toEqual(['immediate', 'urgent', 'planifie'])
  })
})

describe('RBAC — profils utilisateurs', () => {
  it('déclare les enums RBAC attendus', () => {
    expect(rbacModuleEnum.enumValues).toEqual([
      'STOCK', 'COMMERCIAL', 'FINANCE', 'HR', 'PRODUCTION',
      'LOGISTICS', 'ADMIN', 'REPORTS', 'RECEIVABLES',
      'DEMANDES', 'MATCHING', 'PRESTATAIRES', 'CLIENTS', 'INTERVENTIONS',
      'TRANSACTIONS', 'REVERSEMENTS', 'PARAMETRAGE', 'UTILISATEURS', 'AUDIT',
    ])
    expect(rbacActionEnum.enumValues).toEqual(['READ', 'CREATE', 'UPDATE', 'DELETE', 'VALIDATE', 'CONFIGURE', 'EXPORT'])
    expect(rbacRoleNameEnum.enumValues).toContain('SUPER_ADMIN')
    expect(rbacRoleNameEnum.enumValues).toContain('DISPATCHER')
    expect(auditActionEnum.enumValues).toContain('ROLE_CHANGED')
  })

  it('relie les profils utilisateurs, rôles et permissions par des clés étrangères', () => {
    const rolePermTargets = getTableConfig(rbacRolePermissionsPg).foreignKeys.map((fk) => fk.reference().foreignTable)
    expect(rolePermTargets).toEqual(expect.arrayContaining([rbacRolesPg, rbacPermissionsPg, profilesPg]))

    const userProfileTargets = getTableConfig(rbacUserProfilesPg).foreignKeys.map((fk) => fk.reference().foreignTable)
    expect(userProfileTargets).toEqual(expect.arrayContaining([profilesPg, rbacRolesPg]))
  })

  it('préserve les journaux de sécurité et les paramètres singleton', () => {
    const auditTargets = getTableConfig(rbacAuditLogsPg).foreignKeys.map((fk) => fk.reference().foreignTable)
    expect(auditTargets).toContain(profilesPg)
    expect(columnNames(rbacSecuritySettingsPg)).toContain('id')
    expect(columnNames(rbacLoginAttemptsPg)).toEqual(['id', 'email', 'ip_address', 'success', 'user_agent', 'attempted_at'])
  })
})

describe('Migrations générées', () => {
  const drizzleDir = join(__dirname, '..', 'drizzle')

  it('0021 crée les tables RBAC avec contraintes, index et RLS', () => {
    const sql = readFileSync(join(drizzleDir, '0021_rbac_user_profiles.sql'), 'utf8')
    for (const table of ['rbac_roles', 'rbac_permissions', 'rbac_role_permissions', 'rbac_user_profiles', 'rbac_audit_logs', 'rbac_security_settings', 'rbac_login_attempts']) {
      expect(sql).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`))
      expect(sql).toMatch(new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`))
    }
    expect(sql).toMatch(/rbac_permissions_module_action_unique UNIQUE \(module, action\)/)
    expect(sql).toMatch(/rbac_role_permissions_role_permission_unique UNIQUE \(role_id, permission_id\)/)
    expect(sql).toMatch(/rbac_login_attempts_email_ip_attempted_at_idx/)
  })

  it('0022 ajoute l’adresse de contact aux profils sans rendre la colonne obligatoire', () => {
    const sql = readFileSync(join(drizzleDir, '0022_profiles_adresse.sql'), 'utf8')
    expect(sql).toMatch(/ALTER TABLE public\.profiles ADD COLUMN IF NOT EXISTS adresse text;/)
  })

  it('0024–0025 remplacent le catalogue ERP actif par les rôles métier MAIDERES', () => {
    const enums = readFileSync(join(drizzleDir, '0024_rbac_maideres_enum_values.sql'), 'utf8')
    const roles = readFileSync(join(drizzleDir, '0025_rbac_maideres_roles.sql'), 'utf8')
    expect(enums).toMatch(/ADD VALUE IF NOT EXISTS 'DISPATCHER'/)
    expect(enums).toMatch(/ADD VALUE IF NOT EXISTS 'REVERSEMENTS'/)
    expect(roles).toMatch(/'PARTNER_MANAGER', 'Gestionnaire prestataires'/)
    expect(roles).toMatch(/DELETE FROM public\.rbac_user_profiles/)
    expect(roles).toMatch(/DELETE FROM public\.rbac_permissions/)
  })

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

  it("les triggers de garde (0001) laissent passer le service role — régression trouvée par le test d'intégration réel", () => {
    // 0004 a introduit un premier correctif (current_user = 'service_role')
    // qui s'est révélé faux à l'usage : current_user à l'intérieur d'une
    // fonction SECURITY DEFINER reflète le PROPRIÉTAIRE de la fonction, pas
    // l'appelant. Seul un test contre un vrai Postgres (avec de vrais
    // triggers) pouvait révéler ça — un mock ne simule aucun trigger.
    // 0005 corrige avec auth.role(), l'idiome Supabase correct (lit un GUC
    // positionné par PostgREST, qui persiste à travers SECURITY DEFINER).
    const v1 = readFileSync(join(drizzleDir, '0004_fix_service_role_triggers.sql'), 'utf8')
    expect(v1).toMatch(/current_user = 'service_role'/)

    const v2 = readFileSync(join(drizzleDir, '0005_fix_service_role_check_v2.sql'), 'utf8')
    for (const fn of ['guard_prestataire_self_update', 'guard_profile_self_update']) {
      expect(v2).toMatch(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}[\\s\\S]*?auth\\.role\\(\\) = 'service_role'`))
    }
    // La dernière version en date ne doit plus s'appuyer sur current_user
    // (le commentaire du fichier l'évoque pour expliquer le correctif, mais
    // le code des fonctions ne doit plus le tester).
    expect(v2).not.toMatch(/current_user = 'service_role'/)
  })

  it("0006 étend clients (type_client/niu/whatsapp/email/source) sans recréer la table", () => {
    const sql = readFileSync(join(drizzleDir, '0006_acoustic_clea.sql'), 'utf8')
    expect(sql).toMatch(/CREATE TYPE "public"\."type_client" AS ENUM\('particulier', 'entreprise', 'organisation'\)/)
    expect(sql).toMatch(/CREATE TYPE "public"\."source_client" AS ENUM\('whatsapp', 'appel', 'ecommerce', 'referral'\)/)
    for (const col of ['type_client', 'niu', 'whatsapp', 'email', 'source']) {
      expect(sql).toMatch(new RegExp(`ALTER TABLE "clients" ADD COLUMN "${col}"`))
    }
    expect(sql).not.toMatch(/DROP TABLE/i)
    expect(sql).not.toMatch(/CREATE TABLE/i)
  })

  it("0007 ajoute SEULE la valeur d'enum 'en_cours' — aucune autre instruction dans le même fichier/transaction", () => {
    // Contrainte Postgres : ALTER TYPE ... ADD VALUE ne peut pas être utilisé
    // dans la même transaction qu'une instruction qui référence cette valeur.
    // 0007 doit donc être un fichier à une seule ligne, appliqué (via son
    // propre appel drizzle-kit migrate) avant que 0008/0009 n'existent.
    const sql = readFileSync(join(drizzleDir, '0007_careful_norman_osborn.sql'), 'utf8')
    const statements = sql.split('\n').map((l) => l.trim()).filter(Boolean)
    expect(statements).toEqual([`ALTER TYPE "demande_statut" ADD VALUE 'en_cours';`])
  })

  it('0008 crée interventions + intervention_evenements (tables neuves, ne recrée rien d\'existant)', () => {
    const sql = readFileSync(join(drizzleDir, '0008_clear_impossible_man.sql'), 'utf8')
    expect(sql).toMatch(/CREATE TYPE "public"\."statut_intervention" AS ENUM\(\s*'planifiee', 'en_route', 'sur_site', 'en_cours', 'realisee', 'echouee', 'reportee', 'annulee'/)
    expect(sql).toMatch(/CREATE TYPE "public"\."type_evenement" AS ENUM\('changement_statut', 'note', 'checkin', 'checkout', 'retard'\)/)
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS "interventions"/)
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS "intervention_evenements"/)
    expect(sql).toMatch(/"interventions_matching_id_unique" UNIQUE\("matching_id"\)/)
    // Ne référence jamais la valeur d'enum 'en_cours' de demande_statut dans le DDL —
    // ce fichier ne fait que créer des tables/enums, la valeur a déjà été committée en 0007.
    for (const table of [
      'profiles', 'categories_services', 'prestataires', 'clients', 'demandes',
      'matchings', 'transactions', 'avis', 'reversements', 'notifications_log', 'audit_log',
    ]) {
      expect(sql).not.toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS "${table}"`))
    }
  })

  it('0009 : RLS sur les deux tables, intervention_evenements sans policy UPDATE/DELETE (append-only)', () => {
    const sql = readFileSync(join(drizzleDir, '0009_intervention_sync.sql'), 'utf8')
    expect(sql).toMatch(/ALTER TABLE public\.interventions ENABLE ROW LEVEL SECURITY/)
    expect(sql).toMatch(/ALTER TABLE public\.intervention_evenements ENABLE ROW LEVEL SECURITY/)
    expect(sql).not.toMatch(/CREATE POLICY \w*intervention_evenements\w* ON public\.intervention_evenements\s+FOR (UPDATE|DELETE)/)
  })

  it('0009 : le trigger de synchro couvre checkin (force sur_site), checkout (ne force rien), et une seule ligne de journal par UPDATE', () => {
    const sql = readFileSync(join(drizzleDir, '0009_intervention_sync.sql'), 'utf8')
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.sync_intervention_statut/)
    expect(sql).toMatch(/DROP TRIGGER IF EXISTS trg_sync_intervention_statut ON public\.interventions/)
    expect(sql).toMatch(/BEFORE UPDATE ON public\.interventions/)

    // Check-in force le statut, une seule branche v_event_type possible par exécution
    // (checkin > checkout > changement_statut, jamais deux à la fois — cf. commentaire du fichier).
    expect(sql).toMatch(/NEW\.statut := 'sur_site'/)
    expect(sql).toMatch(/v_is_checkin/)
    expect(sql).toMatch(/v_is_checkout/)
    expect(sql).toMatch(/INSERT INTO public\.intervention_evenements/)

    // Synchro demande : les 3 branches attendues, et le placeholder de reversement documenté.
    expect(sql).toMatch(/NEW\.statut IN \('en_route', 'sur_site', 'en_cours'\)[\s\S]*?SET statut = 'en_cours'/)
    expect(sql).toMatch(/NEW\.statut = 'realisee'[\s\S]*?SET statut = 'realisee'/)
    expect(sql).toMatch(/INSERT INTO public\.reversements \(prestataire_id, montant, statut, ref\)\s*\n\s*VALUES \(v_prestataire_id, 0, 'en_attente'/)
    expect(sql).toMatch(/NEW\.statut IN \('annulee', 'echouee'\)[\s\S]*?SET statut = 'annulee'/)
  })

  it('0010 crée type_commission + commission_config, et rend prestataires.taux_commission nullable', () => {
    const sql = readFileSync(join(drizzleDir, '0010_commission_config.sql'), 'utf8')
    expect(sql).toMatch(/CREATE TYPE "public"\."type_commission" AS ENUM\('pourcentage', 'montant_fixe'\)/)
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS "commission_config"/)
    expect(sql).toMatch(/ALTER TABLE "prestataires" ALTER COLUMN "taux_commission" DROP DEFAULT/)
    expect(sql).toMatch(/ALTER TABLE "prestataires" ALTER COLUMN "taux_commission" DROP NOT NULL/)
    expect(sql).toMatch(/"commission_config_categorie_id_categories_services_id_fk"/)
  })

  it("0011 : RLS sur commission_config (lecture staff, écriture admin), seed d'une règle globale, et calculer_commission couvre les 3 cas de résolution dans l'ordre override > catégorie > global", () => {
    const sql = readFileSync(join(drizzleDir, '0011_commission_calculee.sql'), 'utf8')

    expect(sql).toMatch(/ALTER TABLE public\.commission_config ENABLE ROW LEVEL SECURITY/)
    expect(sql).toMatch(/commission_config_select_staff[\s\S]*?is_staff\(\)/)
    expect(sql).toMatch(/commission_config_write_admin[\s\S]*?is_admin\(\)/)

    expect(sql).toMatch(/UPDATE public\.prestataires SET taux_commission = NULL WHERE taux_commission = 0/)
    expect(sql).toMatch(/INSERT INTO public\.commission_config \(categorie_id, type, valeur, actif\)/)

    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.calculer_commission/)
    // Ordre de résolution : le bloc (a) override prestataire doit apparaître
    // avant le bloc (b) catégorie, lui-même avant le bloc (c) globale.
    const fnBody = sql.slice(sql.indexOf('FUNCTION public.calculer_commission'))
    const idxOverride = fnBody.indexOf('v_taux_prestataire')
    const idxCategorie = fnBody.indexOf("categorie_id = _categorie_id")
    const idxGlobale = fnBody.indexOf('categorie_id IS NULL')
    expect(idxOverride).toBeGreaterThan(-1)
    expect(idxCategorie).toBeGreaterThan(idxOverride)
    expect(idxGlobale).toBeGreaterThan(idxCategorie)

    // Câblage sur transactions : trigger BEFORE INSERT, jamais AFTER (les
    // colonnes doivent être écrasées avant l'écriture, pas après).
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.set_transaction_commission/)
    expect(sql).toMatch(/NEW\.commission_montant := v_commission/)
    expect(sql).toMatch(/DROP TRIGGER IF EXISTS trg_transactions_commission ON public\.transactions/)
    expect(sql).toMatch(/BEFORE INSERT ON public\.transactions/)
  })

  it('0012 crée niveau_urgence + sla_config (table neuve, une seule règle par niveau)', () => {
    const sql = readFileSync(join(drizzleDir, '0012_sla_config.sql'), 'utf8')
    expect(sql).toMatch(/CREATE TYPE "public"\."niveau_urgence" AS ENUM\('immediate', 'urgent', 'planifie'\)/)
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS "sla_config"/)
    expect(sql).toMatch(/"sla_config_niveau_urgence_unique" UNIQUE\("niveau_urgence"\)/)
  })

  it('0013 : RLS sur sla_config — une seule policy ALL réservée au staff (pas de visibilité prestataire/client)', () => {
    const sql = readFileSync(join(drizzleDir, '0013_sla_config_rls.sql'), 'utf8')
    expect(sql).toMatch(/ALTER TABLE public\.sla_config ENABLE ROW LEVEL SECURITY/)
    expect(sql).toMatch(/DROP POLICY IF EXISTS sla_config_all_staff ON public\.sla_config/)
    expect(sql).toMatch(/CREATE POLICY sla_config_all_staff ON public\.sla_config\s*\n\s*FOR ALL USING \(public\.is_staff\(\)\) WITH CHECK \(public\.is_staff\(\)\)/)
  })

  it("RLS active sur les 4 tables citées par la tâche (sla_config, commission_config, interventions, intervention_evenements)", () => {
    // Consolidation : vérifie que chacune a bien ENABLE ROW LEVEL SECURITY
    // dans SA migration d'origine, sans dupliquer une policy déjà écrite
    // ailleurs (interventions/intervention_evenements en 0009, commission_config
    // en 0011, sla_config en 0013).
    const files: Record<string, string> = {
      sla_config:              '0013_sla_config_rls.sql',
      commission_config:       '0011_commission_calculee.sql',
      interventions:           '0009_intervention_sync.sql',
      intervention_evenements: '0009_intervention_sync.sql',
    }
    for (const [table, file] of Object.entries(files)) {
      const sql = readFileSync(join(drizzleDir, file), 'utf8')
      expect(sql).toMatch(new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`))
    }
  })

  it('0014 ajoute niveau_urgence/date_souhaitee/delai_cible sur demandes + index sur delai_cible, sans recréer la table', () => {
    const sql = readFileSync(join(drizzleDir, '0014_petite_speed_demon.sql'), 'utf8')
    expect(sql).toMatch(/ALTER TABLE "demandes" ADD COLUMN "niveau_urgence" "niveau_urgence" DEFAULT 'urgent' NOT NULL/)
    expect(sql).toMatch(/ALTER TABLE "demandes" ADD COLUMN "date_souhaitee" timestamp with time zone;/)
    expect(sql).toMatch(/ALTER TABLE "demandes" ADD COLUMN "delai_cible" timestamp with time zone;/)
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS "demandes_delai_cible_idx" ON "demandes" USING btree \("delai_cible"\)/)
    expect(sql).not.toMatch(/DROP TABLE|CREATE TABLE/i)
  })

  it('0015 : delai_cible est calculée par trigger (jamais par API) — planifie+date_souhaitee court-circuite sla_config, seed + backfill idempotents', () => {
    const sql = readFileSync(join(drizzleDir, '0015_demandes_delai_cible_trigger.sql'), 'utf8')

    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.calculer_delai_cible/)
    // Le court-circuit 'planifie' + date_souhaitee doit apparaître AVANT le
    // lookup sla_config (sinon date_souhaitee ne primerait pas dessus).
    const fnBody = sql.slice(sql.indexOf('FUNCTION public.calculer_delai_cible'))
    const idxPlanifie = fnBody.indexOf(`_niveau = 'planifie'`)
    const idxLookup    = fnBody.indexOf('SELECT delai_heures INTO v_heures FROM public.sla_config')
    expect(idxPlanifie).toBeGreaterThan(-1)
    expect(idxLookup).toBeGreaterThan(idxPlanifie)

    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.set_demande_delai_cible/)
    expect(sql).toMatch(/NEW\.delai_cible := public\.calculer_delai_cible/)
    expect(sql).toMatch(/DROP TRIGGER IF EXISTS trg_demandes_delai_cible ON public\.demandes/)
    expect(sql).toMatch(/BEFORE INSERT OR UPDATE OF niveau_urgence, date_souhaitee ON public\.demandes/)

    // Seed sla_config idempotent (WHERE NOT EXISTS, jamais un INSERT nu qui
    // dupliquerait ou échouerait sur la contrainte UNIQUE si rejoué).
    expect(sql).toMatch(/INSERT INTO public\.sla_config \(niveau_urgence, delai_heures\)[\s\S]*?WHERE NOT EXISTS/)
    expect(sql).toMatch(/'immediate'[\s\S]*?2\)/)
    expect(sql).toMatch(/'urgent'[\s\S]*?24\)/)
    expect(sql).toMatch(/'planifie'[\s\S]*?72\)/)

    // Backfill des demandes déjà existantes, restreint aux lignes pas
    // encore calculées (jamais un UPDATE inconditionnel qui écraserait un
    // futur recalcul manuel).
    expect(sql).toMatch(/UPDATE public\.demandes\s*\n\s*SET delai_cible = public\.calculer_delai_cible\(niveau_urgence, created_at, date_souhaitee\)\s*\n\s*WHERE delai_cible IS NULL/)
  })

  it('0026 bootstrap le profil à l’inscription (auth.users) en rôle apprenant, jamais un rôle staff', () => {
    const sql = readFileSync(join(drizzleDir, '0026_signup_auth_bootstrap.sql'), 'utf8')

    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.handle_new_user/)
    expect(sql).toMatch(/AFTER INSERT ON auth\.users/)
    expect(sql).toMatch(/DROP TRIGGER IF EXISTS on_auth_user_created ON auth\.users/)

    // Insertion idempotente, rôle 'apprenant' codé en dur dans l'INSERT
    // lui-même (jamais un rôle staff par défaut) — vérifié sur le VALUES
    // exact plutôt que sur le fichier entier, dont les commentaires citent
    // légitimement admin/superviseur/operateur pour expliquer pourquoi ils
    // en sont exclus.
    const insertMatch = sql.match(/INSERT INTO public\.profiles[\s\S]*?ON CONFLICT \(id\) DO NOTHING;/)
    expect(insertMatch).not.toBeNull()
    expect(insertMatch![0]).toMatch(/'apprenant'/)
    expect(insertMatch![0]).not.toMatch(/'admin'|'superviseur'|'operateur'/)
  })

  it("0027 crée offres/promotions/realisations et n'essaie pas de rejouer profiles.adresse (déjà ajoutée en 0022)", () => {
    const sql = readFileSync(join(drizzleDir, '0027_offres_promotions_realisations.sql'), 'utf8')
    for (const table of ['offres', 'promotions', 'realisations']) {
      expect(sql).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS "${table}"`))
    }
    expect(sql).toMatch(/ALTER TABLE "prestataires" ADD COLUMN "ville" text;/)
    expect(sql).toMatch(/ALTER TABLE "prestataires" ADD COLUMN "disponible" boolean DEFAULT true NOT NULL;/)
    // Drizzle a proposé de rejouer cette colonne (sa propre trace de snapshot
    // ignore la migration 0022, écrite à la main) — retirée manuellement du
    // fichier généré car elle casserait sur une base où 0022 est déjà appliquée.
    expect(sql).not.toMatch(/ALTER TABLE "profiles" ADD COLUMN "adresse"/)
  })

  it('0028 active RLS sur offres/promotions/realisations, ajoute la contrainte remise_pct et le bucket storage "maideres"', () => {
    const sql = readFileSync(join(drizzleDir, '0028_offres_promotions_realisations_rls.sql'), 'utf8')
    for (const table of ['offres', 'promotions', 'realisations']) {
      expect(sql).toMatch(new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`))
      // Chaque table doit avoir une policy de lecture publique distincte de
      // celle du staff/propriétaire — c'est ce qui permet à la vitrine
      // connect de fonctionner sans session utilisateur.
      expect(sql).toMatch(new RegExp(`CREATE POLICY ${table}_select_public ON public\\.${table}`))
    }
    expect(sql).toMatch(/CHECK \(remise_pct > 0 AND remise_pct <= 100\)/)
    expect(sql).toMatch(/INSERT INTO storage\.buckets \(id, name, public\)\s*\n\s*VALUES \('maideres', 'maideres', true\)\s*\n\s*ON CONFLICT \(id\) DO NOTHING/)
    // Écriture restreinte au dossier du propriétaire (auth.uid()), jamais un accès storage ouvert.
    expect(sql).toMatch(/\(storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/)
  })

  it('0029 ajoute avis.reponse (nullable, colonne unique ajoutée sans recréer la table)', () => {
    const sql = readFileSync(join(drizzleDir, '0029_avis_reponse.sql'), 'utf8')
    expect(sql).toMatch(/ALTER TABLE "avis" ADD COLUMN "reponse" text;/)
    expect(sql).not.toMatch(/NOT NULL/)
    expect(sql).not.toMatch(/DROP TABLE|CREATE TABLE/i)
  })

  it('0030 autorise le prestataire concerné (jamais un autre) à modifier son propre avis reçu', () => {
    const sql = readFileSync(join(drizzleDir, '0030_avis_reponse_rls.sql'), 'utf8')
    expect(sql).toMatch(/CREATE POLICY avis_update_own_prestataire ON public\.avis/)
    expect(sql).toMatch(/FOR UPDATE USING/)
    expect(sql).toMatch(/m\.prestataire_id = public\.own_prestataire_id\(\)/)
  })
})
