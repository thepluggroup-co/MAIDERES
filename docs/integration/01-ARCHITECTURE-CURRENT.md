# 01 — Current Architecture

## MAIDERES (monorepo, pnpm 10 + turbo, Node 20+)

```
MAIDERES/
├── apps/
│   ├── api/       Hono API. JWT auth (HS256/JWKS vs its own Supabase project),
│   │               legacy role checks + parallel fine-grained RBAC, audit_log
│   │               middleware, rate limiting (Upstash w/ in-memory fallback).
│   │               Runs entirely as Supabase service-role (RLS bypassed by
│   │               design; ownership enforced in TS via identity.service.ts).
│   ├── web/       React/Vite back-office console ("Console 360"). Real,
│   │               functional. All business data via apps/api; auth + a few
│   │               direct reads (profile role, one stale `credits` probe,
│   │               Realtime cache-invalidation subscriptions) go straight to
│   │               Supabase.
│   ├── shop/      Next.js 14 App Router. Intended public vitrine + client/
│   │               prestataire spaces (per MAIDERES/CLAUDE.md). Mostly
│   │               placeholder: only phone-OTP login (own `otp_sessions`/
│   │               `clients_shop` tables, bespoke JWT cookie, independent of
│   │               Supabase Auth) is real. Order tracking (`/suivi`) queries a
│   │               `commandes_shop` table deleted in Phase 0 — dead end-to-end.
│   │               No working checkout. Talks to Supabase directly everywhere,
│   │               never through apps/api.
│   ├── mobile/    Frozen until post-MVP. Not touched, not audited in depth.
│   └── desktop/   Frozen. A separate, unrelated legacy product ("FORGE by
│                   TAFDIL" / TAFDIL SARL ERP) still branded and schemed as
│                   the old ERP (produits/commandes/devis/factures/employes).
│                   Bakes SUPABASE_SERVICE_ROLE_KEY into its Electron bundle
│                   at build time (see 08-SECURITY-AUDIT.md).
├── packages/
│   ├── db/        Drizzle schema (15 marketplace tables + profiles + full
│   │               RBAC tables), hand-written RLS migrations, SQL trigger
│   │               functions (commission calc, SLA delay calc, intervention
│   │               status sync), seed script (Douala-only sample data).
│   ├── shared/    Zod types + constants — still shaped like the old ERP
│   │               (Product/Order/priceXAF) and Cameroon-hardcoded delivery
│   │               fees; not actually consumed by the marketplace domain
│   │               entities (Demande/Prestataire/Matching are redefined
│   │               independently in apps/web instead).
│   ├── ai/        Anthropic SDK wrapper + a French system prompt hardcoding
│   │               "Douala, Cameroun" / "FCFA (XAF)".
│   └── ui/        Generic design-system components, shared by web/mobile/shop.
├── .github/workflows/   ci.yml (lint/typecheck, apps/api tests, build web+shop),
│                         deploy.yml (Railway for api, Vercel for web+shop).
├── railway.json         Deploys apps/api only.
└── docs/integration/    (this audit)
```

Auth/data flow today:
```
apps/web  →  apps/api (JWT bearer)  →  Supabase (service role, RLS bypassed)
apps/web  →  Supabase directly       (auth session, one legacy table probe, Realtime)
apps/shop →  Supabase directly       (own tables: otp_sessions, clients_shop,
                                       commandes_shop [gone], produits_shop [gone])
```

## maidere-connect (standalone repo)

```
maidere-connect/
├── src/
│   ├── routes/            TanStack Start file-based routes:
│   │                       public: /, /prestataires, /prestataires/:id,
│   │                       /a-propos, /faq, /contact, /cgu,
│   │                       /auth/client, /auth/prestataire
│   │                       authenticated: /espace/* (client space),
│   │                       /pro/* (provider space)
│   ├── components/maideres/  AuthCard, EspaceShell, PageShell
│   ├── lib/maidere.ts      Standalone matching/commission/SLA logic, ported
│   │                        from "the MAIDERES console" per its own comment —
│   │                        demo-only (drives 2 landing-page widgets; no real
│   │                        `demandes` table exists here to consume it).
│   ├── lib/maideres-api.ts Supabase data-access layer for this repo's own
│   │                        schema (prestataires/offres/promotions/
│   │                        realisations/avis) — a second, incompatible
│   │                        `Prestataire` type from the one in maidere.ts.
│   └── integrations/supabase/  Client setup (browser/server/service),
│                                 Lovable-preview auth-storage bridge.
├── supabase/
│   ├── config.toml         project_id = apwklqvazttnnppdymmu (own project,
│   │                        distinct from MAIDERES's).
│   └── migrations/         3 files: full schema + RLS (one big initial
│                             migration), function-grant lockdown, storage
│                             policies for a `maideres` bucket.
└── (no apps/api equivalent — no backend of its own at all)
```

Auth/data flow today:
```
maidere-connect  →  Supabase (its own project) directly, everywhere
                     (auth, all CRUD, storage) — no API layer, no Edge
                     Functions.
```

## The structural problem

Both `apps/shop` and `maidere-connect` are independent attempts at "the public front-office," built against different data models, in different frameworks (Next.js vs TanStack Start), against different Supabase projects, with no shared code. Per the conversation's resolved direction (Master Prompt V2 logic), `maidere-connect` is the front-office going forward and `apps/shop` becomes redundant — but `apps/shop`'s one working piece (phone-OTP auth against Cameroon numbers) and its route structure are worth comparing against what `maidere-connect` will need once it's repointed at the MAIDERES API (see `04-API-MAPPING.md` and `09-MIGRATION-PLAN.md`, not yet written).
