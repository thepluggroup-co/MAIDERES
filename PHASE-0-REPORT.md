# Phase 0 — Rapport de nettoyage & rebranding MAIDERES

Statut : **complétée**. `pnpm install` et `pnpm build` passent sur les 8 packages
en scope (`api`, `web`, `shop`, `db`, `shared`, `ai`, `ui`, `desktop`). Tests
`apps/api` : 30/30 verts, seuils de couverture ajustés. `apps/mobile` échoue
au build mais n'a pas été touché — voir section dédiée.

## Ce qui a été supprimé (domaine ex-ERP Tafdil)

- **apps/api/src** (56 fichiers) : 13 routes métier (`bons`, `commerce`,
  `credit`, `equipements`, `finance`, `fournisseurs`, `logistique`,
  `operations`, `paiements`, `rapports`, `rh`, `shop`, `ai`), 16 services
  métier (finance, crédit, stock, comptabilité, BL, workflow commande,
  cron réappro/relances, PDF, email…), `data/plan-comptable.json`,
  `assets/logo-tafdil.jpeg`, et ~20 fichiers de tests correspondants.
- **apps/web/src** (54 fichiers) : 17 pages métier (Boutique, Clients,
  Commandes, Devis, Equipements, Finance, Formation, Fournisseurs,
  Intelligence, IoT, Logistique, Marketing, Production, Projets, RH,
  Securite, Stocks, Dashboard) + leurs sous-pages, 16 hooks métier,
  `features/credit`, `components/devis`, `lib/db.ts` + `lib/ipc-client.ts`
  (couche données SQLite/IPC offline-first, ~1600 lignes, propre à l'ancien
  ERP desktop), `lib/constants.ts`.
- **apps/shop** (49 fichiers) : catalogue produit, panier, page de commande,
  devis, blog, contact, paiement-en-cours, toutes les routes API internes
  (`/api/shop/*`, `/api/paiements/*`), `lib/cart.ts`, `lib/catalogue.ts`,
  `lib/blog.ts`, `lib/forge-api.ts`, `lib/types.ts`.
- **packages/db** : schéma Drizzle réduit de 48 tables ERP (production,
  paie, IoT, EPI, équipements, marketing…) à la seule table `profiles`
  (auth). Sous-système offline SQLite/sync (`schema.ts`, `client.ts`,
  `sqlite-client.ts`, `sync.ts`, ~1750 lignes) supprimé — non consommé par
  autre chose que l'ancien `db-local.ts` déjà retiré. Module crédit
  (`schema-credit.ts`, `schema.pg.credit.ts`) supprimé. 43 migrations SQL
  Tafdil vidées (nouveau projet Supabase = nouvel historique en Phase 1).
