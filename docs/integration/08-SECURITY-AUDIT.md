# 08 — Security Audit

## Findings requiring action

### 1. Real-looking secret committed in `MAIDERES/.env.example` (medium-high priority)
`.env.example:9` — `SUPABASE_JWT_SECRET=t9zpNECJej8IMaoJMY4yIcSb8P9N4HQa9nKJ1nQGm5+JSl9u15mBPZb8sOs2kPoqb4ct7j/4dXapCuweVJDUOA==`. Every other line in this file uses an obvious placeholder (`xxxxxxxxxxxxxxxxxxxx`, `eyJ...votre_anon_key...`, `sk-ant-...`); this one is a real-shaped 64-byte base64 value. Git history shows it unchanged since the very first commit, carried through the FORGE→MAIDERES rename (it previously lived at `FORGE ENV/FORGE ENV/.env.example`).
**Action**: treat as a potentially real, previously valid secret. Rotate the actual Supabase project's JWT secret regardless of whether this exact value is still active, and replace this line with an obvious placeholder.

### 2. Service-role key baked into the `apps/desktop` Electron bundle (high priority if this app is ever shipped)
`apps/desktop/electron.vite.config.ts:38-45` uses Vite's `define` to inline `SUPABASE_SERVICE_ROLE_KEY` (loaded from a local `.env`) directly into the **main-process** bundle at build time; `apps/desktop/src/main/index.ts:62` forwards it to a forked child process running an embedded `apps/api`. If this app is ever built and distributed, the RLS-bypassing service-role key ships inside every installed copy, extractable by anyone with access to the installed binary. This is architecturally different from `apps/shop`, which only reads the service key from server-side Next.js env, never bundling it to a client artifact.
**Action**: since `apps/desktop` is frozen and (per `MAIDERES/CLAUDE.md`) not touched pre-MVP, no immediate code change is required, but this must be fixed before `apps/desktop` is ever built for distribution — flag it as a blocking pre-release item, not a "someday" cleanup.

### 3. `maidere-connect`'s `.env` is committed (low priority, but a process gap)
The file contains only a Supabase **publishable** key (`sb_publishable_...`), which is safe for client exposure by design (equivalent to the old `anon` key) — no `service_role`/`sb_secret_...` value is present. However, `.gitignore` does not exclude `.env` at all, meaning this was committed by omission rather than by a deliberate "this is safe to share" choice, and there's no guardrail preventing a future commit of a real secret into this same file.
**Action**: add `.env`/`.env.local` to `maidere-connect/.gitignore`, add a `.env.example` with placeholders, and remove the tracked `.env` from git (low urgency since nothing sensitive is in it today, but should happen before this repo is treated as more than a prototype).

## Structural observations (not bugs, but worth stating explicitly for Phase 1 design)

### RLS is real but currently decorative for API traffic
`apps/api` runs entirely as the Supabase service-role client (`packages/db/src/supabase-client.ts`), which bypasses RLS for every request. The RLS policies documented in `02-DATABASE-MAPPING.md`/Phase 1 report are correctly designed and would matter the moment any client talks to Supabase directly with a user-scoped token — but today, `apps/api`'s own TypeScript ownership checks (`identity.service.ts`) are the *actual* enforcement boundary for `apps/web`/`apps/shop` traffic. This matches master-prompt §18's "all three layers must agree" requirement only partially: the frontend-guard and API-authorization layers exist and agree; the RLS layer, while present and correctly written, isn't currently exercised in this flow. This becomes directly relevant once `maidere-connect` (which *does* talk to Supabase directly from the browser) is repointed at the MAIDERES project — at that point RLS stops being decorative and starts being the primary defense for that traffic path, so it needs to be verified against real authenticated requests before that cutover (master-prompt §56: RLS tests against a real Supabase test project).

### Two overlapping authorization systems in apps/api
Already covered in `07-DUPLICATES-AND-CONFLICTS.md` — not a vulnerability by itself (both paths deny-by-default), but it's easy for a new route to be added using only the weaker/coarser check and forget the finer-grained one exists, or vice versa. Worth consolidating in Phase 1+, not urgent.

### `maidere-connect`'s dormant `admin` role
The `app_role` enum includes `admin`, and `has_role()` exists server-side, but zero application code anywhere checks for or grants it. Not currently exploitable (nothing grants it, so no user can have it without a direct DB write), but it's an unenforced privilege tier sitting in a schema that will need real definition once this repo is merged into a platform that has actual staff/admin concepts (MAIDERES's `admin/superviseur/operateur`).

### `maidere-connect`'s route guard doesn't separate client vs. provider sections
`_authenticated/route.tsx` checks only "is logged in," not role-appropriate section access — a `client`-role account can navigate to `/pro/*` URLs. Actual data mutation would still be constrained by RLS ownership policies (not independently re-verified live in this audit), but the UI-level exposure (seeing a provider dashboard shell, attempting actions that would then fail server-side) is sloppy and worth tightening regardless of the broader merge.

### Rate limiting has an unsafe fallback
`apps/api/src/middleware/rateLimit.ts` uses Upstash Redis when configured, but falls back to an **in-memory Map** (explicitly logged as "unsafe for multi-instance") if `UPSTASH_REDIS_REST_URL/TOKEN` are unset. Worth confirming these env vars are actually set in every deployed environment (Railway, per `railway.json`) rather than silently running on the unsafe fallback in production.

### No CORS/rate-limiting posture exists for maidere-connect (N/A today, relevant after Phase 6)
Since `maidere-connect` has no backend of its own, CORS/rate-limiting only becomes relevant once it starts calling `apps/api` — at that point, `apps/api`'s CORS allowlist (master-prompt §66) needs to explicitly include connect's production/staging/local origins, which it presumably does not today (not independently verified — `apps/api`'s CORS config was not in scope of the backend audit's read list; worth checking in Phase 1).

## What was checked and found clean

- No hardcoded `service_role` key values (only `process.env` reads) outside the `apps/desktop` build-time-inlining case above.
- No other API keys/secrets (`sk-ant-`, `sk_live`, `pk_live`, `AIzaSy`, `ghp_`, `xoxb-`, PEM keys) found in tracked source in either repo.
- No bare `.env` was ever committed to `MAIDERES` (only `.env.example`, correctly gitignored going forward).
- Commission/SLA/audit-log integrity is structurally enforced at the DB trigger level in MAIDERES (client input can't override calculated commission, append-only audit tables have no UPDATE/DELETE policy even for admin).
