-- 0037 — La note moyenne d'un prestataire suit les avis clients.
--
-- Constat : `prestataires.note_moyenne` n'était mise à jour par AUCUN code
-- (ni trigger, ni route) : elle restait à 0 quelle que soit la note donnée
-- par les clients dans la vitrine. La fiche publique recalculait la moyenne
-- à la volée à partir des avis, mais le module Prestataires de l'ERP (et le
-- tri « mieux notés » de l'annuaire public) lisaient la colonne figée à 0.
--
-- Correctif : un trigger sur `avis` recalcule la moyenne du prestataire du
-- matching concerné à chaque création, modification de note ou suppression.
-- Source de vérité en base : marche pour tout chemin d'écriture (API, staff,
-- SQL), pas seulement pour la route POST /api/avis.
--
-- La garde guard_prestataire_self_update() interdit toute modification de
-- note_moyenne hors staff / session vide. Le recalcul passe par un drapeau
-- de transaction (`maideres.sync_note`) posé uniquement par la fonction
-- ci-dessous : il n'autorise QUE note_moyenne, jamais statut, taux_commission
-- ou pilote. Cette version de la garde remplace celle de 0036 (elle en garde
-- le contournement `auth.uid() IS NULL`).

CREATE OR REPLACE FUNCTION public.guard_prestataire_self_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_staff() THEN
    RETURN NEW;
  END IF;

  IF NEW.statut IS DISTINCT FROM OLD.statut
     OR NEW.taux_commission IS DISTINCT FROM OLD.taux_commission
     OR NEW.pilote IS DISTINCT FROM OLD.pilote THEN
    RAISE EXCEPTION 'Seul un opérateur ou un admin peut modifier statut / taux_commission / note_moyenne / pilote';
  END IF;

  IF NEW.note_moyenne IS DISTINCT FROM OLD.note_moyenne
     AND COALESCE(current_setting('maideres.sync_note', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Seul un opérateur ou un admin peut modifier statut / taux_commission / note_moyenne / pilote';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.recalculer_note_moyenne(p_prestataire_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM set_config('maideres.sync_note', 'on', true);
  UPDATE public.prestataires p
     SET note_moyenne = COALESCE((
       SELECT round(avg(a.note)::numeric, 2)
         FROM public.avis a
         JOIN public.matchings m ON m.id = a.matching_id
        WHERE m.prestataire_id = p_prestataire_id
     ), 0)
   WHERE p.id = p_prestataire_id;
  PERFORM set_config('maideres.sync_note', 'off', true);
END;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.trg_avis_sync_note_moyenne()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_prestataire uuid;
BEGIN
  SELECT prestataire_id INTO v_prestataire
    FROM public.matchings WHERE id = COALESCE(NEW.matching_id, OLD.matching_id);
  IF v_prestataire IS NOT NULL THEN
    PERFORM public.recalculer_note_moyenne(v_prestataire);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_avis_sync_note_moyenne ON public.avis;
--> statement-breakpoint
CREATE TRIGGER trg_avis_sync_note_moyenne
  AFTER INSERT OR UPDATE OF note OR DELETE ON public.avis
  FOR EACH ROW EXECUTE FUNCTION public.trg_avis_sync_note_moyenne();
--> statement-breakpoint

-- Rattrapage : recalcule la moyenne de tous les prestataires ayant déjà des avis.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT m.prestataire_id
      FROM public.avis a JOIN public.matchings m ON m.id = a.matching_id
  LOOP
    PERFORM public.recalculer_note_moyenne(r.prestataire_id);
  END LOOP;
END;
$$;
