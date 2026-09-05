-- ═══════════════════════════════════════════════════════════════════════════
-- MAIDERES — RLS sur sla_config (créée en 0012).
--
-- Contrairement à commission_config (financier, écriture réservée à
-- is_admin()) ou interventions/intervention_evenements (visibilité partagée
-- avec le prestataire/client concerné), sla_config est un paramètre
-- opérationnel interne pur : aucune surface produit ne l'expose à un
-- prestataire ou un client, et son enjeu (délai cible d'intervention) est
-- moins sensible qu'un taux de commission — une seule policy ALL réservée
-- au staff, à l'image de "operateurs gerent le sla" dans le projet de
-- référence. Un rôle sans policy correspondante (prestataire, client, ou
-- authenticated sans ligne profiles) n'obtient aucune ligne — RLS refuse
-- par défaut en l'absence de policy permissive.
--
-- Idempotent : DROP POLICY IF EXISTS + CREATE.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.sla_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sla_config_all_staff ON public.sla_config;
CREATE POLICY sla_config_all_staff ON public.sla_config
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());
