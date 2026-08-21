# Phase 1 — Rapport : schéma marketplace (packages/db)

Statut : **complétée**, dans les limites de ce qui est vérifiable sans
projet Supabase live (voir section Validation).

## Schéma (`packages/db/src/schema.pg.ts`)

9 tables ajoutées, `profiles` inchangée : `categories_services`,
`prestataires`, `clients`, `demandes`, `matchings`, `transactions`, `avis`,
`reversements`, `notifications_log`. Toutes les colonnes/enums/FK
correspondent exactement à la spec de la Phase 1.

Choix de type notables :
- `prestataires.categories` : `uuid[]` (tableau Postgres natif, pas de table
  de jointure) — pas de contrainte FK sur les éléments du tableau (Postgres
  ne le permet pas nativement), à valider côté application.
- Montants (`montant_service`, `commission_montant`, `montant` reversements) :
  `integer` — le FCFA n'a pas de sous-unité.
- `commission_taux`/`taux_commission` : `numeric(5,2)` (pourcentage).
- `note_moyenne` : `numeric(3,2)`, `avis.note` : `integer` + `CHECK (note
  BETWEEN 1 AND 5)` ajouté en migration SQL (pas de builder `.check()` fiable
  dans cette version de drizzle-orm).
- `geoloc_lat`/`geoloc_lng` : `doublePrecision`.

## Migrations (`packages/db/drizzle/`)

- `0000_common_cerebro.sql` — généré par `drizzle-kit generate`, crée les
  10 tables + enums. Idempotent nativement (`CREATE TABLE IF NOT EXISTS`,
  `DO $$ ... EXCEPTION WHEN duplicate_object$$` sur les enums/FK).
- `0001_rls_policies.sql` — écrit à la main (RLS n'est pas généré depuis le
  schéma TS dans cette version de drizzle-kit) : fonctions helper, triggers
  de garde, contrainte `avis.note`, policies RLS. Idempotent (`CREATE OR
  REPLACE FUNCTION`, `DROP POLICY IF EXISTS` + `CREATE POLICY`, `DROP
  TRIGGER IF EXISTS` + `CREATE TRIGGER`).

`drizzle.config.ts` pointé vers `./drizzle` (au lieu de `./migrations`,
suivant la consigne de cette phase) et vers `schema.pg.ts` (dialect
`postgresql`).

## RLS — décision de design (le point non trivial de cette phase)

`profiles.role` reste `admin|superviseur|operateur|apprenant` (non
renommé, conformément à la contrainte). Mais RLS doit distinguer 4 rôles
incluant `prestataire` et `client`, qui **n'existent pas** comme valeurs de
`profiles.role`. Résolu ainsi :

- **admin / operateur (+ superviseur)** : identité par `profiles.role`,
  accès large via une fonction `public.is_staff()`.
- **prestataire / client** : identité *dérivée*, pas de valeur de rôle —
  un utilisateur est "prestataire" si une ligne `prestataires.profile_id =
  auth.uid()` existe (idem pour `clients`). Fonctions helper
  `public.own_prestataire_id()` / `public.own_client_id()`
  (`SECURITY DEFINER`, ne renvoient que l'id lié à l'utilisateur courant).

Ce découplage rôle-technique / rôle-métier évite de toucher à l'enum
`role` tout en satisfaisant la RLS à 4 rôles demandée. Politique notable
testée par la checklist : un client ne voit dans `prestataires` que les
lignes `statut = 'actif'` (policy `prestataires_select_actifs_client`) ;
`en_attente`/`suspendu` ne sont visibles que du staff et du prestataire
concerné lui-même.

Défense en profondeur ajoutée (au-delà du strict périmètre RLS) : deux
triggers `BEFORE UPDATE` empêchent un prestataire de s'auto-activer ou de
modifier sa commission/note, et empêchent un utilisateur de changer son
propre `profiles.role`/`actif` — un accès direct à Supabase par un compte
compromis ne suffit pas à contourner ces règles, seul le service role
(API backend) le peut.

## Seed (`packages/db/src/seed.ts`, `pnpm db:seed`)

5 catégories, 3 prestataires (2 actifs + 1 en_attente pour pouvoir tester
la policy de visibilité), 2 clients, 2 demandes. Chaque prestataire/client
a un `profiles` associé — **note** : ces profils sont seedés avec
`role='apprenant'` (la valeur la plus basse-privilège existante, faute de
rôle dédié), leur identité réelle prestataire/client venant de la ligne
`prestataires`/`clients`, pas de `profiles.role`. Idempotent : `upsert` sur
id fixe, ré-exécutable sans dupliquer.

## Tests (`packages/db/__tests__/schema.test.ts`)

22 tests, tous verts : noms de tables et colonnes exacts (via
`getTableConfig`), FK correctement câblées, valeurs d'enum exactes,
présence de `ENABLE ROW LEVEL SECURITY` pour les 10 tables et de la
contrainte `avis.note` dans la migration générée, présence de la policy de
restriction client→prestataires actifs. `vitest.config.ts` +
`packages/db/package.json` (`"test": "vitest run"`) ajoutés (le package
n'avait pas de tests avant cette phase).

## Validation — ce qui a été vérifié ici vs ce qui nécessite le vrai projet Supabase

Vérifié dans cet environnement (aucun Supabase live disponible) :
- `pnpm db:generate` (`drizzle-kit generate`) : **OK**, aucune dérive
  (« No schema changes, nothing to migrate » en relançant après écriture
  du schéma).
- `pnpm build` (workspace complet hors `apps/mobile`, gelé) : **vert**.
- `tsc --noEmit` sur `packages/db` : **aucune erreur**.
- `pnpm test` sur `packages/db` : **22/22 verts**.

Non vérifiable ici, nécessite les identifiants du nouveau projet Supabase
MAIDERES (prérequis déjà signalé dans le plan général, jamais fourni) :
- `pnpm db:migrate` — tenté, échoue avec `Please provide required params
  for Postgres driver: [x] url: ''`, c'est-à-dire une erreur de
  configuration (`DATABASE_URL` absent), pas une erreur de SQL. Le SQL
  généré est syntaxiquement complet et idempotent ; il reste à l'exécuter
  contre une vraie base pour confirmation finale.
- `pnpm db:seed` — écrit et prêt, non exécutable sans
  `SUPABASE_SERVICE_ROLE_KEY` réel.
- Test RLS "un client ne voit pas les prestataires en_attente" avec un
  vrai token JWT — la policy est écrite et couverte par un test statique
  (présence de la clause `statut = 'actif'` dans la policy), mais un test
  d'intégration avec un rôle authentifié réel nécessite la base live.

## Ce qui n'a pas été touché (hors périmètre, comme demandé)

- Aucune app front (`apps/web`, `apps/shop`) modifiée.
- `profiles.role` et `rbac_roles.name` non renommés.
- Aucune route API créée (`apps/api`) — c'est la Phase 2.
