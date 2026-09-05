# Phase 3 — Rapport : Console 360 back-office (apps/web)

Statut : **complétée**, validée contre le vrai projet Supabase (pas de mock).

## Écrans livrés

| # | Écran | Route | Fichier |
|---|---|---|---|
| 1 | File des demandes (liste + filtres + saisie rapide) | `/demandes` | `pages/Demandes.tsx` |
| 2 | Annuaire prestataires (filtres + onboarding + validation statut) | `/prestataires` | `pages/Prestataires.tsx` |
| 3 | Écran de matching (prestataires pertinents, proposer, clôturer) | `/demandes/:id` | `pages/DemandeDetail.tsx` |
| 4 | Fiches clients (historique des demandes) | `/clients` | `pages/Clients.tsx` |
| 5 | Dashboard KPI | `/dashboard` | `pages/Dashboard.tsx` |
| 6 | Paramètres + RBAC | `/admin` | déjà existant (Phase 0), inchangé |

`AppShell`/`Sidebar`/`TopBar`/`AuthContext` réutilisés tels quels ; `Sidebar`
avait un groupe `NAV_GROUPS` volontairement vide depuis la Phase 0 avec le
commentaire "ajouté en Phase 3" — rempli ici avec Demandes/Prestataires/
Clients. `packages/ui` (DataTable, PageHeader, KpiCard, SlideOver,
StatusBadge, Button, EmptyState) réutilisé sans aucune modification.

## Décisions de design notables

- **Pas de nouvel endpoint API.** Le Dashboard KPI (nb demandes, taux de
  matching réussi, délai moyen, top catégories, top prestataires) est
  calculé côté client à partir des listes déjà exposées en Phase 2
  (`useDemandes`, `useMatchings`, `usePrestataires`, `useCategories`) —
  conforme à la consigne "ne touche à aucune app front… reste sur
  apps/web" : je l'ai lue comme incluant "ne rouvre pas apps/api". Ça
  suffit à l'échelle actuelle (quelques centaines de lignes) ; si le
  volume grossit, ces calculs mériteront un endpoint dédié.
- **Filtre "quartier" sur les demandes** : la table `demandes` n'a pas de
  colonne `quartier` (seulement `localisation`, texte libre) — le filtre
  demandé se fait donc via le quartier du **client** rattaché
  (`clients.quartier`), recoupé côté client après récupération des deux
  listes. Idem pour "proximité" dans l'écran de matching : pas de calcul
  de distance géographique (les colonnes `geoloc_lat/lng` existent mais
  aucune donnée réelle n'est encore saisie) — la pertinence est approximée
  par correspondance de quartier client/prestataire, puis tri par note.
- **Création de client à la volée** dans le formulaire de demande rapide :
  un opérateur qui reçoit un appel manuel/WhatsApp a rarement un client
  déjà enregistré — le SlideOver de création de demande permet de créer
  le client inline (bascule "Nouveau client") sans quitter le flux.
- **RBAC déjà entièrement porté par l'API (Phase 2)** : aucune vérification
  de rôle supplémentaire ajoutée côté front — les boutons d'action
  (proposer, clôturer, valider un statut) sont affichés à tous les rôles
  ayant accès à la Console, et c'est l'API qui refuse ce qui n'est pas
  autorisé (ex. un opérateur ne peut pas se faire passer pour un
  prestataire côté serveur). Cohérent avec le principe déjà appliqué en
  Phase 2 : RBAC appliqué côté service role, jamais fait confiance au
  client.

## Test du parcours opérateur (exigé par cette phase)

`apps/web/src/__tests__/operatorFlow.test.tsx` — monte réellement
`Demandes` + `DemandeDetail` sous un `MemoryRouter`/`QueryClientProvider`,
avec un faux `apiClient` en mémoire (pas de mock Supabase direct, ce
niveau-là est déjà couvert côté API en Phase 2). Parcours exercé de bout
en bout à travers l'UI réelle :

1. Ouvrir "Nouvelle demande", rechercher un client existant, remplir
   catégorie/description, soumettre → la demande apparaît dans la file.
2. Cliquer la ligne → écran de matching → prestataire pertinent affiché
   (filtré par catégorie) → "Proposer".
3. Le matching passe à "Accepté" (le faux backend simule l'acceptation du
   prestataire, une action qui appartient à la Phase 4 / apps/shop, hors
   périmètre de cette console) → le formulaire de clôture apparaît.
4. Clôturer en "Réalisé" → statut demande passe à "realisee", vérifié à la
   fois dans l'UI et dans l'état du faux backend.

Un second test vérifie qu'un matching resté au statut `propose` n'affiche
**pas** le formulaire de clôture (garde-fou UI cohérent avec la règle API
"clôture seulement si statut = accepte").

## Bugs pré-existants trouvés et corrigés au passage

Aucun des deux fichiers suivants n'était modifié par mes changements
(vérifié via `git status` avant correction) — trouvés en faisant tourner
`pnpm test` sur `apps/web`, cassé indépendamment de cette phase :

- `Login.test.tsx` attendait encore une redirection vers `/production`
  (route de l'ancien ERP, supprimée en Phase 0) alors que `Login.tsx`
  redirige déjà vers `/dashboard`. Corrigé (2 lignes) — pertinent ici car
  ça touche directement le chemin login → dashboard que cette phase
  construit.
- `vitest.config.ts` n'excluait pas `e2e/**` : les specs Playwright
  (`e2e/auth.spec.ts`) étaient ramassées par le runner vitest et
  plantaient au chargement (`test()` incompatible entre les deux
  frameworks). Corrigé par un `exclude` — nécessaire pour que `pnpm test`
  donne un signal propre sur cette phase.

## Validation

- **Contre le vrai Supabase**, pas seulement en test : `apps/api` démarré
  en local avec les vraies clés (`SUPABASE_URL`/`SERVICE_ROLE_KEY` du
  projet MAIDERES branché en fin de Phase 1/2) — `GET /health/db` retourne
  `{"ok":true,"db":"connected"}`, `GET /api/categories_services` sans
  token retourne bien `401 MISSING_TOKEN` (RBAC actif).
- `pnpm test` sur `apps/web` : **27/27 verts** (4 fichiers, dont les
  9 nouveaux tests du parcours opérateur).
- `tsc --noEmit` sur `apps/web` : **0 erreur** dans les fichiers touchés
  par cette phase. 4 erreurs pré-existantes subsistent dans
  `AuthContext.tsx`/`features/admin/*` (confirmées non modifiées par ce
  travail via `git status` — hors périmètre, non corrigées).
- `pnpm build` (workspace complet, hors `apps/mobile` gelé) : **vert**,
  8/8 tâches.

## Ce qui n'a pas été fait (hors périmètre, ou pas encore vérifiable)

- **Vérification manuelle en navigateur avec un vrai compte connecté** :
  non faite. Les tests couvrent le parcours via React Testing Library
  (DOM réel, pas de mock des composants métier), mais aucun utilisateur
  Supabase Auth réel n'a été créé pour se connecter et cliquer dans un
  vrai navigateur — je n'ai que les profils de seed (Phase 1), qui n'ont
  pas de mot de passe. Si tu veux ce niveau de vérification, il faut soit
  créer un compte via le flux d'invitation admin existant, soit m'indiquer
  un compte de test.
- Aucune app front autre que `apps/web` touchée (`apps/shop` = Phase 4).
- Aucun paiement, aucune notification (Phases 5/6).
