-- 0036 — Correctif : guard_prestataire_self_update() doit laisser passer les
-- écritures sans session utilisateur Supabase (API en service role, migrations).
--
-- Régression introduite par 0034 : en ajoutant `pilote` à la garde, cette
-- migration a recréé la fonction à partir de la version 0001, en perdant le
-- contournement `auth.uid() IS NULL` posé par 0004/0005/0011. Or l'API
-- MAIDERES écrit avec la clé service role : auth.uid() y est NULL et
-- is_staff() (qui lit le profil de auth.uid()) vaut donc false → toute
-- modification de statut / taux_commission / pilote depuis l'ERP (valider,
-- suspendre, marquer pilote) échouait avec « Seul un opérateur ou un admin
-- peut modifier statut / taux_commission / note_moyenne / pilote ».
--
-- Cette version cumule les deux : le contournement de 0011 ET la garde
-- `pilote` de 0034. Un prestataire authentifié (auth.uid() = son id) reste
-- bloqué sur ces colonnes en accès direct à la table.
--
-- Idempotent : CREATE OR REPLACE FUNCTION. À rejouer après tout rejeu de 0034.

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
     OR NEW.note_moyenne IS DISTINCT FROM OLD.note_moyenne
     OR NEW.pilote IS DISTINCT FROM OLD.pilote THEN
    RAISE EXCEPTION 'Seul un opérateur ou un admin peut modifier statut / taux_commission / note_moyenne / pilote';
  END IF;

  RETURN NEW;
END;
$$;
