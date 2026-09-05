-- ═══════════════════════════════════════════════════════════════════════════
-- MAIDERES — Corrige une récursion infinie RLS entre demandes ↔ matchings.
--
-- demandes_select_own_prestataire (sur demandes) interrogeait matchings ;
-- matchings_select_own_client (sur matchings) interrogeait demandes en
-- retour. RLS étant actif sur les deux tables, chaque évaluation
-- redéclenchait l'autre → "infinite recursion detected in policy" (42P17)
-- sur toute lecture directe de demandes/matchings/transactions par un
-- client ou un prestataire (anon/authenticated key, hors service role).
--
-- Fix : mêmes conditions, mais via des fonctions SECURITY DEFINER (comme
-- own_prestataire_id / own_client_id / is_staff plus haut) — elles
-- contournent RLS pour la vérification d'appartenance elle-même, sans
-- jamais renvoyer de données au-delà d'un booléen.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.demande_has_own_prestataire_matching(p_demande_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.matchings m
    WHERE m.demande_id = p_demande_id
      AND m.prestataire_id = public.own_prestataire_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.matching_demande_belongs_to_own_client(p_demande_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.demandes d
    WHERE d.id = p_demande_id
      AND d.client_id = public.own_client_id()
  );
$$;

DROP POLICY IF EXISTS demandes_select_own_prestataire ON public.demandes;
CREATE POLICY demandes_select_own_prestataire ON public.demandes
  FOR SELECT USING (public.demande_has_own_prestataire_matching(id));

DROP POLICY IF EXISTS matchings_select_own_client ON public.matchings;
CREATE POLICY matchings_select_own_client ON public.matchings
  FOR SELECT USING (public.matching_demande_belongs_to_own_client(demande_id));
