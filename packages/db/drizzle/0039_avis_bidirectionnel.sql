-- Avis bidirectionnel : un prestataire peut désormais noter le client sur
-- son propre matching, en plus de l'avis existant (client → prestataire).
-- "Changement de schéma modeste" (Johanne) : une colonne + une contrainte
-- remplacée, rien d'autre en base.

ALTER TABLE "avis" ADD COLUMN "auteur" text NOT NULL DEFAULT 'client';

ALTER TABLE "avis" ADD CONSTRAINT "avis_auteur_check" CHECK (auteur IN ('client', 'prestataire'));

-- Remplace l'ancienne contrainte 1-avis-par-matching : jusqu'à 2 avis par
-- matching désormais, un par sens (client→prestataire, prestataire→client).
ALTER TABLE "avis" DROP CONSTRAINT "avis_matching_id_unique";
ALTER TABLE "avis" ADD CONSTRAINT "avis_matching_id_auteur_unique" UNIQUE ("matching_id", "auteur");
