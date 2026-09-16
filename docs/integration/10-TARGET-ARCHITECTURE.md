# 10 — Target Architecture

This describes the architecture as it stands after `09-MIGRATION-PLAN.md`'s executed steps — largely the target state envisioned in the master prompt's opening diagram (§0), not a future aspiration.

```
                         MAIDERES PLATFORM
                                │
                 ┌──────────────┴──────────────┐
                 │                             │
          MAIDERE CONNECT                 MAIDERES ERP
       (front-office, TanStack Start)   (apps/web, React/Vite)
                 │                             │
                 └──────────────┬──────────────┘
                                │
                         MAIDERES API
                        (apps/api, Hono)
                                │
                      ┌─────────┴─────────┐
                      │                   │
              packages/contracts    Supabase (one project)
              (shared Zod schemas)   Auth · Postgres · Storage
```

## One authoritative database

A single Supabase project (`fdrczvkqjbtocvoqwenh`) is now the only business database. `packages/db/src/schema.pg.ts` is the schema source of truth; `packages/db/drizzle/*.sql` (0000–0030, all applied live) is its migration history. `maidere-connect`'s old project is retired — nothing in either codebase points at it anymore.

## One authoritative auth system

Supabase Auth on that same project, used directly by both frontends (matches master-prompt §17: one auth *backend*, consumed by multiple frontends is fine — the violation would be a second independent backend, which is what existed before and is now gone). `handle_new_user()` (migration `0026`) bootstraps every new signup into `profiles` at role `apprenant`; `apps/api`'s `identity.service.ts` derives client/prestataire identity from the existence of a `clients`/`prestataires` row, not from a role value — this was already MAIDERES's Phase 1 design and is now the model both frontends rely on.

## One canonical API

`apps/api` (Hono) is the only path to business data for both frontends. Direct-to-Supabase access is now limited, by design, to:
- Auth (`supabase.auth.*`) — both frontends.
- Storage (gallery upload) — `maidere-connect`'s `/pro/galerie`.

Everything else — `clients`, `prestataires`, `demandes`, `matchings`, `interventions`, `avis`, `offres`, `promotions`, `realisations`, `transactions`, `reversements`, `sla_config`, `commission_config` — goes through `apps/api`. Unauthenticated public reads (directory browsing) go through a dedicated `publicRouter`, mounted outside the auth-required sub-app, each route re-applying the same visibility filter RLS would enforce (since the API itself runs on the service-role client and bypasses RLS).

## One canonical contract

`packages/contracts` — Zod schemas + inferred types for every entity, consumed directly by `apps/api` and `apps/web` (same pnpm workspace). `maidere-connect` (separate repo, no publish pipeline) mirrors the same shapes manually in `src/lib/maideres-api.ts`, per master-prompt §25's explicit allowance for a "thin client with the same contract" when publishing isn't yet set up.

## No duplicated business logic

Commission calculation (`calculer_commission()`), SLA deadline computation (`calculer_delai_cible()`), and status-transition rules live once, in the database (triggers) or in `apps/api` (Zod validators + route guards), never reimplemented in either frontend. `maidere-connect`'s old standalone reimplementation (`src/lib/maidere.ts`) is dead code now that real `demandes`/`sla_config`/`commission_config` exist — flagged for removal in a future cleanup pass, not yet deleted (still referenced by two landing-page marketing widgets that would need their data source swapped first).

## Security layers agree (§18)

- **Frontend guards**: `maidere-connect`'s `_authenticated/espace.tsx`/`pro.tsx` redirect cross-role visits; UX only.
- **API authorization**: every route checks `isStaff()`/ownership via `identity.service.ts`, verified by both unit tests (mocked) and the live E2E run.
- **Database RLS**: present and correct on every table, currently the *actual* enforcement boundary only for direct-Supabase traffic (Auth, Storage) — decorative for `apps/api` traffic today since the API runs as service-role. This asymmetry is intentional and documented (`08-SECURITY-AUDIT.md`), not an oversight.

## Deployment (target, not yet all live)

```
maidere-connect  ──HTTPS──▶  apps/api  ──▶  Supabase (Auth + Postgres + Storage)
apps/web         ──HTTPS──▶  apps/api  ──▶  Supabase (same project)
```

`apps/api` is deployed independently (Railway, per `railway.json`); `apps/web`/`maidere-connect` may have separate hosts — acceptable per master-prompt §65, since the business core stays centralized regardless of where the frontends are served from.
