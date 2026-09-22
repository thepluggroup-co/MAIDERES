-- 0035 — Dossier prestataire en 3 paliers (VERSION PROVISOIRE).
--
-- Palier 1 (matchable)  : calculé à partir de `prestataires` + `offres`, rien à stocker ici.
-- Palier 2 (vérifié)    : identité, adresse d'activité, réalisations, références, CGU.
-- Palier 3 (paiement)   : Mobile Money, statut fiscal, commission convenue.
--
-- Provisoire = purement informatif : aucun palier ne bloque l'activation
-- d'un prestataire (statut) ni une mise en relation. Le niveau atteint est
-- calculé côté applicatif (packages/contracts/src/paliers.ts), jamais stocké,
-- pour ne pas dériver des données sources.
--
-- Minimisation des données : aucun numéro de pièce d'identité ni photo n'est
-- stocké — seulement le TYPE de pièce vue et la date de vérification par le
-- staff. Table réservée au staff (RLS) : le prestataire n'y a pas accès.

CREATE TABLE IF NOT EXISTS public.prestataire_paliers (
  prestataire_id          uuid PRIMARY KEY REFERENCES public.prestataires(id) ON DELETE CASCADE,

  -- Palier 2
  identite_type           text CHECK (identite_type IN ('cni', 'passeport', 'recepisse', 'niu_rccm')),
  identite_verifiee_at    timestamptz,
  adresse_activite        text,
  realisations_verifiees  boolean NOT NULL DEFAULT false,
  references_contacts     jsonb NOT NULL DEFAULT '[]'::jsonb,
  conditions_acceptees_at timestamptz,
  verifie_par             uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  verifie_at              timestamptz,

  -- Palier 3
  mm_operateur            text CHECK (mm_operateur IN ('mtn', 'orange')),
  mm_numero               text,
  mm_titulaire            text,
  statut_fiscal           text,
  commission_convenue_at  timestamptz,

  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

ALTER TABLE public.prestataire_paliers ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

DROP POLICY IF EXISTS prestataire_paliers_all_staff ON public.prestataire_paliers;
--> statement-breakpoint
CREATE POLICY prestataire_paliers_all_staff ON public.prestataire_paliers
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());
