# 03 — Authentication & Authorization Mapping

## Three systems today

### 1. MAIDERES core (apps/web + apps/api)
- `apps/web` authenticates via Supabase Auth `signInWithPassword` directly against the MAIDERES Supabase project (`src/context/AuthContext.tsx`).
- The resulting JWT is sent as `Authorization: Bearer` to `apps/api`, which verifies it itself (`apps/api/src/middleware/auth.ts`) — HS256 via `SUPABASE_JWT_SECRET`, or ES256/RS256 via that same project's JWKS endpoint (cached 1h). No Supabase SDK call happens on the API side; it's pure JWT verification.
- Role of record: `profiles.role` enum = `admin | superviseur | operateur | apprenant`.
- **Enum drift across layers** (see `07-DUPLICATES-AND-CONFLICTS.md` for detail): `apps/api`'s own `types.ts`/`auth.ts` and `packages/shared`'s Zod schema each define slightly different role vocabularies (`technicien`, `livreur`, legacy aliases `directeur`/`viewer`) that don't match the DB enum. `apprenant` — the actual value used for prestataire/client seed accounts — gets silently remapped to `'technicien'` by the API's JWT middleware. This is an internal-to-MAIDERES bug worth fixing regardless of the connect-repo integration.
- Two parallel **authorization** mechanisms coexist in `apps/api`: coarse `requireRole()` against `profiles.role` (used by almost all business routes) and fine-grained `requirePermission()` against a full RBAC schema (`rbac_roles`/`rbac_permissions`/`rbac_user_profiles`, used mainly by `/admin/*`). Ownership (is this user "the" prestataire/client on this record) is resolved a third way, in `identity.service.ts`, by checking whether a `prestataires`/`clients` row's `profile_id` matches — because `apps/api` runs as Supabase service-role and therefore bypasses RLS, this TS-level check is the *actual* enforcement, not a defense-in-depth layer on top of RLS.

### 2. apps/shop's bespoke phone-OTP system
- Entirely separate: `otp_sessions` + `clients_shop` tables, custom 6-digit OTP via Africa's Talking SMS, a hand-rolled JWT (`jose`, HS256, 30-day TTL) in an httpOnly cookie `maideres-shop-token`.
- Not connected to Supabase Auth, not connected to `profiles.role`, not connected to `apps/api`'s JWT verification at all.
- Cameroon-only phone validation (`/^(\+?237\s?)?6\d{8}$/`), duplicated between the API route and the client component.

### 3. maidere-connect's Supabase Auth
- Email+password against its **own, separate** Supabase project (`apwklqvazttnnppdymmu`).
- Role model: `app_role` enum (`client | prestataire | admin`) in a `user_roles` table, populated by a `handle_new_user()` Postgres trigger reading `role` out of `signUp`'s `user_metadata` (i.e., the client picks its own role at signup time, validated only by which of two near-identical signup pages it used — `/auth/client` vs `/auth/prestataire`).
- `admin` is defined in the schema/enum but **entirely unused** in application code — no admin UI, no route or component ever checks for it. A dormant, unenforced privilege tier.
- The authenticated-route guard (`_authenticated/route.tsx`) checks only "is logged in," not "does this role match this section" — nothing stops a `client`-role account from navigating straight to `/pro/*` URLs at the routing layer (actual data access would still be constrained by that project's RLS policies, which were not independently re-verified in this audit beyond reading the migration file).

## Why these cannot be silently merged

- Three different user identity spaces (two different Supabase Auth projects + one bespoke JWT system) mean the *same phone number or email* could exist as three unrelated accounts with three unrelated histories today. Unifying requires an explicit choice of canonical identity store and a real migration/reconciliation pass — not a code change alone (§75 failure condition, see `00-INTEGRATION-AUDIT.md` decision gate 2).
- Role vocabularies don't line up: `admin/superviseur/operateur/apprenant` (MAIDERES) vs `client/prestataire/admin` (connect). MAIDERES's model separates "staff role" from "is this person a client/provider" (derived from the existence of a `clients`/`prestataires` row, not a role value) — connect's model conflates them into one `role` enum. The MAIDERES approach is the one already documented as an explicit design decision in `PHASE-1-REPORT.md` and is the more extensible of the two; adopting connect's simpler model would be a step backward for the staff side (admin/superviseur/operateur/audit already has real RBAC built on top of it).

## Recommendation surface (not a decision — for Phase 1 planning)

- Canonical identity: MAIDERES's Supabase project + `profiles`/derived-role model (matches master prompt §17/§19).
- `maidere-connect` needs to stop authenticating against its own Supabase project and instead either (a) point its Supabase client at the MAIDERES project directly (simplest, keeps using `supabase-js` client-side), or (b) go through a thin auth API on `apps/api` (more aligned with master-prompt §25's "centralize API access" but more work). Needs an explicit choice in Phase 1, informed by whether direct-Supabase-Auth-from-two-frontends is acceptable long-term (master prompt §17 says "use ONE authentication system," which is compatible with multiple frontends sharing one Supabase Auth instance directly — the objection is to a *second, independent* auth backend, which is what exists today).
- `apps/shop`'s OTP system is likely moot once `apps/shop` is deprecated in favor of `maidere-connect` (per the chosen direction) — but phone-OTP as a login *method* (as opposed to email+password) may still be product-desired for `maidere-connect`; that's a product call, not inferred here.
