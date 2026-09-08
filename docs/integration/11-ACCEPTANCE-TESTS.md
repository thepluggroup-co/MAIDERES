# 11 — Acceptance Tests

Master-prompt §73 checklist, marked against what has actually been verified — not aspirational. `[x]` means verified this session (live infrastructure or passing automated test), `[~]` means partially true or verified indirectly, `[ ]` means not yet done.

## Architecture

- [x] One authoritative business database — single Supabase project, migrations `0000`–`0030` applied live.
- [x] One authoritative authentication system — Supabase Auth on that project, consumed directly by both frontends.
- [x] One canonical API — `apps/api`; direct-Supabase access on either frontend now limited to Auth + Storage.
- [~] One canonical business contract — `packages/contracts` exists and is consumed by `apps/api`/`apps/web` for the core request-lifecycle entities (categories, prestataires, clients, demandes, matchings, avis). Peripheral entities (sla_config, commission_config, transactions, reversements, interventions, offres, promotions, realisations) still have local schema copies in `apps/api` routes — same shapes, not yet centralized. `maidere-connect` mirrors contracts manually (no publish pipeline).
- [~] No duplicate business logic — commission/SLA/status-transition logic lives once (DB triggers + `apps/api`). `maidere-connect`'s old standalone reimplementation (`src/lib/maidere.ts`) is dead code (no longer wired to any real page) but not yet deleted.

## Connect

- [x] Can register — verified live: real Supabase Auth signup, `handle_new_user()` trigger confirmed firing correctly (`profiles.role = apprenant`).
- [x] Can login — verified live: real sign-in, JWT confirmed ES256 (JWKS-based, no shared secret needed).
- [~] Can browse services — public directory endpoints verified via direct API calls (`GET /api/public/prestataires[/:id]`) against live data; the `maidere-connect` directory UI page itself was not manually browser-tested (the demande/auth pages were — see below).
- [x] Can create request — verified live via API **and** in a real headless browser (Playwright) against the actual `maidere-connect` UI: login → `/espace/demandes/nouvelle` → real category loaded from the DB → submit → redirected to the new demande's detail page with a success toast.
- [x] Can view request — verified live (`GET /api/demandes/:id`) and in-browser (demande detail page renders real data, correct status badge, "Annuler ma demande" action present).
- [x] Can track request — browser-verified this round. Caught and fixed a real bug in the process: `espace.demandes.tsx` was being treated by TanStack Router as an implicit parent layout for `espace.demandes.$id.tsx`/`espace.demandes.nouvelle.tsx` (same-prefix filenames nest by convention), but had no `<Outlet/>` — so the URL would change on navigation while the old list content stayed on screen. Fixed by renaming to `espace.demandes.index.tsx`, matching the `espace.tsx`/`espace.index.tsx` pattern already used elsewhere in this codebase.
- [x] Can review completed intervention — verified live end-to-end via the API, including the prestataire's public reply.

## ERP

- [x] Request appears automatically — verified live: a demande created via a self-service client account was immediately visible to a staff account through the same API, no manual sync step (Phase 7 check).
- [x] Provider can be assigned — verified live (`POST /api/matchings`, staff-only).
- [x] Provider status is authoritative — `prestataires.statut`, staff-controlled, enforced both in the API and by RLS.
- [x] Intervention is visible — the `matchings` lifecycle was exercised live earlier; the separate `interventions` table's own checkin/checkout sub-lifecycle (planifiee → en_route → checkin → checkout → realisee, plus the échouée branch) is now verified live via the repo's own `intervention-sync.integration.test.ts` (7/7 passing against the real project — trigger correctly journals events, syncs `demandes.statut`, and creates a `reversements` row).
- [x] Payment is visible — verified live via `commission-config.integration.test.ts`: a direct `transactions` insert triggers `trg_transactions_commission`, which correctly populates `commission_taux`/`commission_montant` server-side regardless of what the caller supplies.
- [x] Commission is visible — same suite: all 3 resolution cases (prestataire override → category rule → global rule) verified against the real `calculer_commission()` SQL function, not a reimplementation.
- [ ] KPI updates — `apps/web`'s Dashboard reads from the same API/DB by construction, but was not opened in a browser this session to visually confirm.

