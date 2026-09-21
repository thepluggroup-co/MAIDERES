-- RLS pour l'avis bidirectionnel (0036).
--
-- 1) Nouvelle policy d'insertion côté prestataire — miroir exact de
--    avis_insert_own_client, mais sur matchings.prestataire_id (pas besoin
--    de remonter jusqu'à demandes.client_id, prestataire_id est direct).
--    Le statut du matching (doit être 'realise') reste vérifié côté
--    application (POST /api/avis), comme pour le sens client — même
--    répartition RLS/app que l'existant, pas une nouvelle convention.
--
-- 2) avis_select_own_client restreinte à auteur = 'client' : sans ça, un
--    client verrait la note que le prestataire lui a attribuée, ce que
--    Johanne ne voulait explicitement pas (l'intérêt de l'avis
--    prestataire→client est un signal interne — limiter les rendez-vous
--    manqués / adresses fantômes — pas un score public renvoyé au client
--    évalué). avis_select_own_prestataire n'est PAS restreinte de la même
--    façon : le prestataire doit voir les deux avis de son propre
--    matching (celui du client sur lui, et le sien sur le client qu'il a
--    écrit).

DROP POLICY IF EXISTS avis_insert_own_prestataire ON public.avis;
CREATE POLICY avis_insert_own_prestataire ON public.avis
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.matchings m
      WHERE m.id = avis.matching_id
        AND m.prestataire_id = public.own_prestataire_id()
    )
  );

DROP POLICY IF EXISTS avis_select_own_client ON public.avis;
CREATE POLICY avis_select_own_client ON public.avis
  FOR SELECT USING (
    avis.auteur = 'client'
    AND EXISTS (
      SELECT 1 FROM public.matchings m
      JOIN public.demandes d ON d.id = m.demande_id
      WHERE m.id = avis.matching_id
        AND d.client_id = public.own_client_id()
    )
  );
