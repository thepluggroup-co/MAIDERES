-- ═══════════════════════════════════════════════════════════════════════════
-- MAIDERES — RLS par rôle (admin, opérateur, prestataire, client)
--
-- profiles.role reste admin|superviseur|operateur|apprenant (non renommé,
-- cf. contrainte Phase 1). "prestataire" et "client" ne sont PAS des valeurs
-- de profiles.role : ce sont des identités dérivées de l'existence d'une
-- ligne dans prestataires/clients dont profile_id = auth.uid(). C'est ce
-- que les fonctions helper ci-dessous encodent.
--
-- Idempotent : SECURITY DEFINER functions en CREATE OR REPLACE, policies
-- en DROP IF EXISTS + CREATE.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Fonctions helper (SECURITY DEFINER : bypass RLS pour la vérification
--    d'identité elle-même, ne renvoient jamais de données au-delà du rôle
--    / des ids liés à auth.uid()) ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.current_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role::text FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'operateur', 'superviseur'),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'admin', false);
$$;

CREATE OR REPLACE FUNCTION public.own_prestataire_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.prestataires WHERE profile_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.own_client_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.clients WHERE profile_id = auth.uid();
$$;

-- ── Contrainte de plage sur avis.note (1 à 5) ─────────────────────────────

DO $$ BEGIN
  ALTER TABLE public.avis ADD CONSTRAINT avis_note_range CHECK (note BETWEEN 1 AND 5);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ── Garde-fou : un prestataire ne peut pas s'auto-activer / changer sa
--    commission / sa note via un UPDATE direct — seul le staff le peut.
--    (Défense en profondeur ; l'API Phase 2 utilise le service role qui
--    bypass RLS et n'est donc pas affectée par ce trigger.) ──────────────

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
     OR NEW.note_moyenne IS DISTINCT FROM OLD.note_moyenne THEN
    RAISE EXCEPTION 'Seul un opérateur ou un admin peut modifier statut / taux_commission / note_moyenne';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_prestataire_self_update ON public.prestataires;
CREATE TRIGGER trg_guard_prestataire_self_update
  BEFORE UPDATE ON public.prestataires
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_prestataire_self_update();

-- ── Idem sur profiles : un utilisateur ne peut pas changer son propre
--    rôle ni se réactiver/désactiver lui-même. ────────────────────────────

CREATE OR REPLACE FUNCTION public.guard_profile_self_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role OR NEW.actif IS DISTINCT FROM OLD.actif THEN
    RAISE EXCEPTION 'Seul un admin peut modifier role / actif sur profiles';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_self_update ON public.profiles;
CREATE TRIGGER trg_guard_profile_self_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_self_update();

-- ── PROFILES ───────────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_own_or_staff ON public.profiles;
CREATE POLICY profiles_select_own_or_staff ON public.profiles
  FOR SELECT USING (id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS profiles_update_own_or_admin ON public.profiles;
CREATE POLICY profiles_update_own_or_admin ON public.profiles
  FOR UPDATE USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS profiles_insert_admin ON public.profiles;
CREATE POLICY profiles_insert_admin ON public.profiles
  FOR INSERT WITH CHECK (public.is_admin());

-- ── CATEGORIES_SERVICES (lecture publique des catégories actives) ────────

ALTER TABLE public.categories_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS categories_select_actives ON public.categories_services;
CREATE POLICY categories_select_actives ON public.categories_services
  FOR SELECT USING (actif = true OR public.is_staff());

DROP POLICY IF EXISTS categories_write_admin ON public.categories_services;
CREATE POLICY categories_write_admin ON public.categories_services
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── PRESTATAIRES ───────────────────────────────────────────────────────
-- Un client ne voit que les prestataires actifs (jamais en_attente/suspendu).

ALTER TABLE public.prestataires ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS prestataires_all_staff ON public.prestataires;
CREATE POLICY prestataires_all_staff ON public.prestataires
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS prestataires_select_own ON public.prestataires;
CREATE POLICY prestataires_select_own ON public.prestataires
  FOR SELECT USING (profile_id = auth.uid());

DROP POLICY IF EXISTS prestataires_select_actifs_client ON public.prestataires;
CREATE POLICY prestataires_select_actifs_client ON public.prestataires
  FOR SELECT USING (statut = 'actif' AND public.own_client_id() IS NOT NULL);

DROP POLICY IF EXISTS prestataires_insert_self ON public.prestataires;
CREATE POLICY prestataires_insert_self ON public.prestataires
  FOR INSERT WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS prestataires_update_own ON public.prestataires;
CREATE POLICY prestataires_update_own ON public.prestataires
  FOR UPDATE USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());

-- ── CLIENTS ────────────────────────────────────────────────────────────

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clients_all_staff ON public.clients;
CREATE POLICY clients_all_staff ON public.clients
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS clients_select_own ON public.clients;
CREATE POLICY clients_select_own ON public.clients
  FOR SELECT USING (profile_id = auth.uid());

DROP POLICY IF EXISTS clients_insert_self ON public.clients;
CREATE POLICY clients_insert_self ON public.clients
  FOR INSERT WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS clients_update_own ON public.clients;
CREATE POLICY clients_update_own ON public.clients
  FOR UPDATE USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());

