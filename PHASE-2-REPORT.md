# Phase 2 — Rapport : API cœur (apps/api)

Statut : **complétée**.

## Routes livrées

Toutes montées sous `/api/*`, derrière `authMiddleware` + `auditMiddleware`
(réutilisés tels quels), format `{ data }` / `{ error, code? }` cohérent
avec `profile.ts`/`admin.ts` existants.

| Route | Méthodes | Accès |
|---|---|---|
| `/api/categories_services` | GET | staff : toutes ; sinon : `actif=true` seulement |
| `/api/prestataires` | GET, GET /:id, POST, PATCH /:id, PATCH /:id/statut, DELETE /:id | voir RBAC ci-dessous |
| `/api/clients` | GET, GET /:id, POST, PATCH /:id, DELETE /:id | idem |
| `/api/demandes` | GET, GET /:id, POST, PATCH /:id/statut | idem |
| `/api/matchings` | GET, GET /:id, POST, PATCH /:id/accepter, PATCH /:id/refuser, PATCH /:id/cloturer | idem |
| `/api/avis` | GET, POST | idem |

Pas de paiement, pas de notifications — hors périmètre Phase 2, comme
demandé.

## RBAC — même décision qu'en Phase 1, reportée côté API

`profiles.role` n'a toujours pas de valeur `prestataire`/`client`
(contrainte non levée). L'API tourne avec le service role (bypass RLS),
donc **la RLS de la Phase 1 ne protège rien ici** — chaque route
réimplémente la même logique d'identité dérivée, centralisée dans
`apps/api/src/services/identity.service.ts` (`ownPrestataireId`,
`ownClientId`, `isStaff`) : c'est l'exact miroir TS des fonctions SQL
`public.own_prestataire_id()` / `public.own_client_id()` /
`public.is_staff()` de `0001_rls_policies.sql`. Un utilisateur est
prestataire ou client selon l'existence d'une ligne dans
`prestataires`/`clients` dont `profile_id` == son id, jamais via
`profiles.role`.

Règles clés :
- **proposer un matching** (`POST /api/matchings`) : staff uniquement
  (`admin`, `superviseur`, `operateur`).
- **accepter/refuser** un matching : le prestataire assigné uniquement, sur
  son propre matching, statut `propose` requis.
- **clôturer** un matching (`PATCH /:id/cloturer`, issue `realise`/`echoue`
  + motif) : staff **ou** le prestataire assigné — **jamais le client**,
  vérifié explicitement par le test d'intégration RBAC de cette phase.
- Un client ne voit dans `GET /api/prestataires` que les fiches
  `statut='actif'` (même règle qu'en RLS Phase 1, réappliquée ici).

Enchaînement automatique des statuts `demandes` piloté par le cycle de vie
`matchings` (pas d'endpoint manuel pour ça) :
`nouvelle` →(proposer)→ `en_traitement` →(accepter)→ `matchee`
→(clôturer réalisé)→ `realisee` ; clôturer en échec repasse la demande en
`en_traitement` (reproposable à un autre prestataire).

## Gap d'infrastructure trouvé et corrigé : `audit_log`

`auditMiddleware` (conservé tel quel depuis Phase 0) écrit dans une table
`audit_log` sur chaque requête mutante — mais aucune migration ne la créait
plus : la Phase 0 avait vidé toutes les anciennes migrations Tafdil, et la
Phase 1 n'a créé que les 9 tables marketplace + `profiles`. Sans cette
table, "chaque écriture journalisée" (exigence explicite de cette phase)
aurait silencieusement échoué en prod (l'insert catch l'erreur et log
`console.error`, ne bloque jamais la requête — donc le bug serait resté
invisible sans test dédié).

Corrigé en ajoutant `auditLogPg` à `packages/db/src/schema.pg.ts` (distincte
de `rbac_audit_logs`, qui reste l'audit trail RBAC/sécurité) + deux
migrations : `0002_smooth_red_hulk.sql` (générée, création de table) et
`0003_audit_log_rls.sql` (écrite à la main, RLS staff-only, cohérente avec
`0001`). `packages/db/__tests__/schema.test.ts` étendu (22 → 24 tests) pour
couvrir ce gap et éviter qu'il ne se reproduise silencieusement.

## Tests (`apps/api/src/__tests__/`)

- `marketplace-flow.test.ts` (9 tests, nouveau) :
  - Flux complet demande → matching proposé → accepté → clôturé `realise`
    → avis, avec vérification des transitions de statut automatiques à
    chaque étape.
  - RBAC : un client qui tente de clôturer un matching → `403` (le test
    explicitement demandé par cette phase).
  - RBAC : un client qui tente de proposer un matching → `403`.
  - RBAC : `GET /api/prestataires` en tant que client ne renvoie que les
    `statut='actif'`.
  - Audit : vérifie que `demandes`, `matchings`, `avis` apparaissent bien
    dans `audit_log` après le flux.
- `fakeSupabase.ts` (nouveau, infra de test) : les mocks à réponse unique
  existants (`helpers.ts::mkChain`) ne suffisent pas pour un flux qui
  dépend de l'état écrit par l'étape précédente (créer une demande, puis la
  relire après un matching, etc.) — nécessaire pour tester un vrai flux
  multi-requêtes plutôt que des routes isolées.
- Suite complète `apps/api` : **39/39 tests verts** (adds aux 30
  pré-existants : `auth`, `rbac`, `inviteRedirect`).

## Validation

- `pnpm build` (workspace complet, hors `apps/mobile` gelé) : **vert**,
  8/8 tâches (incluant `@forge/api` et `@forge/db`).
- `pnpm test` sur `apps/api` : **39/39 verts**.
- `pnpm test` sur `packages/db` : **24/24 verts** (schéma + le nouveau
  `audit_log`).
- `tsc --noEmit` sur `apps/api` : 3 erreurs, **toutes pré-existantes dans
  `admin.ts`** (fichier non touché par ce travail, confirmé par
  `git diff --stat` vide sur ce fichier) — non liées à cette phase, pas
  corrigées ici pour rester strictement dans le périmètre demandé.

## Ce qui n'a pas été touché (hors périmètre, comme demandé)

- Aucune app front (`apps/web`, `apps/shop`) — Phase 3/4.
- Aucun paiement (NotchPay/`transactions`) — Phase 5.
- Aucune notification (`notifications_log`) — Phase 6.
- `profiles.role`/`rbac_roles.name` toujours pas renommés.