- **`supabase/` (racine)** : second historique de migrations ad-hoc
  (44 fichiers, 100 % domaine Tafdil, ciblait l'ancien projet Supabase) —
  supprimé intégralement.
- **Fichiers parasites** : `console.log(f))` (fichier vide accidentel),
  `check-zip.js` (script debug avec chemin local d'un ancien poste),
  `packages/db.zip` (backup obsolète), `Testing/~$ase 01 Test ERP.docx`
  (fichier de verrouillage Office), `FORGE ENV/` (dossier dupliqué stray).

## Ce qui a été conservé (infra réutilisable)

- **Auth** : middleware `auth.ts`, `rbac.ts`, `permission.middleware.ts`,
  `rateLimit.ts`, `audit.ts` (apps/api) — inchangés.
- **RBAC complet** : `packages/db/src/schema.pg.rbac.ts` (rbac_roles,
  rbac_permissions, rbac_user_profiles, rbac_audit_logs,
  rbac_security_settings, rbac_login_attempts) + `rbacService.ts` +
  seed (`seeds/rbac.ts`) + UI (`AdminSettings.tsx`,
  `features/admin/*`) — **taxonomie de rôles/modules non touchée** (voir
  point en suspens ci-dessous).
- **NotchPay** : pattern conservé côté `apps/shop` (`checkout/payment-options`,
  `lib/auth.ts` OTP). Le wiring API (`apps/api/routes/paiements.ts`,
  `apps/shop/api/paiements/*`) était couplé aux `commandes` de l'ancien ERP
  et a été supprimé — à rebrancher en Phase 5 sur la table `transactions`.
- **Africa's Talking (SMS)** : `apps/api/services/sms.service.ts` conservé,
  débarrassé des templates SMS spécifiques aux commandes (`buildCommandeSms`,
  `notifyCommandeSms`) ; ne reste que `sendSms`/`normalizePhone` génériques.
- **packages/ui** : inchangé (kit de composants générique).
- **packages/ai** : `client.ts` (wrapper Anthropic) inchangé ;
  `forge-assistant.ts` rebrandé (prompt système MAIDERES au lieu de
  TAFDIL/FORGE ERP).
- **Shell apps/web** : `AppShell`, `AuthContext`, `DataTable`, pattern de
  hooks — inchangés. `Sidebar`/`TopBar` vidés des liens vers les modules
  métier supprimés ; `App.tsx` réduit aux routes `/login`, `/dashboard`
  (placeholder `ModulePage`), `/account`, `/admin`.
- **checkout/suivi/OTP apps/shop** : `app/compte/login`,
  `app/checkout/payment-options`, `app/suivi/*`, `lib/auth.ts`,
  `lib/supabase.ts`, `middleware.ts` — conservés tels quels (le suivi de
  commande pointe encore vers une table qui n'existe plus ; à rebrancher
  sur `demandes` en Phase 4).
- **CI/CD, config monorepo** : `turbo.json`, `pnpm-workspace.yaml`,
  `tsconfig.base.json`, `.github/` — inchangés.

## Rebranding effectué

- `package.json` racine : `forge-tafdil` → `maideres`.
- `.env.example` : `FRONTEND_URL` pointé vers un domaine MAIDERES.
- `README.md`, nouveau `CLAUDE.md` (contexte projet, à la racine).
- `packages/ai` : prompt système de l'assistant rebrandé.
- `apps/shop` : métadonnées SEO (`app/metadata.ts`), page d'accueil
  (placeholder — la vraie vitrine à deux portes est Phase 4), Header/Footer
  débarrassés des liens catalogue/panier morts.
- Logo/favicon Tafdil **non remplacés** (aucun asset MAIDERES fourni) —
  `public/tafdil-logo.png` et `components/ui/BrandLogo.tsx` (composant
  `MetalForgeLogo`) sont encore en place, à remplacer dès que les assets
  de marque existent.

## Points en suspens (à trancher en Phase 1/2, pas maintenant)

1. **Taxonomie de rôles** : deux systèmes de rôles coexistent dans le code
   hérité — `profiles.role` (`admin/superviseur/operateur/apprenant`,
   utilisé par `requireRole`) et `rbac_roles.name`
   (`SUPER_ADMIN/MANAGER/COMMERCIAL/CAISSIER/MAGASINIER/FORMATEUR/READONLY`,
   utilisé par `requirePermission`/`PermissionsMatrix`). Le CLAUDE.md du
   projet vise `admin/operateur/prestataire/client`. J'ai commencé à
   renommer côté `apps/web` puis **annulé** — le changement se propage
   dans 8+ fichiers interdépendants côté `apps/api` (JWT normalization,
   mapping RBAC, middleware) et c'est explicitement le travail de la
   Phase 1 (schéma + RLS par rôle), pas du nettoyage Phase 0. Ne pas
   redémarrer ce chantier à la pièce — le faire d'un coup en Phase 1.
2. **RBAC_MODULES** (`STOCK/COMMERCIAL/FINANCE/HR/PRODUCTION/LOGISTICS/
   ADMIN/REPORTS/RECEIVABLES`) porte encore les modules de l'ancien ERP —
   à remplacer par les modules MAIDERES (demandes, prestataires, clients,
   matching, finance, admin) quand ces domaines existeront.
3. **`apps/mobile` échoue au build** (`pnpm build`) — erreurs TypeScript
   pré-existantes (`ImportMeta.env`, API `BrowserMultiFormatReader`, types
   `CreateShopCommandeLigne`), confirmées non liées à cette session
   (`git diff apps/mobile` vide). Gelé jusqu'au post-MVP par consigne
   explicite — non corrigé.
4. **2 tests pré-existants cassés côté apps/web** (`Login.test.tsx` attend
   une redirection vers `/production` alors que `Login.tsx` redirige déjà
   vers `/dashboard` ; `e2e/auth.spec.ts` est un test Playwright que vitest
   essaie d'exécuter par erreur de config). Confirmés pré-existants
   (aucune diff sur ces fichiers) — non corrigés, hors périmètre Phase 0.
5. **Logo/branding visuel** : aucun asset MAIDERES fourni ; le logo/nom
   TAFDIL/MetalForge reste affiché tant que les assets ne sont pas livrés.

## Validation

- `pnpm install` : OK.
- `pnpm build` (8 packages hors `apps/mobile`) : **vert**.
- `apps/api` tests : **30/30 verts**, couverture au-dessus des nouveaux
  seuils (67 % lignes / 66 % branches / 71 % fonctions / 67 % statements).
- Plus aucune référence au domaine Tafdil dans le code applicatif
  (routes, services, pages, hooks) — vérifié par grep exhaustif après
  chaque suppression, avant chaque build.
- `packages/db` vide de tout domaine métier (une seule table : `profiles`).