-- ── DEMANDES ───────────────────────────────────────────────────────────

ALTER TABLE public.demandes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS demandes_all_staff ON public.demandes;
CREATE POLICY demandes_all_staff ON public.demandes
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS demandes_select_own_client ON public.demandes;
CREATE POLICY demandes_select_own_client ON public.demandes
  FOR SELECT USING (client_id = public.own_client_id());

DROP POLICY IF EXISTS demandes_select_own_prestataire ON public.demandes;
CREATE POLICY demandes_select_own_prestataire ON public.demandes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.matchings m
      WHERE m.demande_id = demandes.id
        AND m.prestataire_id = public.own_prestataire_id()
    )
  );

DROP POLICY IF EXISTS demandes_insert_own_client ON public.demandes;
CREATE POLICY demandes_insert_own_client ON public.demandes
  FOR INSERT WITH CHECK (client_id = public.own_client_id());

-- ── MATCHINGS ──────────────────────────────────────────────────────────

ALTER TABLE public.matchings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS matchings_all_staff ON public.matchings;
CREATE POLICY matchings_all_staff ON public.matchings
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS matchings_select_own_prestataire ON public.matchings;
CREATE POLICY matchings_select_own_prestataire ON public.matchings
  FOR SELECT USING (prestataire_id = public.own_prestataire_id());

DROP POLICY IF EXISTS matchings_update_own_prestataire ON public.matchings;
CREATE POLICY matchings_update_own_prestataire ON public.matchings
  FOR UPDATE USING (prestataire_id = public.own_prestataire_id())
  WITH CHECK (prestataire_id = public.own_prestataire_id());

DROP POLICY IF EXISTS matchings_select_own_client ON public.matchings;
CREATE POLICY matchings_select_own_client ON public.matchings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.demandes d
      WHERE d.id = matchings.demande_id
        AND d.client_id = public.own_client_id()
    )
  );

-- ── TRANSACTIONS ───────────────────────────────────────────────────────

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS transactions_all_staff ON public.transactions;
CREATE POLICY transactions_all_staff ON public.transactions
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS transactions_select_own_prestataire ON public.transactions;
CREATE POLICY transactions_select_own_prestataire ON public.transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.matchings m
      WHERE m.id = transactions.matching_id
        AND m.prestataire_id = public.own_prestataire_id()
    )
  );

DROP POLICY IF EXISTS transactions_select_own_client ON public.transactions;
CREATE POLICY transactions_select_own_client ON public.transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.matchings m
      JOIN public.demandes d ON d.id = m.demande_id
      WHERE m.id = transactions.matching_id
        AND d.client_id = public.own_client_id()
    )
  );

-- ── AVIS ───────────────────────────────────────────────────────────────

ALTER TABLE public.avis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS avis_all_staff ON public.avis;
CREATE POLICY avis_all_staff ON public.avis
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS avis_select_own_prestataire ON public.avis;
CREATE POLICY avis_select_own_prestataire ON public.avis
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.matchings m
      WHERE m.id = avis.matching_id
        AND m.prestataire_id = public.own_prestataire_id()
    )
  );

DROP POLICY IF EXISTS avis_select_own_client ON public.avis;
CREATE POLICY avis_select_own_client ON public.avis
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.matchings m
      JOIN public.demandes d ON d.id = m.demande_id
      WHERE m.id = avis.matching_id
        AND d.client_id = public.own_client_id()
    )
  );

DROP POLICY IF EXISTS avis_insert_own_client ON public.avis;
CREATE POLICY avis_insert_own_client ON public.avis
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.matchings m
      JOIN public.demandes d ON d.id = m.demande_id
      WHERE m.id = avis.matching_id
        AND d.client_id = public.own_client_id()
    )
  );

-- ── REVERSEMENTS ───────────────────────────────────────────────────────

ALTER TABLE public.reversements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reversements_all_staff ON public.reversements;
CREATE POLICY reversements_all_staff ON public.reversements
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS reversements_select_own_prestataire ON public.reversements;
CREATE POLICY reversements_select_own_prestataire ON public.reversements
  FOR SELECT USING (prestataire_id = public.own_prestataire_id());

-- ── NOTIFICATIONS_LOG ──────────────────────────────────────────────────

ALTER TABLE public.notifications_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_all_staff ON public.notifications_log;
CREATE POLICY notifications_all_staff ON public.notifications_log
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS notifications_select_own ON public.notifications_log;
CREATE POLICY notifications_select_own ON public.notifications_log
  FOR SELECT USING (cible = auth.uid());
