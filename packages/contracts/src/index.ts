/**
 * @maideres/contracts — contrat canonique entre l'API MAIDERES et ses
 * consommateurs internes (apps/web, maidere-connect). Master prompt §8.
 *
 * maidere-connect (repo séparé) ne consomme PAS ce package directement —
 * aucun pipeline de publication npm n'existe pour l'instant (§25 accepte
 * explicitement un client HTTP léger comme solution intérimaire, déjà en
 * place : maidere-connect/src/lib/maideres-core-client.ts + maideres-api.ts).
 * Les formes de données y sont maintenues manuellement en miroir de ce
 * package — toute modification ici doit être répercutée là-bas.
 *
 * Toutes les routes métier d'apps/api (categories, prestataires, clients,
 * demandes, matchings, avis, sla_config, commission_config, transactions,
 * interventions, offres, promotions, realisations) importent désormais
 * leurs schémas de validation d'entrée d'ici plutôt que d'en déclarer une
 * copie locale — plus aucune duplication sur ce périmètre. `admin.ts`
 * (gestion RBAC/utilisateurs) reste hors périmètre : ce ne sont pas des
 * entités du domaine marketplace, cf. §8 (contrat métier, pas sécurité).
 * `reversements` n'a pas de schéma de création (aucune route n'en crée —
 * amorcé uniquement par trigger, cf. 0009_intervention_sync.sql).
 */
export * from './enums'
export * from './common'
export * from './profiles'
export * from './categories'
export * from './prestataires'
export * from './clients'
export * from './demandes'
export * from './matchings'
export * from './interventions'
export * from './avis'
export * from './transactions'
export * from './reversements'
export * from './sla-config'
export * from './commission-config'
export * from './offres'
export * from './promotions'
export * from './realisations'
export * from './notifications'
