-- 0033 — Le client peut créer une demande directement depuis une offre
-- publiée sur la fiche publique d'un prestataire (sélection directe), en
-- plus du parcours existant (demande générique, dispatchée ensuite par le
-- staff). `offre_id` garde la traçabilité de ce choix ; nullable, car le
-- parcours générique reste possible et ne référence aucune offre précise.

ALTER TABLE public.demandes
  ADD COLUMN IF NOT EXISTS offre_id uuid REFERENCES public.offres(id) ON DELETE SET NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS demandes_offre_id_idx ON public.demandes (offre_id);
