-- ═══════════════════════════════════════════════════════════════════════════
-- MAIDERES — Calcul automatique de demandes.delai_cible (colonnes ajoutées
-- en 0014 : niveau_urgence, date_souhaitee, delai_cible).
--
-- Adapté du projet de référence (pas copié) : même principe — un délai cible
-- par niveau d'urgence (public.sla_config, créée en 0012), ou la date
-- souhaitée directement quand niveau_urgence='planifie' — mais notre
-- sla_config n'a pas de colonne `actif` (contrairement à la référence),
-- donc pas de filtre dessus ici ; et le seed ci-dessous suit notre
-- convention idempotente (INSERT ... WHERE NOT EXISTS, comme 0011) plutôt
-- que l'INSERT simple de la référence.
--
-- delai_cible n'est JAMAIS renseignée par l'API — uniquement par ce trigger,
-- à l'INSERT et à chaque UPDATE qui touche niveau_urgence ou date_souhaitee.
--
-- Idempotent : CREATE OR REPLACE FUNCTION, DROP TRIGGER IF EXISTS + CREATE,
-- INSERT ... WHERE NOT EXISTS pour le seed.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.calculer_delai_cible(
  _niveau         public.niveau_urgence,
  _base           timestamptz,
  _date_souhaitee timestamptz
) RETURNS timestamptz
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_heures int;
BEGIN
  IF _niveau = 'planifie' AND _date_souhaitee IS NOT NULL THEN
    RETURN _date_souhaitee;
  END IF;

  SELECT delai_heures INTO v_heures FROM public.sla_config WHERE niveau_urgence = _niveau;

  IF v_heures IS NULL THEN
    v_heures := 24; -- repli si ce niveau n'a pas (encore) de ligne sla_config
  END IF;

  RETURN _base + make_interval(hours => v_heures);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_demande_delai_cible()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.delai_cible := public.calculer_delai_cible(NEW.niveau_urgence, COALESCE(NEW.created_at, now()), NEW.date_souhaitee);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_demandes_delai_cible ON public.demandes;
CREATE TRIGGER trg_demandes_delai_cible
  BEFORE INSERT OR UPDATE OF niveau_urgence, date_souhaitee ON public.demandes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_demande_delai_cible();

-- ── Seed : sla_config créée en 0012 mais jamais peuplée — sans ça,
--    calculer_delai_cible retombe systématiquement sur le repli 24h, quel
--    que soit le niveau. Valeurs alignées sur le projet de référence
--    (paramètre métier, pas du code — rien à "adapter" sur un chiffre). ────

INSERT INTO public.sla_config (niveau_urgence, delai_heures)
SELECT v.niveau_urgence, v.delai_heures
FROM (VALUES
  ('immediate'::public.niveau_urgence, 2),
  ('urgent'::public.niveau_urgence,    24),
  ('planifie'::public.niveau_urgence,  72)
) AS v(niveau_urgence, delai_heures)
WHERE NOT EXISTS (SELECT 1 FROM public.sla_config s WHERE s.niveau_urgence = v.niveau_urgence);

-- ── Rétro-calcul pour les demandes déjà existantes (créées avant cette
--    migration, donc delai_cible encore NULL) — sinon l'index de 0014 est
--    inutile sur tout l'historique, et une requête "demandes en retard"
--    les ignorerait silencieusement. ─────────────────────────────────────

UPDATE public.demandes
SET delai_cible = public.calculer_delai_cible(niveau_urgence, created_at, date_souhaitee)
WHERE delai_cible IS NULL;
