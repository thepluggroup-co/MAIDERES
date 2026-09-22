-- 0038 — Palier 2 : pièces justificatives en PDF + adresse « Mobile ».
--
--  • Documents PDF (pièce d'identité, RCCM, NIU) stockés dans un bucket
--    Supabase Storage PRIVÉ `prestataire-documents` ; la table ne garde que
--    le chemin de l'objet et la date de dépôt.
--    Accès exclusivement via l'API (clé service role) : aucune policy sur
--    storage.objects pour ce bucket, donc aucun accès direct anon/authenticated ;
--    le staff consulte via des URL signées de courte durée.
--  • Adresse : une adresse d'activité OU la case « Mobile » (prestataire qui
--    se déplace uniquement, sans local).
--  • `est_entreprise` : quand il est coché, RCCM et NIU deviennent requis pour
--    le palier 2 (facultatifs pour un prestataire individuel).
--
-- Remplace le choix de minimisation de 0035 (« ni numéro ni photo ») par une
-- décision explicite : les pièces sont conservées, mais dans un espace privé,
-- limité au PDF, 5 Mo max, réservé au staff.

ALTER TABLE public.prestataire_paliers
  ADD COLUMN IF NOT EXISTS adresse_mobile   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS est_entreprise   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS doc_identite_path text,
  ADD COLUMN IF NOT EXISTS doc_identite_at   timestamptz,
  ADD COLUMN IF NOT EXISTS doc_rccm_path     text,
  ADD COLUMN IF NOT EXISTS doc_rccm_at       timestamptz,
  ADD COLUMN IF NOT EXISTS doc_niu_path      text,
  ADD COLUMN IF NOT EXISTS doc_niu_at        timestamptz;
--> statement-breakpoint

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('prestataire-documents', 'prestataire-documents', false, 5242880, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = 5242880,
      allowed_mime_types = ARRAY['application/pdf'];
