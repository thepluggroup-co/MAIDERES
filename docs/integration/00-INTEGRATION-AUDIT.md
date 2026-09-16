# 00 — Integration Audit (Phase 0 Discovery)

Date: 2026-09-06
Scope: `MAIDERES/` (pnpm/turbo monorepo: apps/api, apps/web, apps/shop, apps/mobile [frozen], apps/desktop [frozen]; packages/db, shared, ai, ui) and `maidere-connect/` (standalone Lovable/TanStack Start app, own Supabase project).
Method: full read-only inspection of both repos (schema, migrations, RLS, API routes, auth code, frontend routes/hooks, git history, CI config). No code was modified in this phase.

## How to read this audit

Each doc below (01–08) covers one dimension. This doc is the executive summary and the two decision gates that must be resolved by the product/engineering owner before any Phase 1+ work (contracts, schema unification, API normalization) begins.

## Executive summary

The two repos are **not two surfaces of one platform today** — they are two independent, non-communicating implementations of overlapping ideas, each with its own Supabase project, its own schema, its own auth, and its own (differently named) business entities:

- **`MAIDERES`** is a real, working monorepo. `apps/api` is a genuine REST API with RLS-aware design, RBAC, audit logging, and integration tests against a real Supabase project. `apps/web` (back-office console) is fully functional and wired to that API. `apps/shop` (the intended public vitrine, per `MAIDERES/CLAUDE.md`) is mostly placeholder/dead code — only its phone-OTP login works end-to-end; its order-tracking pages query a table (`commandes_shop`) that no longer exists after the Phase 0 cleanup documented in `PHASE-0-REPORT.md`.
- **`maidere-connect`** is a separate, more visually complete public front-office (landing page, provider directory, client space, provider space) built by Lovable against **its own, different Supabase project** (`project_id = apwklqvazttnnppdymmu`), with its own schema (`profiles`, `user_roles`, `prestataires`, `offres`, `promotions`, `realisations`, `avis` — no `demandes`, no `matchings`, no `interventions`, no `transactions`). It has zero backend API of its own — every read/write goes straight to Supabase from the browser or from Next-less server functions. Its own business-logic file (`src/lib/maidere.ts`) is a self-contained reimplementation of MAIDERES's matching/commission/SLA logic, explicitly commented as "adapted from the MAIDERES console" — but it is demo-only: no `demandes` table exists to drive it, so it only powers two interactive marketing widgets on the landing page.

This means the master prompt's non-negotiable principle (§2: "There must be one authoritative business data model") is currently **violated in production-adjacent code**, not just in documentation. See the two decision gates below before proceeding.

## Decision gate 1 — two Supabase projects (§75 failure condition: "two incompatible production databases")

- `MAIDERES` core (`apps/api`, `apps/web`, `apps/shop`) targets one Supabase project (URL/keys read from its own `.env`, not committed).
- `maidere-connect` targets a **different** Supabase project: `apwklqvazttnnppdymmu` (`maidere-connect/supabase/config.toml`), with its own `profiles`/`prestataires`/`avis` tables that are shaped differently from MAIDERES's tables of the same name (see `02-DATABASE-MAPPING.md`).
- **Unknown and must be answered before Phase 1**: is `apwklqvazttnnppdymmu` a live project with real signed-up users/providers, or a disposable Lovable preview/dev project with no real data? The answer changes everything — if it has real users, this is a genuine data-migration problem (§71–72: count rows, map, validate, no silent loss); if it's a throwaway preview, `maidere-connect`'s Supabase project can simply be retired once its UI is repointed at the MAIDERES API.
- Per §75, this is exactly the condition that should halt automatic proceeding: **do not merge or migrate data between these two projects without an explicit answer to the question above.**

## Decision gate 2 — three coexisting authentication systems (§75 failure condition: "authentication systems cannot safely be unified")

1. **MAIDERES Supabase Auth** — `apps/web` authenticates directly against the MAIDERES Supabase project (`signInWithPassword`), JWT consumed by `apps/api` (HS256/JWKS verification against `SUPABASE_JWT_SECRET`/JWKS of that same project). Role carried in `profiles.role` (`admin|superviseur|operateur|apprenant`).
2. **`apps/shop`'s bespoke phone-OTP + JWT system** — not Supabase Auth at all: custom `otp_sessions`/`clients_shop` tables, home-rolled JWT (`jose`, HS256) in an httpOnly cookie. Independent of `profiles.role` entirely.
3. **`maidere-connect`'s Supabase Auth** — email+password against the *other* Supabase project, with its own `app_role` enum (`client|prestataire|admin`) and `user_roles` table.

None of these three share a user store today. A person who signs up as a client on `maidere-connect` does not exist as a user anywhere in the MAIDERES core, and vice versa. Per §17/§75, unifying these requires a deliberate, explicit migration plan (whose Supabase project becomes canonical, how existing accounts in the non-canonical project are migrated or invalidated) — **this is a product decision, not something to infer from code**.

