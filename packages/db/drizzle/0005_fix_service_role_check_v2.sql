-- ═══════════════════════════════════════════════════════════════════════════
-- Correctif du correctif (0004) : `current_user` est inutilisable dans une
-- fonction SECURITY DEFINER pour détecter l'appelant — à l'intérieur d'une
-- fonction SECURITY DEFINER, current_user devient le PROPRIÉTAIRE de la
-- fonction (ex. 'postgres'), pas le rôle appelant. `session_user` non plus
-- (reflète le rôle de connexion physique, ex. 'authenticator' derrière
-- PostgREST — jamais littéralement 'service_role'). Vérifié directement en
-- base avant ce correctif (cf. commentaire dans 0004 — l'hypothèse
-- current_user a été testée et infirmée).
--
-- Fix correct : auth.role(), l'idiome Supabase officiel, lit
-- current_setting('request.jwt.claim.role', true) — un GUC positionné par
-- PostgREST à partir du JWT de la requête, qui persiste correctement à
-- travers un contexte SECURITY DEFINER (contrairement à current_user).
--
-- Idempotent : CREATE OR REPLACE FUNCTION.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.guard_prestataire_self_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.is_staff() THEN
    RETURN NEW;
  END IF;

  IF NEW.statut IS DISTINCT FROM OLD.statut
     OR NEW.taux_commission IS DISTINCT FROM OLD.taux_commission
     OR NEW.note_moyenne IS DISTINCT FROM OLD.note_moyenne THEN
    RAISE EXCEPTION 'Seul un opérateur ou un admin peut modifier statut / taux_commission / note_moyenne';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_profile_self_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role OR NEW.actif IS DISTINCT FROM OLD.actif THEN
    RAISE EXCEPTION 'Seul un admin peut modifier role / actif sur profiles';
  END IF;

  RETURN NEW;
END;
$$;
