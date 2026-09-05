-- ═══════════════════════════════════════════════════════════════════════════
-- Correctif : les triggers de garde (0001) bloquaient le service role lui-même.
--
-- auth.uid() est NULL pour une connexion service_role (pas de JWT/session
-- authentifiée dans ce contexte) — public.is_staff() / public.is_admin() y
-- renvoyaient donc toujours false, et les triggers refusaient les écritures
-- légitimes de l'API elle-même (ex. PATCH /api/prestataires/:id/statut),
-- qui tourne en service role. Trouvé par le test d'intégration réel
-- (apps/api/src/__tests__/integration/marketplace-flow.integration.test.ts) —
-- invisible avec un mock, qui ne simule aucun trigger Postgres.
--
-- Fix : bypass explicite quand current_user = 'service_role' (le rôle
-- Postgres sous lequel PostgREST exécute une requête authentifiée par la
-- clé service_role — indépendant de auth.uid()/JWT).
--
-- Idempotent : CREATE OR REPLACE FUNCTION.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.guard_prestataire_self_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF current_user = 'service_role' OR public.is_staff() THEN
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
  IF current_user = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role OR NEW.actif IS DISTINCT FROM OLD.actif THEN
    RAISE EXCEPTION 'Seul un admin peut modifier role / actif sur profiles';
  END IF;

  RETURN NEW;
END;
$$;
