-- ═══════════════════════════════════════════════════════════════════════════
-- MAIDERES — Suivi terrain (interventions) : RLS + synchro automatique.
--
-- Réutilise les fonctions helper de 0001 (public.is_staff(), is_admin(),
-- own_prestataire_id(), own_client_id()) — RLS n'a pas besoin du contournement
-- auth.role() = 'service_role' vu dans 0004/0005 : ce contournement concernait
-- des TRIGGERS de garde (qui s'exécutent toujours, RLS bypass ou non), pas les
-- policies RLS elles-mêmes (le rôle service_role les bypass nativement côté
-- Postgres — c'est pour ça que 0001 n'a jamais eu besoin de ce correctif).
--
-- Le trigger ci-dessous n'est PAS un trigger de garde (il n'autorise/refuse
-- rien) : c'est un trigger de synchro (journal + demandes + reversements),
-- donc pas concerné par le piège auth.uid()-est-NULL-en-service_role — sauf
-- pour operateur_id, qui sera simplement NULL quand l'écriture vient de l'API
-- (service role), ce qui est le comportement attendu (colonne nullable).
--
-- Idempotent : CREATE OR REPLACE FUNCTION, DROP POLICY/TRIGGER IF EXISTS + CREATE.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── INTERVENTIONS ─────────────────────────────────────────────────────────

ALTER TABLE public.interventions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS interventions_all_staff ON public.interventions;
CREATE POLICY interventions_all_staff ON public.interventions
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS interventions_select_own_prestataire ON public.interventions;
CREATE POLICY interventions_select_own_prestataire ON public.interventions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.matchings m
      WHERE m.id = interventions.matching_id
        AND m.prestataire_id = public.own_prestataire_id()
    )
  );

DROP POLICY IF EXISTS interventions_update_own_prestataire ON public.interventions;
CREATE POLICY interventions_update_own_prestataire ON public.interventions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.matchings m
      WHERE m.id = interventions.matching_id
        AND m.prestataire_id = public.own_prestataire_id()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.matchings m
      WHERE m.id = interventions.matching_id
        AND m.prestataire_id = public.own_prestataire_id()
    )
  );

DROP POLICY IF EXISTS interventions_select_own_client ON public.interventions;
CREATE POLICY interventions_select_own_client ON public.interventions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.matchings m
      JOIN public.demandes d ON d.id = m.demande_id
      WHERE m.id = interventions.matching_id
        AND d.client_id = public.own_client_id()
    )
  );

-- ── INTERVENTION_EVENEMENTS (append-only : aucune policy UPDATE/DELETE,
--    même pour le staff — cf. rbac_audit_logs, même convention) ────────────

ALTER TABLE public.intervention_evenements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS intervention_evenements_select_staff ON public.intervention_evenements;
CREATE POLICY intervention_evenements_select_staff ON public.intervention_evenements
  FOR SELECT USING (public.is_staff());

DROP POLICY IF EXISTS intervention_evenements_insert_staff ON public.intervention_evenements;
CREATE POLICY intervention_evenements_insert_staff ON public.intervention_evenements
  FOR INSERT WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS intervention_evenements_select_own_prestataire ON public.intervention_evenements;
CREATE POLICY intervention_evenements_select_own_prestataire ON public.intervention_evenements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.interventions i
      JOIN public.matchings m ON m.id = i.matching_id
      WHERE i.id = intervention_evenements.intervention_id
        AND m.prestataire_id = public.own_prestataire_id()
    )
  );

DROP POLICY IF EXISTS intervention_evenements_select_own_client ON public.intervention_evenements;
CREATE POLICY intervention_evenements_select_own_client ON public.intervention_evenements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.interventions i
      JOIN public.matchings m ON m.id = i.matching_id
      JOIN public.demandes d ON d.id = m.demande_id
      WHERE i.id = intervention_evenements.intervention_id
        AND d.client_id = public.own_client_id()
    )
  );

-- ── Trigger de synchro : journal d'événements + demande liée + reversement ─
--
-- Priorité de détection (une seule ligne de journal par UPDATE, jamais deux) :
--   1. checkin_at passe de NULL à renseigné  → type 'checkin', force statut='sur_site'
--   2. sinon checkout_at passe de NULL à renseigné → type 'checkout'
--   3. sinon statut différent de l'ancien     → type 'changement_statut'
--   4. sinon rien à journaliser (ex. seul `preuve` a changé)
--
-- Synchro demandes.statut (seulement si le statut a réellement changé) :
--   en_route | sur_site | en_cours → 'en_cours'
--   realisee                       → 'realisee' + amorce un reversement (montant
--                                     placeholder 0, calculé plus tard en Phase 5)
--   annulee | echouee              → 'annulee'
--   planifiee | reportee           → pas de synchro

CREATE OR REPLACE FUNCTION public.sync_intervention_statut()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_demande_id     uuid;
  v_prestataire_id uuid;
  v_event_type     public.type_evenement;
  v_is_checkin     boolean;
  v_is_checkout    boolean;
BEGIN
  NEW.updated_at := now();

  v_is_checkin  := (NEW.checkin_at IS NOT NULL AND OLD.checkin_at IS NULL);
  v_is_checkout := (NEW.checkout_at IS NOT NULL AND OLD.checkout_at IS NULL);

  IF v_is_checkin THEN
    NEW.statut := 'sur_site';
  END IF;

  IF v_is_checkin THEN
    v_event_type := 'checkin';
  ELSIF v_is_checkout THEN
    v_event_type := 'checkout';
  ELSIF NEW.statut IS DISTINCT FROM OLD.statut THEN
    v_event_type := 'changement_statut';
  ELSE
    v_event_type := NULL;
  END IF;

  IF v_event_type IS NOT NULL THEN
    INSERT INTO public.intervention_evenements (intervention_id, type, ancien_statut, nouveau_statut, operateur_id)
    VALUES (NEW.id, v_event_type, OLD.statut, NEW.statut, auth.uid());
  END IF;

  IF NEW.statut IS DISTINCT FROM OLD.statut THEN
    SELECT m.demande_id, m.prestataire_id INTO v_demande_id, v_prestataire_id
    FROM public.matchings m
    WHERE m.id = NEW.matching_id;

    IF NEW.statut IN ('en_route', 'sur_site', 'en_cours') THEN
      UPDATE public.demandes SET statut = 'en_cours' WHERE id = v_demande_id;

    ELSIF NEW.statut = 'realisee' THEN
      UPDATE public.demandes SET statut = 'realisee' WHERE id = v_demande_id;

      INSERT INTO public.reversements (prestataire_id, montant, statut, ref)
      VALUES (v_prestataire_id, 0, 'en_attente', 'intervention:' || NEW.id);

    ELSIF NEW.statut IN ('annulee', 'echouee') THEN
      UPDATE public.demandes SET statut = 'annulee' WHERE id = v_demande_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_intervention_statut ON public.interventions;
CREATE TRIGGER trg_sync_intervention_statut
  BEFORE UPDATE ON public.interventions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_intervention_statut();
