# 04 — API Mapping

## MAIDERES (`apps/api`, Hono, mounted under `/api/*` — not currently `/api/v1/`-prefixed)

All routes behind `authMiddleware` + `auditMiddleware`. Response shape: `{ data }` / `{ error, code? }` (already reasonably close to master-prompt §15's target format, not yet exactly `{data, meta}`/`{error:{code,message,details}}`).

| Route | Methods | Access |
|---|---|---|
| `/profile/me` | GET | Any authenticated user, self |
| `/categories_services` | GET, write | GET open (staff sees inactive too); write `admin` only |
| `/prestataires` | GET, GET/:id, POST, PATCH/:id, PATCH/:id/statut, DELETE/:id | Self-or-staff; statut/delete = staff roles |
| `/clients` | GET, GET/:id, POST, PATCH/:id, DELETE/:id | Self-or-staff; delete = staff |
| `/demandes` | GET, GET/:id, POST, PATCH/:id/statut | `canAccessDemande()`: staff, own client, or matched prestataire |
| `/matchings` | POST, PATCH/:id/accepter, /refuser, /cloturer | Propose=staff; accept/refuse=assigned prestataire only; close=staff or assigned prestataire, never client |
| `/transactions` | GET, GET/:id, POST, /preview-commission | Staff for writes; `canAccessTransaction()` filters reads |
| `/avis` | GET, POST | POST = client on own realised matching |
| `/sla_config` | full CRUD | staff roles |
| `/commission_config` | GET, POST/PATCH/DELETE | GET=staff; write=`admin` only |
| `/interventions` | full lifecycle incl. checkin/checkout | `canAccessIntervention()`: staff or matched prestataire write; client read-only |
| `/reversements` | GET, /marquer-paye | staff; net amount recomputed server-side |
| `/admin/*` | RBAC/user management, RBAC CRUD, audit log export, security settings | gated by `UTILISATEURS:CONFIGURE` permission |

Documentation: no OpenAPI spec found; a `.postman/`/`postman/` structure exists but the actual globals file is empty — **no committed Postman collection currently documents this API**.

## maidere-connect

**No API exists.** Every read/write in `src/` goes directly to Supabase (`supabase.from(...)`, `supabase.auth.*`, Storage) against its own project. No Edge Functions (`supabase/functions/` doesn't exist). No server-side route handlers beyond TanStack Start's file-based page loaders, which themselves just call the Supabase client.

## apps/shop

Has 4 real API routes, all narrowly scoped to its own OTP auth, none reusable for the marketplace domain:
`POST /api/auth/shop/demander-otp`, `POST /api/auth/shop/verifier-otp`, `PATCH /api/auth/shop/profil`, `POST /api/auth/shop/logout`. No route in `apps/shop` calls `apps/api` — it talks to Supabase directly for everything, including the (currently broken) order-tracking pages.

## Gap analysis for making maidere-connect consume the MAIDERES API

To become the front-office per master-prompt §25 ("Connect must consume MAIDERES APIs... centralize API access"), `maidere-connect` needs endpoints that don't exist yet on the MAIDERES side, corresponding to the DB gap already noted in `02-DATABASE-MAPPING.md`:

- Public/self-service **provider listing management** (`offres`, `promotions`, `realisations`) — no MAIDERES equivalent today; `apps/api`'s `prestataires` route only manages the provider record itself, not per-service listings.
- Public **provider directory search** (by ville/quartier/catégorie) for anonymous visitors — `apps/api`'s `GET /prestataires` requires auth (`authMiddleware` is global); connect's landing/directory pages are unauthenticated.
- A **client-facing request creation/tracking flow** — `POST /demandes` and `GET /demandes/:id` already exist and are role-gated correctly for a client to use, so this is mostly a frontend rewiring job, not a new endpoint.
- **Review submission tied to a completed intervention** — `POST /avis` already models this correctly (matching_id, not a raw provider id); connect's `avis` today attaches to a provider directly and would need reshaping to match.

## Update — gaps closed

- `apps/api` now exposes `offresRouter`/`promotionsRouter`/`realisationsRouter` (`/api/offres`, `/api/promotions`, `/api/realisations` — staff-or-owner, same pattern as `prestataires.ts`/`clients.ts`).
- The "public/unauthenticated read access" gap is closed via a new `publicRouter` mounted directly on `app` (not inside the auth-required `api` sub-app): `GET /api/public/prestataires`, `GET /api/public/prestataires/:id`, `GET /api/public/promotions`. Each explicitly re-applies the same visibility filter as the RLS policies (`statut='actif'`/`publie=true`/`active=true`) rather than relying on RLS alone, since this router still runs on the service-role client.
- `maidere-connect` has been rewired end-to-end onto these endpoints (`src/lib/maideres-api.ts`, `src/lib/maideres-core-client.ts`) — it no longer queries Supabase tables directly for prestataires/offres/promotions/realisations, only for Storage (gallery upload) and Auth.

## Classification

| Item | Classification |
|---|---|
| `apps/api` REST surface | **KEEP**, extend with the gaps above, eventually version under `/api/v1/` |
| `apps/shop`'s 4 OTP routes | **DEPRECATE** (redundant once maidere-connect + MAIDERES auth is unified, pending decision gate 2) |
| maidere-connect's direct-Supabase data access | **REPLACE** with calls to `apps/api` (or a thin `@maideres/api-client`), per master-prompt §25 |
| Public/unauthenticated read access to some MAIDERES routes | **CREATE** — `apps/api` currently requires auth globally; public provider directory browsing needs an explicitly-public path, decided deliberately (not by accident) |
