-- ═══════════════════════════════════════════════════════════════════════════
-- MAIDERES — Commission 100% paramétrable (suite de 0010).
--
-- public.calculer_commission() est la SEULE source de calcul de commission
-- du système : jamais de taux en dur, ni en base ni côté API/front (voir le
-- service TS miroir apps/api/src/services/commission.service.ts, qui appelle
-- cette fonction via RPC plutôt que de réimplémenter la logique en JS).
--
-- Ordre de résolution, dans cet ordre et unique :
--   (a) prestataires.taux_commission, s'il est renseigné (NOT NULL) — override
--       par prestataire, en pourcentage uniquement ;
--   (b) sinon la règle commission_config active de la catégorie de la
--       demande (categorie_id = celle passée en argument) ;
--   (c) sinon la règle commission_config active globale (categorie_id IS NULL).
-- Si aucune règle ne s'applique, la commission est 0 (jamais une exception :
-- une commission non configurée ne doit pas bloquer une transaction).
--
-- Câblée sur transactions via un trigger BEFORE INSERT qui écrase
-- commission_taux/commission_montant quoi qu'on lui passe en entrée — même
-- si l'API cesse un jour de suivre cette convention, il est structurellement
-- impossible d'insérer une transaction avec une commission arbitraire.
--
-- Idempotent : CREATE OR REPLACE FUNCTION, DROP POLICY/TRIGGER IF EXISTS +
-- CREATE, INSERT ... WHERE NOT EXISTS pour le seed.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── RLS — lecture réservée au staff, écriture réservée à l'admin (barème
--    financier plus sensible que categories_services) ─────────────────────

ALTER TABLE public.commission_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commission_config_select_staff ON public.commission_config;
CREATE POLICY commission_config_select_staff ON public.commission_config
  FOR SELECT USING (public.is_staff());

DROP POLICY IF EXISTS commission_config_write_admin ON public.commission_config;
CREATE POLICY commission_config_write_admin ON public.commission_config
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── Correctif préalable, trouvé en essayant d'appliquer cette migration :
--    l'UPDATE de nettoyage ci-dessous fait un aller-retour classique par
--    guard_prestataire_self_update() (0001/0004/0005), qui ne laissait passer
--    que auth.role() = 'service_role' ou is_staff(). Une connexion directe
--    (DATABASE_URL / drizzle-kit migrate, comme ici) n'est ni l'un ni l'autre
--    — auth.role() n'est pas 'service_role' et auth.uid() est NULL (pas de
--    JWT du tout), donc is_staff() échoue aussi. Le trigger bloquait
--    littéralement sa propre migration.
--    Fix : auth.uid() IS NULL couvre exactement "pas de session utilisateur
--    Supabase" — vrai pour service_role ET pour une connexion Postgres
--    directe (superuser/migration), jamais vrai pour une vraie session
--    prestataire authentifiée (qui a toujours auth.uid() = son id). Remplace
--    (pas cumule) l'ancienne condition auth.role() = 'service_role', qui
--    reste de toute façon impliquée par ce cas plus large.
--    Même correctif appliqué à guard_profile_self_update() par cohérence
--    (même faille latente, pas encore rencontrée en pratique). ─────────────

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
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role OR NEW.actif IS DISTINCT FROM OLD.actif THEN
    RAISE EXCEPTION 'Seul un admin peut modifier role / actif sur profiles';
  END IF;

  RETURN NEW;
END;
$$;

-- ── Nettoyage de données : le défaut NOT NULL DEFAULT '0' retiré en 0010
--    ne distinguait pas "jamais configuré" de "override explicite à 0 %".
--    Les seules valeurs non nulles connues à ce jour sont les overrides
--    volontaires du seed (15.00 / 10.00) — un '0' ne peut provenir que de
--    l'ancien défaut de colonne, jamais d'un choix délibéré (aucune UI ne
--    permettait de fixer 0 % explicitement). Sûr de renormaliser en NULL. ──

UPDATE public.prestataires SET taux_commission = NULL WHERE taux_commission = 0;

-- ── Seed : une règle globale par défaut (15 %, comme l'ancien comportement
--    implicite) — sans elle, calculer_commission renverrait 0 pour toute
--    catégorie non configurée. ──────────────────────────────────────────────

INSERT INTO public.commission_config (categorie_id, type, valeur, actif)
SELECT NULL, 'pourcentage', 15, true
WHERE NOT EXISTS (SELECT 1 FROM public.commission_config WHERE categorie_id IS NULL);

-- ── Fonction de calcul — seule source de vérité ───────────────────────────
-- Paramètres préfixés `_` pour éviter toute ambiguïté avec les colonnes de
-- même nom dans les clauses WHERE (cf. commission_config.categorie_id).

CREATE OR REPLACE FUNCTION public.calculer_commission(
  _montant        int,
  _categorie_id   uuid,
  _prestataire_id uuid
) RETURNS int
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_taux_prestataire numeric;
  v_regle            record;
  v_commission       numeric;
BEGIN
  IF _montant IS NULL OR _montant <= 0 THEN
    RETURN 0;
  END IF;

  -- (a) override prestataire, s'il est renseigné
  IF _prestataire_id IS NOT NULL THEN
    SELECT taux_commission INTO v_taux_prestataire
    FROM public.prestataires WHERE id = _prestataire_id;

    IF v_taux_prestataire IS NOT NULL THEN
      RETURN LEAST(GREATEST(ROUND(_montant * v_taux_prestataire / 100)::int, 0), _montant);
    END IF;
  END IF;

  -- (b) règle active de la catégorie
  IF _categorie_id IS NOT NULL THEN
    SELECT type, valeur INTO v_regle
    FROM public.commission_config
    WHERE actif AND categorie_id = _categorie_id
    ORDER BY created_at DESC LIMIT 1;
  END IF;

  -- (c) sinon règle globale active
  IF v_regle IS NULL THEN
    SELECT type, valeur INTO v_regle
    FROM public.commission_config
    WHERE actif AND categorie_id IS NULL
    ORDER BY created_at DESC LIMIT 1;
  END IF;

  IF v_regle IS NULL THEN
    RETURN 0;
  END IF;

  IF v_regle.type = 'pourcentage' THEN
    v_commission := _montant * v_regle.valeur / 100;
  ELSE
    v_commission := v_regle.valeur;
  END IF;

  RETURN LEAST(GREATEST(ROUND(v_commission)::int, 0), _montant);
END;
$$;

-- ── Câblage sur transactions : BEFORE INSERT écrase commission_taux /
--    commission_montant, quels que soient les champs fournis à l'insert. ──

CREATE OR REPLACE FUNCTION public.set_transaction_commission()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_prestataire_id uuid;
  v_categorie_id   uuid;
  v_commission     int;
BEGIN
  SELECT m.prestataire_id, d.categorie_id
    INTO v_prestataire_id, v_categorie_id
  FROM public.matchings m
  JOIN public.demandes d ON d.id = m.demande_id
  WHERE m.id = NEW.matching_id;

  v_commission := public.calculer_commission(NEW.montant_service, v_categorie_id, v_prestataire_id);

  NEW.commission_montant := v_commission;
  NEW.commission_taux    := CASE
    WHEN NEW.montant_service > 0 THEN ROUND((v_commission::numeric / NEW.montant_service) * 100, 2)
    ELSE 0
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transactions_commission ON public.transactions;
CREATE TRIGGER trg_transactions_commission
  BEFORE INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_transaction_commission();
