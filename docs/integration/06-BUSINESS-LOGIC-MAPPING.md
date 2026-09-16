# 06 — Business Logic Mapping

Per master-prompt §26/§29, authoritative business calculations belong server-side. Today the same three pieces of logic — **commission calculation**, **SLA/lateness computation**, and **provider matching/ranking** — exist in up to three places at once.

## Commission calculation

1. **Authoritative, DB-level** (MAIDERES): SQL function `calculer_commission(_montant, _categorie_id, _prestataire_id)` (`packages/db/drizzle/.../0011...sql`), invoked by a `BEFORE INSERT` trigger on `transactions` that overwrites any client-supplied `commission_montant`/`commission_taux` — structurally impossible to spoof from the API layer. Resolution order: prestataire-specific override (`prestataires.taux_commission`) → category rule (`commission_config`) → global default → 0. `apps/api`'s `commission.service.ts` is a thin RPC wrapper around this same SQL function (correctly not reimplemented in TS).
2. **Duplicated, display-only** (`apps/web`): `Prestataires.tsx`'s `useCommissionAffichee` re-derives the same override→category→global resolution client-side just to show a preview number, and `Dashboard.tsx`/`Reversements.tsx` each re-derive "net amount" by manually joining `reversements`→`interventions`→`matchings`→`transactions` and subtracting commission — the code comments acknowledge this is a workaround for aggregation, but it means the resolution *logic* itself is duplicated, not just the number displayed.
3. **Duplicated, disconnected** (`maidere-connect`): `src/lib/maidere.ts` hardcodes `COMMISSION_GLOBALE_PCT = 15` and reimplements the same override precedence (`calculerCommission()`/`reversement()`) — but there is no `commission_config` table on this side, no `transactions` table, and no real request to attach a commission to. It only powers a marketing "commission calculator" demo widget on the landing page.

## SLA / lateness

1. **Authoritative, DB-level**: `sla_config` table + `calculer_delai_cible()` SQL function + `BEFORE INSERT/UPDATE` trigger on `demandes` that computes `delai_cible` from urgency tier.
2. **Duplicated 3× verbatim in `apps/web`**: an `enRetard(d)` function comparing `delai_cible` to `Date.now()` is independently reimplemented in `Dashboard.tsx`, `Demandes.tsx`, and `Dispatch.tsx`; a fourth variant (`useSlaEtat`) in `Interventions.tsx` buckets into retard/alerte/ok using `sla_config.seuil_alerte_heures` fetched separately.
3. **Duplicated, disconnected in `maidere-connect`**: `src/lib/maidere.ts` hardcodes urgency tiers (`URGENCES`: immediate=2h/urgent=24h/planifie=72h) as constants rather than reading `sla_config` — again, demo-only since no `demandes` exist there.

## Provider matching / ranking

1. **Authoritative today**: matching itself is a *manual staff action* in MAIDERES (`POST /matchings` proposes a specific prestataire for a demande; there is no automated ranking endpoint in `apps/api`). Ranking/candidate-suggestion logic that *does* exist is entirely client-side (see below) — this is the one area where MAIDERES core itself doesn't yet have a server-side "suggest best providers" implementation, only the data (`prestataires.categories`, `quartier`, `geoloc_lat/lng`, `note_moyenne`) to build one from, consistent with `MAIDERES/CLAUDE.md`'s note that automated matching is a progressive goal, not yet built.
2. **`apps/web`**: `candidatsPertinents` (in both `Dispatch.tsx` and, near-identically, `DemandeDetail.tsx`) ranks by quartier match then rating — duplicated between two components, and this *is* the closest thing to "the matching algorithm" that currently runs anywhere, and it runs in the browser.
3. **`maidere-connect`**: `classerPrestataires()` in `src/lib/maidere.ts` is a materially more sophisticated version — category match + status + haversine-distance-from-quartier-lookup + zone coverage + rating, weighted and summed — but again, demo-only, feeding only the landing-page "see how matching works" widget, disconnected from any real data.

## Assessment

None of this is presently a security problem (the *authoritative* commission/SLA numbers are DB-enforced and can't be bypassed by a compromised frontend), but it is exactly the kind of duplication master-prompt §26/§29 warns against, and it means the "matching algorithm" work already exists in `maidere-connect`'s throwaway demo code in a more developed form than anywhere it can actually be used. Per master-prompt §29 ("do not implement duplicate matching algorithms in Connect... the public frontend only displays the result"):

- **CREATE**: a real matching/candidate-ranking endpoint in `apps/api` (e.g. `GET /demandes/:id/candidats`), likely adapting `maidere-connect`'s `classerPrestataires()` algorithm server-side since it's the most complete version that exists anywhere in either repo.
- **DELETE** (from frontends, once the API endpoint exists): the `apps/web` triplicated `enRetard`/`candidatsPertinents`/commission-preview logic, replaced with values returned by the API.
- **DELETE** (from `maidere-connect`): `src/lib/maidere.ts` in its entirety, once real `demandes`/`sla_config`/`commission_config` data and endpoints exist to replace the demo — its algorithm should live server-side, not be ported again into the frontend.
