# 07 — Duplicates and Conflicts

## Role/enum drift (MAIDERES-internal, exists independently of the connect-repo question)

Four different vocabularies for "what role can this user have" exist simultaneously:

| Source | Values |
|---|---|
| DB truth (`packages/db/src/schema.pg.ts:19`) | `admin \| superviseur \| operateur \| apprenant` |
| `apps/api/src/types.ts` / `middleware/auth.ts` `ROLE_MAP` | `admin \| superviseur \| operateur \| technicien \| livreur` + legacy aliases `directeur→admin`, `apprenant→technicien`, `viewer→technicien` |
| `packages/shared/src/types.ts` (`UserRoleSchema`) | `admin \| superviseur \| operateur \| technicien` (no `apprenant` at all) |
| `maidere-connect`'s `app_role` | `client \| prestataire \| admin` (a completely different axis — staff-vs-not rather than a job-title enum) |

Concretely, a JWT carrying `apprenant` (the actual value used for prestataire/client seed accounts) gets silently remapped to `'technicien'` by `apps/api`'s auth middleware, while the DB still stores `apprenant` — these two enums have already drifted from each other **inside MAIDERES alone**, independent of the connect-repo merge. Worth fixing regardless of integration timing.

## Two parallel authorization systems in apps/api

`requireRole()` (coarse, against `profiles.role`) and `requirePermission()` (fine-grained RBAC against `rbac_user_profiles`/`rbac_role_permissions`) coexist. Almost all business routes (`prestataires`, `clients`, `demandes`, `matchings`, etc.) use the coarse path; only `/admin/*` uses full RBAC — despite the RBAC schema and seed data being fully built out. `PHASE-0-REPORT.md` already flagged this as an open item ("point en suspens").

## Duplicated business-entity types

No shared domain-type package is actually used for the demandes/prestataires/matching domain, despite `packages/shared` existing:
- `Demande`, `Prestataire`, `Client`, `Matching` are each defined independently inside individual `apps/web/src/hooks/*.ts` files rather than imported from `packages/shared`.
- `packages/shared/src/types.ts` still describes the **old ERP domain** (`Product`, `Order`, `priceXAF`) — unrelated to and unused by the actual marketplace entities.
- `maidere-connect` defines its own, third, incompatible `Prestataire` shape in two different files within itself (`maideres-api.ts` vs `maidere.ts` — one DB-shaped, one demo-shaped), plus its own `Client`-equivalent concept (`clients_shop`-style, but note: that's actually `apps/shop`, not `maidere-connect` — `maidere-connect` has no dedicated client entity at all, just an auth user with a role).

## Duplicated formatters and validators

- **Currency formatting**: at least 4 independent implementations — `apps/web/src/lib/utils.ts` (`formatXAF`, `Intl.NumberFormat('fr-CM')`), `apps/web/src/pages/Dashboard.tsx` and `Reversements.tsx` (each a local `xaf()` using `toLocaleString('fr-FR') + ' FCFA'`), and `maidere-connect/src/lib/maidere.ts` (`xof()`, hardcoded `' FCFA'` suffix, ignores the XAF/XOF distinction the same file otherwise tracks per-city).
- **Phone validation**: Cameroon-only regex `/^(\+?237\s?)?6\d{8}$/` duplicated verbatim between `apps/shop/app/api/auth/shop/demander-otp/route.ts` and `apps/shop/app/compte/login/LoginClient.tsx`. No phone validation exists at all in `apps/api` (free-text `.min(6).max(30)` only) or in `maidere-connect` (plain unvalidated text inputs).
- **SLA lateness (`enRetard`)**: reimplemented verbatim 3× across `apps/web` (`Dashboard.tsx`, `Demandes.tsx`, `Dispatch.tsx`).
- **Candidate/dispatch sorting**: `triDispatch`/`triPrioritaire`/`triCarte` — three near-identical "late-first, then urgency, then age" sort implementations across `Dispatch.tsx`/`Dashboard.tsx`/`Interventions.tsx`.

## Dead code

- `apps/web/src/pages/AdminSettings.tsx:391-535` — ~145 lines of legacy-ERP admin UI (Boutique/Production/Stocks/Fournisseurs/etc. tabs) gated behind `{false && ...}`, shipped in the bundle but never rendered.
- `apps/web/src/pages/Account.tsx:605` — button linking to a nonexistent `/securite` route.
- `apps/web/src/context/AuthContext.tsx:58` — a module-load-time probe query against a `credits` table deleted in Phase 0; fails silently every session (errors swallowed).
- `apps/shop`: `/checkout/payment-options` (dead redirect to nonexistent `/commander`), `/suivi/[ref]` (queries deleted `commandes_shop` table, always 404s), `sitemap.ts`/`not-found.tsx`/`robots.ts` (reference multiple dead routes and a nonexistent `produits_shop` table).
- `packages/shared/src/constants.ts` — `API_ROUTES` pointing at `/api/products`, `/api/orders`, `/api/production`, `/api/inventory`, none of which exist in `apps/api` post-Phase-0.
- `rbac_role_name` enum in the DB still contains dead ERP role values (`SUPER_ADMIN`'s siblings from "a reference project": `MANAGER`, `COMMERCIAL`, `CAISSIER`, `MAGASINIER`, `FORMATEUR`, `READONLY`) that were deleted from the `rbac_roles` table but can't be dropped from the Postgres enum type itself.
- `apps/desktop` — an entirely separate, unrelated legacy product still branded "FORGE by TAFDIL / TAFDIL SARL", with its own ERP schema (produits/commandes/devis/factures/employes/projets). Frozen, but worth flagging: it's not a stale reference, it's a live app that still bakes a service-role key into its build output (see `08-SECURITY-AUDIT.md`).

## Geography/currency (the originally-flagged product inconsistency, now precisely located)

MAIDERES core is internally **consistent**: every hardcoded reference across `packages/shared`, `packages/ai`, `apps/api`, `apps/web`, and seed data says Douala/Cameroon/XAF/+237, with no Côte d'Ivoire references anywhere in this repo.

The inconsistency lives entirely inside **`maidere-connect`**, and it's a code-vs-doc mismatch rather than the platform being genuinely undecided: its root `README.md` (the original Lovable generation prompt) says "Côte d'Ivoire / XOF" only, but the actual shipped code, DB defaults (`prestataires.ville DEFAULT 'Douala'`), and every user-facing page (landing, about, FAQ, ToS, footer) describe **three cities in two countries**: Douala + Yaoundé (Cameroun, XAF) and Abidjan (Côte d'Ivoire, XOF), with a hardcoded `QUARTIERS` lat/lng table covering neighborhoods in all three cities. `apps/shop`'s OTP phone validation is Cameroon-only, consistent with MAIDERES core, not with connect's tri-city scope.

**This needs a product decision** (master-prompt §5): is the merged platform Douala/Cameroon-only (matching MAIDERES core and `apps/shop`), or does it also serve Abidjan/Côte d'Ivoire (matching what `maidere-connect` actually ships)? Given the direction already chosen (connect becomes the front-office), and connect's code — not its stale README — represents the more recently maintained statement of scope, this audit surfaces the conflict but does not resolve it; it's a business-market question, not an engineering one. Recommended target regardless of the answer: implement the `PlatformConfig` (country/currency/timezone/locale/defaultCountryCode) master-prompt §5 already specifies, rather than hardcoding either answer.
