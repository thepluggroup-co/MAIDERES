-- Corrige recalculer_note_moyenne() (0037_avis_note_moyenne.sql) : la
-- moyenne d'un prestataire doit venir UNIQUEMENT des avis client→prestataire.
--
-- Sans ce correctif, la note que le prestataire donne à SON client (0039,
-- avis.auteur = 'prestataire') se serait mélangée à sa propre note
-- publique — un prestataire aurait littéralement pu influencer sa note
-- affichée en notant ses clients. Bug réel trouvé en fusionnant avec le
-- travail concurrent (trigger écrit avant que la colonne `auteur` existe),
-- pas un problème théorique.
--
-- Migration corrective plutôt que modification de 0037_avis_note_moyenne.sql
-- : ce fichier a pu être appliqué tel quel ailleurs, on ne réécrit pas une
-- migration déjà passée.

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
          AND a.auteur = 'client'
     ), 0)
   WHERE p.id = p_prestataire_id;
  PERFORM set_config('maideres.sync_note', 'off', true);
END;
$$;
--> statement-breakpoint

-- Rattrapage : un avis 'prestataire' a pu être inséré et avoir faussé une
-- moyenne avant ce correctif (peu probable vu l'ordre d'application, mais
-- pas impossible) — on recalcule tout avec la fonction corrigée.
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
