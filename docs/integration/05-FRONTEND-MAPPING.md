# 05 — Frontend Mapping

Three frontend surfaces exist across the two repos.

## apps/web (React/Vite) — back-office, KEEP

Fully functional staff console: Dashboard (KPIs), Demandes (queue + quick-create), Dispatch (matching board), Prestataires (directory/onboarding/status), Clients (directory + history), Interventions (kanban + SLA + check-in/out), Reversements (payouts), Account, Admin/RBAC settings. All business data flows through `apps/api`; a few direct-Supabase touches exist (auth, one stale `credits`-table probe left over from the deleted credit module, Realtime subscriptions used only to invalidate React Query caches). Has real tests (11 unit/component test files + a Playwright e2e spec) and a working operator-flow integration test. Two known pre-existing minor bugs: a dead-end "Sécurité" button linking to a nonexistent `/securite` route, and ~145 lines of dead legacy-ERP admin-tab code gated behind `{false && ...}`.

Not in scope for the front-office integration — this stays MAIDERES-internal staff tooling regardless of what happens with `apps/shop`/`maidere-connect`.

## apps/shop (Next.js 14) — intended vitrine, now redundant, DEPRECATE

Per the chosen direction (master-prompt logic: `maidere-connect` is the front-office), this app's role is superseded. Concretely, almost nothing here is worth carrying forward:
- Homepage: static "coming in Phase 4" placeholder, no real content.
- `/compte`, `/compte/login`: real, working phone-OTP auth flow — the one genuinely functional piece, but it duplicates a login concern `maidere-connect` will need to solve anyway (see `03-AUTH-MAPPING.md`) using a different, non-Supabase-Auth mechanism.
- `/suivi`, `/suivi/[ref]`: order-tracking UI that queries `commandes_shop`, a table deleted in the Phase 0 cleanup — broken end-to-end, always 404s.
- `/checkout/payment-options`: dead redirect to a `/commander` route that doesn't exist.
- `sitemap.ts`/`not-found.tsx`/`robots.ts` all reference other dead routes (`/catalogue`, `/devis`, `/commander`, `/paiement-en-cours`) and a nonexistent `produits_shop` table.
- No tests, and it bypasses `apps/api` entirely (talks to Supabase directly, including via a service-role client in its OTP routes).

**Recommendation for Phase 1 planning**: retire `apps/shop` rather than continue building it out, given `maidere-connect` already covers the same intent (landing page, provider directory, client/provider spaces) at a more complete UI stage. This needs explicit user sign-off before deletion (master-prompt §77: "do not remove... report" — this is a proposal, not an action taken in this phase).

## maidere-connect (TanStack Start) — the chosen front-office, KEEP + REWIRE

Already the more complete public UI:
- Public: landing page (with live matching/commission demo widgets), provider directory + profile pages, About/FAQ/Contact/Terms.
- Client space (`/espace/*`): dashboard, search, promotions, reviews, profile.
- Provider space (`/pro/*`): dashboard/stats, offers+promotions CRUD, gallery upload, review responses, profile.

Everything here currently reads/writes its own, separate Supabase project directly. Per `04-API-MAPPING.md`, rewiring this to consume the MAIDERES API instead of Supabase directly is the core of the frontend migration work (master-prompt §49/Phase 6), once auth and the data-model gaps (offres/promotions/realisations, public directory read access) are resolved.

Concrete rewiring touchpoints (file:line from the audit): every call in `src/lib/maideres-api.ts` and the per-route `supabase.from(...)` calls listed in the maidere-connect audit findings become HTTP calls to `apps/api` (or a shared `@maideres/api-client`) instead. `src/lib/maidere.ts`'s matching/commission/SLA logic should be deleted from this repo entirely once real `demandes` exist and the API's own commission/matching results (computed server-side, see `06-BUSINESS-LOGIC-MAPPING.md`) can be fetched instead — keeping it would violate master-prompt §29 ("the public frontend only displays the result").

No tests and no CI exist here today — this is a gap to close as part of the migration, not before (master-prompt §53–59 mandates tests be added as functionality is built/moved, not as a prerequisite that blocks starting).

## Cross-cutting frontend issues (see `07-DUPLICATES-AND-CONFLICTS.md` for full detail)

- Currency formatting reimplemented independently in `apps/web` (3×) and `maidere-connect` (1×, plus a CSS-level `' XAF'` suffix) — none shared.
- Business-entity types (`Prestataire`, `Client`, `Demande`) defined independently per app, never from a shared package — `packages/shared` exists but is unused for the marketplace domain (still ERP-shaped).
- Cameroon-only phone validation regex duplicated across `apps/shop` (2 places) with no equivalent validation in `apps/api` or `maidere-connect` at all.
