-- ═══════════════════════════════════════════════════════════════════════════
-- MAIDERES — RLS : le prestataire concerné peut répondre à un avis (0029).
--
-- Pas de garde-trigger séparée (contrairement à statut/taux_commission/
-- note_moyenne sur prestataires, 0001) : `reponse` n'est pas un champ
-- sensible au sens financier/statutaire, et la seule route qui écrit ici
-- (PATCH /api/avis/:id, apps/api) n'expose jamais note/commentaire en
-- écriture pour un non-staff — même niveau de confiance que les autres
-- champs "self" de prestataires/clients, qui n'ont pas non plus de trigger
-- dédié.
--
-- Idempotent : DROP POLICY IF EXISTS + CREATE.
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS avis_update_own_prestataire ON public.avis;
CREATE POLICY avis_update_own_prestataire ON public.avis
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.matchings m
      WHERE m.id = avis.matching_id
        AND m.prestataire_id = public.own_prestataire_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.matchings m
      WHERE m.id = avis.matching_id
        AND m.prestataire_id = public.own_prestataire_id()
    )
  );
