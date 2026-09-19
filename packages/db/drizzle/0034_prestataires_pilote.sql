-- 0034 — Marquer les prestataires de la phase pilote.
--
-- Décision (17/09/2026, cf. docs/integration/12-NIVEAU-2-PROCESSUS-ET-
-- GOUVERNANCE.md §6) : l'inscription reste ouverte à tous, le filtrage se
-- fait à la validation staff (en_attente → actif). `pilote` permet en plus
-- de marquer précisément quels prestataires appartiennent à l'échantillon
-- de référence du pilote, distinctement des inscriptions futures — sans
-- quoi, une fois le pilote élargi, il devient impossible de savoir quels
-- retours viennent de l'échantillon initial.

ALTER TABLE public.prestataires
  ADD COLUMN IF NOT EXISTS pilote boolean NOT NULL DEFAULT false;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS prestataires_pilote_idx ON public.prestataires (pilote) WHERE pilote = true;
--> statement-breakpoint

-- Défense en profondeur (cf. 0001_rls_policies.sql) : pilote rejoint
-- statut/taux_commission/note_moyenne dans la liste des colonnes qu'un
-- prestataire ne peut jamais modifier lui-même, même en cas d'accès direct
-- à la table hors de l'API (qui, elle, l'empêche déjà via les contrats Zod).
CREATE OR REPLACE FUNCTION public.guard_prestataire_self_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF public.is_staff() THEN
    RETURN NEW;
  END IF;

  IF NEW.statut IS DISTINCT FROM OLD.statut
     OR NEW.taux_commission IS DISTINCT FROM OLD.taux_commission
     OR NEW.note_moyenne IS DISTINCT FROM OLD.note_moyenne
     OR NEW.pilote IS DISTINCT FROM OLD.pilote THEN
    RAISE EXCEPTION 'Seul un opérateur ou un admin peut modifier statut / taux_commission / note_moyenne / pilote';
  END IF;

  RETURN NEW;
END;
$$;
