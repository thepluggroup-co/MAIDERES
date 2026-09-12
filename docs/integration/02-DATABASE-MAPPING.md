# 02 — Database Mapping

Two separate Postgres/Supabase projects exist. Neither has been touched by this audit (read-only).

- **MAIDERES core**: project referenced by `MAIDERES/.env` (not committed; URL/keys unknown to this audit). Schema: `packages/db/src/schema.pg.ts` + `packages/db/drizzle/*.sql` (24 migrations as of Phase 2).
- **maidere-connect**: project `apwklqvazttnnppdymmu` (`maidere-connect/supabase/config.toml`). Schema: 1 initial migration (207 lines) + 2 small follow-ups, all dated `20260827`.

## Table-by-table comparison

| Concept | MAIDERES table | maidere-connect table | Compatible? |
|---|---|---|---|
| Auth-linked profile | `profiles` (id=auth uid, email, nom, **role** enum admin/superviseur/operateur/apprenant, telephone, adresse, avatar_url, actif) | `profiles` (own shape, simpler) + separate `user_roles` (role enum client/prestataire/admin) | **No** — different role vocabularies, role stored in a separate table on the connect side. |
| Service provider | `prestataires` (profile_id, nom, telephone, `categories uuid[]`, quartier, geoloc_lat/lng, **statut** enum, note_moyenne, **taux_commission** nullable override, date_recrutement) | `prestataires` (own columns incl. `ville TEXT DEFAULT 'Douala'`, metier, no commission column, no geoloc) | **No** — connect side has no commission/geoloc/multi-category array; adds `ville`/`metier`/`offres` concept MAIDERES doesn't have. |
| Provider's offerings | *(none — MAIDERES ties prestataires to `categories_services` directly)* | `offres` (per-provider service listing) | New concept not modeled in MAIDERES core. |
| Promotions | *(none)* | `promotions` | New concept not modeled in MAIDERES core. |
| Portfolio/gallery | *(none)* | `realisations` (photos via Storage) | New concept not modeled in MAIDERES core. |
| Client | `clients` (profile_id, nom, telephone, quartier, type_client enum, niu, whatsapp, email, source) | *(no dedicated `clients` table — a Supabase Auth user with role=client in `user_roles`, `profiles` row only)* | **No** — MAIDERES models clients as a distinct business entity (with a tax ID field for entreprise clients); connect does not. |
| Service request | `demandes` (client_id, categorie_id, description, localisation, canal, statut, niveau_urgence, delai_cible) | *(does not exist)* | Not present on connect side at all — the entire "create a request" flow is missing there; `StatutDemande` types exist in `src/lib/maidere.ts` but are unused/demo-only. |
| Matching | `matchings` (demande_id, prestataire_id, operateur_id, statut, motif_echec) | *(does not exist)* | Not present. |
| Intervention | `interventions` + `intervention_evenements` | *(does not exist)* | Not present. |
| Category | `categories_services` (libelle, actif) | *(implicit — `CATEGORIES` constant array in `maideres-api.ts`, not a DB table)* | **No** — connect hardcodes categories in frontend code, not DB-driven. |
| Review | `avis` (matching_id, note 1-5, commentaire) | `avis` (own shape, presumably tied to `prestataires`/providers directly, not to a matching/intervention) | Same name, different foreign-key shape — **not compatible as-is**. |
| Transaction/payment | `transactions` (matching_id, montant_service, commission_taux/montant [trigger-set], statut_paiement, ref_notchpay) | *(does not exist)* | Not present — no payment integration in connect at all. |
| Commission config | `commission_config` (categorie_id nullable, type, valeur) | *(does not exist — commission logic hardcoded as `COMMISSION_GLOBALE_PCT = 15` in `src/lib/maidere.ts`)* | Not present as data; hardcoded constant instead. |
| Payout | `reversements` | *(does not exist)* | Not present. |
| SLA config | `sla_config` | *(does not exist — SLA tiers hardcoded as `URGENCES` constant in `src/lib/maidere.ts`)* | Not present as data. |
| Notification log | `notifications_log` | *(does not exist)* | Not present. |
| Audit | `audit_log` + full `rbac_*` audit tables | *(does not exist)* | Not present. |

