-- 0031_prestataire_metier_fk.sql
--
-- Décision (cf. memory technical-learnings, THE PLUG / MAIDERES) : le champ
-- `prestataires.metier`, jusqu'ici un libellé texte libre saisi par le
-- prestataire pour sa fiche publique (0027), devient une vraie référence
-- (UUID) vers `categories_services`, alignée sur le modèle déjà utilisé côté
-- staff (`prestataires.categories`, `demandes.categorie_id`).
--
-- Effet de bord assumé (option "Complète" retenue) : le contrat public
-- change de type (string libre -> uuid). apps/api, packages/contracts et
-- tout client de la vitrine consommant `metier`/`?categorie=` doivent être
-- mis à jour de concert — cf. les fichiers .ts modifiés dans le même lot.

BEGIN;

-- 1. Nouvelle colonne FK, nullable le temps de la bascule.
ALTER TABLE prestataires
  ADD COLUMN metier_id uuid REFERENCES categories_services(id);

-- 2. Backfill : rapprochement de l'ancien texte libre avec le libellé de
--    catégorie le plus proche (comparaison insensible à la casse et aux
--    espaces superflus). Toute ligne non rapprochée reste NULL.
UPDATE prestataires p
SET metier_id = c.id
FROM categories_services c
WHERE p.metier IS NOT NULL
  AND lower(trim(p.metier)) = lower(trim(c.libelle));

-- 3. Contrôle manuel avant de couper l'ancienne colonne : lignes dont le
--    texte libre n'a trouvé aucune correspondance exacte (à traiter au cas
--    par cas — renommer la catégorie existante ou réassigner à la main
--    avant de rejouer cette migration en production) :
--
--    SELECT id, nom, metier
--    FROM prestataires
--    WHERE metier IS NOT NULL AND metier_id IS NULL;

-- 4. Suppression de l'ancienne colonne texte libre.
ALTER TABLE prestataires DROP COLUMN metier;

-- 5. Index pour le filtre public par catégorie (GET /api/public/prestataires?categorie_id=...).
CREATE INDEX prestataires_metier_id_idx ON prestataires (metier_id);

COMMIT;