## What did NOT trigger a stop condition

- No exposed `SUPABASE_SERVICE_ROLE_KEY` value was found hardcoded in either repo's tracked source (see `08-SECURITY-AUDIT.md` for the two real secret-hygiene findings that were found — a stale-but-real-looking JWT secret in `MAIDERES/.env.example`, and the service-role key being baked into the frozen `apps/desktop` Electron bundle at build time).
- No destructive migration risk was found — `MAIDERES`'s migrations are additive/idempotent so far; nothing has yet attempted to touch `maidere-connect`'s database.
- No uncommitted user work was found in either repo (`git status` clean in both, on branches `integration/maideres-connect-v2` and `integration/connect-maideres-v2` respectively — someone already started the Master-Prompt-recommended branch naming in a prior session).

## Integration Readiness Score (0–100)

| Dimension | Score | Why |
|---|---|---|
| Architecture | 25 | Two independent stacks with no shared contracts; `apps/shop` (in-repo) and `maidere-connect` (separate repo) both claim the "public front-office" role and neither is finished — direction has to be picked (see conversation-level decision already made: master prompt logic wins, `maidere-connect` is the front-office). |
| Database | 20 | Two live-shaped Supabase projects, overlapping but incompatible table names (`prestataires`, `profiles`, `avis` mean different things in each). No mapping/migration exists yet. |
| Authentication | 25 | Three non-unified auth systems (see gate 2). MAIDERES side is coherent internally; `maidere-connect` and `apps/shop` are both extra, separate systems. |
| API | 40 | MAIDERES has one real, versioned-in-spirit (though not `/api/v1/`-prefixed) REST API with RBAC and audit logging. `maidere-connect` has zero API — it will need a client rewrite to consume MAIDERES's API instead of Supabase directly. |
| Security | 55 | RLS, RBAC, audit logging, and immutable-rule guards are genuinely well built on the MAIDERES side. Two concrete hygiene issues found (rotate one secret, stop baking service key into desktop bundle) plus RLS being bypassed by the API's service-role client (by design, mitigated by TS-level identity checks). |
| Frontend | 45 | `apps/web` is solid and functional. `maidere-connect` is the more complete public UI (landing, directory, client/provider spaces) but talks to the wrong database. `apps/shop` is largely placeholder/dead and is now redundant with `maidere-connect` under the chosen direction. |
| Business logic | 30 | Real, DB-enforced commission/SLA/matching logic exists once (triggers + SQL functions) in MAIDERES — good. But it is also reimplemented, independently and partially, in `apps/web` (3× duplicated helpers) and in `maidere-connect` (`src/lib/maidere.ts`, demo-only, disconnected from real data). |
| Testing | 55 | MAIDERES has real unit, RBAC, and Supabase-integration tests (`apps/api`, `packages/db`) and a Vitest+RTL operator-flow test in `apps/web`. `maidere-connect` has **zero tests** and no CI at all. |
| DevOps | 45 | MAIDERES has CI (lint/typecheck/test/build) and deploy workflows (Railway/Vercel). `maidere-connect` has no CI/CD; deployment is Lovable-platform-only. |
| Documentation | 35 | MAIDERES has a current `CLAUDE.md` and detailed phase reports (0–3) — good project memory, but they describe a plan (apps/shop as vitrine) that the user has now overridden in favor of the master-prompt direction. `maidere-connect`'s only doc (`README.md`) misdescribes its own shipped product (says Côte d'Ivoire/XOF-only; code targets Cameroon+Côte d'Ivoire, three cities). |

**Overall: ~38/100.** Both codebases are individually reasonably healthy; the gap is entirely in the *seam* between them — nothing today makes them behave as one platform.

## Documents in this set

- `01-ARCHITECTURE-CURRENT.md` — current-state architecture of both repos.
- `02-DATABASE-MAPPING.md` — full schema comparison, table-by-table.
- `03-AUTH-MAPPING.md` — the three auth systems in detail.
- `04-API-MAPPING.md` — MAIDERES API surface; `maidere-connect`'s lack thereof.
- `05-FRONTEND-MAPPING.md` — all three frontend surfaces (`apps/web`, `apps/shop`, `maidere-connect`).
- `06-BUSINESS-LOGIC-MAPPING.md` — matching/commission/SLA logic, where it lives, where it's duplicated.
- `07-DUPLICATES-AND-CONFLICTS.md` — enum drift, duplicated types, duplicated formatters, dead code.
- `08-SECURITY-AUDIT.md` — secrets, RLS posture, auth gaps, concrete remediation items.

Per the master prompt's Phase 0 rule, this set stops here — no `09-MIGRATION-PLAN.md`/`10-TARGET-ARCHITECTURE.md`/`11-ACCEPTANCE-TESTS.md` yet, and no code changes. Phase 1 (target architecture) should not start until decision gates 1 and 2 above have an answer.