## Reading this table

`maidere-connect`'s schema is not a subset or superset of MAIDERES's — it's a **different, smaller, self-consistent model** built for a simpler "provider lists services, client browses and reviews" product, with no request/matching/intervention/payment lifecycle at all. MAIDERES's schema is the far more complete, lifecycle-aware model (this is expected — it's Phase 1–3 of real work vs. a Lovable-generated prototype).

`offres`/`promotions`/`realisations` are the one genuinely new idea on the connect side worth carrying forward: a provider's self-service "my listed services + photos + promotions" management, which MAIDERES core has no equivalent for today (MAIDERES only tracks `prestataires.categories` as a raw array, not individually manageable listings).

## Classification (per master-prompt §4 taxonomy)

| Component | Classification | Notes |
|---|---|---|
| MAIDERES `packages/db` schema | **KEEP** | Canonical going forward, per decision gate 1 pending confirmation. |
| maidere-connect `profiles`/`user_roles` | **REPLACE** | Superseded by MAIDERES `profiles` + role model, once auth is unified. |
| maidere-connect `prestataires` | **MERGE** | Useful columns (`ville`, `metier`) worth folding into MAIDERES's richer `prestataires`, rest replaced. |
| maidere-connect `offres`/`promotions`/`realisations` | **CREATE** (in MAIDERES) | New tables to add to MAIDERES core so the connect UI has something real to read from — these don't exist yet on the MAIDERES side and represent real, wanted functionality. |
| maidere-connect `avis` | **REPLACE** | MAIDERES's `avis` (tied to a completed `matching`) is the correct model once requests exist; connect's provider-direct review has no request to anchor to. |
| maidere-connect Supabase project itself | **DEPRECATE** (pending decision gate 1) | Only after confirming it holds no real user data worth migrating. |

## Update — offres/promotions/realisations built (migrations 0027/0028)

Per the decision to make MAIDERES's Supabase project the single source of truth (§ decision gate 1, resolved: `maidere-connect`'s own project was confirmed disposable, no real data), the three tables this doc flagged as new concepts have been added to MAIDERES core:

- `prestataires` gained self-service columns: `ville`, `metier` (free-text, distinct from the `categories` uuid[] used by staff matching/dispatch), `bio`, `disponible`, `zones_couverture`.
- New tables `offres`, `promotions`, `realisations` (all FK'd to `prestataires.id`, `ON DELETE CASCADE`).
- Public visibility is governed entirely by `prestataires.statut = 'actif'` (staff-approved) — there is no separate self-declared "published" flag at the prestataire level, unlike connect's original `publie`/`verifie` columns (dropped rather than carried over, since they'd have let a prestataire bypass staff approval).
- New RLS policies (`packages/db/drizzle/0028_offres_promotions_realisations_rls.sql`) mirror the exact same public-visibility filter for any future direct-Supabase access, plus a `maideres` Storage bucket (public read, owner-only write) for the gallery.
- New public, unauthenticated read endpoints exist at `/api/public/*` (see `04-API-MAPPING.md`).

`avis` remains unreconciled (see `06-BUSINESS-LOGIC-MAPPING.md`) — connect's review pages are intentionally left non-functional pending the demande/matching self-service flow.

## Not yet knowable from static code

- Actual row counts in either project (needs live DB access — not available in this audit environment, consistent with the Phase 1 report's own note that no live Supabase project was reachable then either).
- Whether `apwklqvazttnnppdymmu` has any real signed-up users. **This must be checked before any deprecation/migration action** (§71: source_count/target_count/missing/duplicates must be reported from the real databases, never fabricated).
