# MAIDERES

Marketplace d'intermédiation de services multi-prestataires (Cameroun, Douala).

Voir `CLAUDE.md` pour le contexte projet et `MAIDERES-PLAN-CLAUDE-CODE.md` pour le plan de développement par phases.

## Tests d'intégration (`apps/api`)

`apps/api/src/__tests__/integration/` contient des tests qui s'exécutent
contre une **vraie instance Supabase**, sans aucun mock — auth réelle
(création d'utilisateurs, connexion, JWT), vraies requêtes Postgres, vrais
triggers, vraie RLS. Ils sont volontairement séparés de la suite rapide
(`pnpm test`) : ils font des appels réseau, sont plus lents, et surtout ne
doivent **jamais tourner contre le projet Supabase de dev/prod**.

**Pourquoi ça existe** : la suite rapide mocke Supabase (`fakeSupabase`,
état en mémoire) pour rester hermétique et rapide en CI. Un mock teste
notre modèle mental de Supabase, pas Supabase — deux bugs réels n'ont été
trouvés QUE par le test d'intégration, jamais par les mocks : l'absence de
la table `audit_log` (Phase 2, le middleware d'audit écrivait dans le
vide) et un trigger de garde qui bloquait le service role lui-même
(`current_user` à l'intérieur d'une fonction `SECURITY DEFINER` reflète le
propriétaire de la fonction, pas l'appelant — un mock ne simule aucun
trigger Postgres, donc aucune chance de l'attraper autrement).

### 1. Créer un projet Supabase dédié aux tests

Un projet Supabase séparé du projet MAIDERES de développement (jamais le
même — les tests créent et suppriment des données réelles) :

1. [supabase.com/dashboard](https://supabase.com/dashboard) → New Project
   → nom `maideres-test` (ou équivalent), mot de passe DB à noter.
2. Récupérer 3 valeurs dans Project Settings → API :
   `Project URL`, `anon public key`, `service_role key`.
3. Récupérer la chaîne de connexion Postgres directe dans le panneau
   **Connect** (bouton en haut du dashboard) → onglet **Session pooler**
   (pas "Direct connection" : héberge le plus souvent en IPv6 seul,
   inutilisable depuis un réseau IPv4-only — voir aussi la remarque
   ci-dessous si `getaddrinfo ENOENT`/`ENETUNREACH` apparaît).

### 2. Appliquer le schéma à ce projet de test

```bash
# Depuis packages/db, avec DATABASE_URL pointé sur le projet de TEST
# (chaîne "Session pooler" de l'étape 1, PAS celle de .env principal) :
DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres" \
  pnpm --filter @maideres/db db:migrate
```

Applique toutes les migrations (`packages/db/drizzle/*.sql`, dans l'ordre du
journal) — tables, RLS, triggers de garde, fonctions. Idempotent, rejouable
sans risque.

### 3. Configurer les variables d'environnement du test

Le test lit `TEST_SUPABASE_URL` / `TEST_SUPABASE_ANON_KEY` /
`TEST_SUPABASE_SERVICE_ROLE_KEY` (préfixe `TEST_` délibéré — jamais les
mêmes noms que `.env` principal, pour ne jamais risquer de lancer le test
contre le mauvais projet par erreur de variable non définie).

```bash
export TEST_SUPABASE_URL="https://<ref-test>.supabase.co"
export TEST_SUPABASE_ANON_KEY="eyJ..."
export TEST_SUPABASE_SERVICE_ROLE_KEY="eyJ..."
```

Sans ces 3 variables, le test est **automatiquement ignoré**
(`describe.skipIf`) — `pnpm test` (suite par défaut) ne les requiert
jamais et n'exécute d'ailleurs pas ce dossier.

### 4. Lancer

```bash
pnpm --filter @maideres/api test:integration
```

Le test crée lui-même ses utilisateurs Supabase Auth (emails
`integration-*@maideres-test.cm`, mot de passe fixe), leurs profils, une
catégorie de test (`__integration_test__ Coiffure`), une fiche client et
une fiche prestataire — via l'API réelle quand un endpoint existe,
directement en base sinon (ex. `categories_services`, sans route POST).
Ces fixtures sont **conservées** entre les runs (retrouvées et réutilisées
à chaque exécution, idempotent) ; seules les données éphémères du flux
testé (demande, matching, avis créés pendant le test) sont supprimées en
fin de run.

## Tests RLS manuels (SQL Editor)

Pour vérifier une policy RLS à la main, **le Table Editor de Supabase ne
prouve rien** : il exécute ses requêtes en tant que `postgres` (rôle
superuser, `BYPASSRLS`), donc une table où RLS est activée mais où **aucune
policy n'existe** semble quand même afficher toutes les lignes — RLS y
paraît fonctionner alors qu'elle bloquerait en réalité tout le monde, staff
compris, une fois passée par PostgREST. Un test valide doit forcer le
rôle Postgres `authenticated` (celui que PostgREST utilise réellement pour
une requête authentifiée) et positionner les GUC que `auth.uid()` /
`auth.role()` lisent — exactement la mécanique documentée dans
`0005_fix_service_role_check_v2.sql`.

### Procédure

Dans le SQL Editor du projet Supabase (idéalement le projet de **test**,
voir § précédent — pas obligatoire ici car tout est encapsulé dans une
transaction annulée, mais reste la bonne pratique par défaut) :

**0. Repérer un profil staff et un profil non-staff** (avec une fiche
`prestataires` ou `clients` associée — sinon `own_prestataire_id()` /
`own_client_id()` renvoient NULL et les policies "own" ne matchent jamais) :

```sql
select id, role from public.profiles where role in ('admin', 'superviseur', 'operateur') limit 1;
-- copier l'id → <STAFF_PROFILE_ID>

select profile_id from public.prestataires limit 1;
-- copier profile_id → <PRESTA_PROFILE_ID>
```

**1. En tant que non-staff (prestataire)** — doit être bloqué sur les
tables sans policy "own", et ne voir que ses propres lignes ailleurs :

```sql
begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub',  '<PRESTA_PROFILE_ID>', true);
  select set_config('request.jwt.claim.role', 'authenticated',       true);

  select count(*) from public.sla_config;               -- attendu : 0 (aucune policy pour ce rôle)
  select count(*) from public.commission_config;         -- attendu : 0 (select réservé au staff)
  select count(*) from public.intervention_evenements;   -- attendu : 0 si aucune ligne ne lui appartient
  select count(*) from public.interventions;             -- attendu : uniquement SES interventions (via matchings.prestataire_id)

  -- écriture refusée, même sur une ressource qui lui appartient :
  insert into public.sla_config (niveau_urgence, delai_heures) values ('urgent', 999);
  -- attendu : ERROR: new row violates row-level security policy for table "sla_config"
rollback;
```

Si `count(*)` renvoie autre chose que 0 sur `sla_config`/`commission_config`,
ou si l'`insert` réussit, la RLS ne bloque pas — c'est le signal d'alerte
que le Table Editor ne peut pas donner.

**2. En tant que staff (operateur, pas admin)** — doit tout lire, mais pas
écrire sur `commission_config` (réservé à `is_admin()`) :

```sql
begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub',  '<STAFF_PROFILE_ID>', true); -- role='operateur' en base
  select set_config('request.jwt.claim.role', 'authenticated',      true);

  select count(*) from public.sla_config;         -- attendu : toutes les lignes
  select count(*) from public.commission_config;   -- attendu : toutes les lignes
  select count(*) from public.interventions;       -- attendu : toutes les lignes

  insert into public.sla_config (niveau_urgence, delai_heures) values ('urgent', 999);
  -- attendu : succès (is_staff() suffit pour sla_config)

  insert into public.commission_config (categorie_id, type, valeur) values (null, 'pourcentage', 1);
  -- attendu : ERROR — commission_config_write_admin exige is_admin(), pas seulement is_staff()
rollback;
```

`SET LOCAL` et les `set_config(..., true)` (3ᵉ argument `true` = portée
transaction) sont automatiquement annulés au `rollback` — rien à nettoyer,
et aucune donnée n'est réellement écrite même quand un `insert` "réussit".
