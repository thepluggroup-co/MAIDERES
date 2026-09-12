# Documentation technique — API MAIDERES

- **`openapi.yaml`** — spécification OpenAPI 3.0.3 de `apps/api`. Source de
  vérité pour les formes de requête/réponse : `paths` reflète le montage
  réel (`apps/api/src/app.ts`), `components.schemas` reflète les schémas
  Zod de `packages/contracts`. Si l'un des deux change, ce fichier doit
  être mis à jour à la main (pas de génération automatique depuis le code
  pour l'instant — voir "Limites" plus bas).
- **`../../postman/collections/`** — collection et environnement Postman,
  **générés** depuis `openapi.yaml` par `scripts/gen-postman.js`. Ne pas
  éditer ces deux fichiers à la main : régénérer via `pnpm postman:generate`
  après toute modification du spec.

## Utiliser la doc

- **Visualiser l'OpenAPI** : coller le contenu de `openapi.yaml` dans
  [editor.swagger.io](https://editor.swagger.io), ou l'ouvrir avec
  l'extension VS Code "OpenAPI (Swagger) Editor".
- **Tester avec Postman** : importer
  `postman/collections/MAIDERES-API.postman_collection.json` et
  `MAIDERES-API.postman_environment.json`, sélectionner l'environnement,
  renseigner `access_token` (un JWT Supabase valide — via login front ou
  `supabase.auth.signInWithPassword` en console) dans les variables
  d'environnement (jamais commité en clair). Le groupe **Public** n'a pas
  besoin de token.

## Versioning

Chaque route existe sous `/api/...` (historique) et `/api/v1/...`
(recommandé pour toute nouvelle intégration) — alias stricts du même code,
voir le commentaire dans `apps/api/src/app.ts`. `base_url` par défaut dans
Postman/l'environnement local : `http://localhost:3001/api/v1`.

## Limites connues

- Écrit et maintenu à la main à partir de `packages/contracts` — pas de
  génération automatique depuis les schémas Zod (pas de dépendance
  `zod-to-openapi` ajoutée ; le nombre d'entités actuel ne le justifie pas
  encore). Si `packages/contracts` dérive de ce fichier, `openapi.yaml` est
  la source à corriger.
- `admin.ts` (RBAC/gestion utilisateurs) n'est documenté que sommairement
  (hors périmètre `@maideres/contracts`, cf. son commentaire d'en-tête) —
  suffisant pour un usage interne staff, pas pour un consommateur externe.
- Les exemples de corps de requête dans la collection Postman sont générés
  automatiquement (valeurs placeholder type-correctes, pas des exemples
  métier réalistes) — à adapter avant un vrai test.