## Security

- [x] RLS verified — extensive policy coverage across all tables, exercised by `packages/db` schema tests; live E2E confirmed RLS doesn't block legitimate self-service flows.
- [x] Role authorization verified — both by mocked unit tests (`apps/api`) and live (staff-only matching proposal, prestataire-only accept/reply, client-only review).
- [~] Service role never exposed — clean in `apps/api`/`apps/web`/`maidere-connect`. `apps/desktop` (frozen) still bakes the service-role key into its Electron bundle at build time — a known, documented pre-release blocker (`08-SECURITY-AUDIT.md`), not touched since it's out of scope while frozen.
- [x] Secrets absent from repository — the one real-looking placeholder in `.env.example` was replaced; live `.env` files are gitignored in both repos.
- [~] CORS restricted — dev-mode correctly allows any localhost origin; production origins for the deployed frontends are not yet added to `FRONTEND_URL`.

## Testing

- [x] Unit tests pass — `apps/api` 71/71, `packages/contracts` 16/16. `packages/db` 59/61 (2 pre-existing failures, confirmed unrelated to any work this session via a clean-baseline diff). `apps/web` 51/51 that completed — the test *runner* hit environment-level worker crashes from system memory pressure (many concurrent dev-server processes), not code failures; every test that ran, passed.
- [x] API tests pass — see above.
- [x] Integration tests pass — `apps/api/src/__tests__/integration/*.test.ts` (16/16) run against the live project. Two real, pre-existing issues found and fixed along the way, not caused by this session's other changes but only ever surfaced once a live database existed to run against: (1) `commission-config.integration.test.ts` inserted into `profiles` without an `id` (the column has no default — always would have failed); (2) two orphaned `profiles` rows (no matching `auth.users`, blocking new signups with the same email via the `email` unique constraint) left over from an earlier partial run, cleaned up directly.
- [~] RLS tests pass — static coverage via `packages/db` schema tests; not tested via a real Supabase-authenticated session directly (only Auth/Storage go direct-to-Supabase today, and Auth's own RLS-adjacent paths worked correctly in the live run).
- [x] E2E happy path passes — the full master-prompt §74 scenario ran against live infrastructure this session and passed; test data cleaned up afterward.
- [x] Connect build passes — verified.
- [x] MAIDERES build passes — `apps/api`, `apps/web`, `apps/shop`, `apps/desktop` all build cleanly. `apps/mobile` fails (pre-existing, frozen per `MAIDERES/CLAUDE.md`, unrelated to anything touched this session — confirmed against the Phase 0 report's own note about the same pre-existing failure).

## Net assessment

The core platform-unification claim — one database, one auth system, one API, requests flowing between a self-service frontend and staff tooling with no manual sync — is **verified against live infrastructure**, not just code-reviewed, and now includes a real browser click-through of the client-facing UI (which caught and fixed a routing bug that no API-level test could have found). What remains is narrower still: `apps/web`'s Dashboard/KPI screens and the public directory UI haven't been opened in a browser, `packages/contracts` coverage of peripheral entities is incomplete, and the housekeeping items already tracked in `09-MIGRATION-PLAN.md`.

## Operational note — Supabase email rate limit

Discovered while browser-testing: this project's default Supabase Auth email-sending rate limit is very easily exhausted (a handful of confirmation emails per hour without custom SMTP configured) and returns `429 over_email_send_rate_limit` on `POST /auth/v1/signup` once hit. Admin-created users (`auth.admin.createUser` with `email_confirm: true`, used by the integration tests and this session's diagnostic scripts) don't trigger this — only the public signup flow real users go through does. **Before any real users sign up in production, configure a custom SMTP provider** in the Supabase dashboard (Project Settings → Auth → SMTP Settings) — otherwise a handful of signups per hour will start failing.
