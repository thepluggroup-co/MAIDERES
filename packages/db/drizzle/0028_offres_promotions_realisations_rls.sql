-- ═══════════════════════════════════════════════════════════════════════════
-- MAIDERES — RLS sur offres/promotions/realisations (suite de 0027).
--
-- Pattern identique aux tables existantes (0001) : staff = accès total ;
-- prestataire = propriétaire de ses propres lignes (public.own_prestataire_id()) ;
-- lecture publique (anon inclus, pas de auth.uid() requis) restreinte aux
-- lignes "publiables" ET dont le prestataire a statut='actif' — jamais les
-- offres/promotions d'un prestataire en_attente/suspendu, même publie=true.
-- Miroir exact du filtre appliqué côté API par /api/public/* (packages/db
-- ne fait ici que rendre ce même filtre vrai aussi pour un futur accès
-- Supabase direct, cf. docs/integration/08-SECURITY-AUDIT.md).
--
-- Idempotent : DROP POLICY IF EXISTS + CREATE, DO $$ EXCEPTION sur la
-- contrainte CHECK, storage bucket en INSERT ... ON CONFLICT DO NOTHING.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Contrainte de plage sur promotions.remise_pct (même pattern que avis.note, 0001) ──

DO $$ BEGIN
  ALTER TABLE public.promotions ADD CONSTRAINT promotions_remise_pct_range CHECK (remise_pct > 0 AND remise_pct <= 100);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ── OFFRES ─────────────────────────────────────────────────────────────

ALTER TABLE public.offres ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS offres_all_staff ON public.offres;
CREATE POLICY offres_all_staff ON public.offres
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS offres_all_own_prestataire ON public.offres;
CREATE POLICY offres_all_own_prestataire ON public.offres
  FOR ALL USING (prestataire_id = public.own_prestataire_id())
  WITH CHECK (prestataire_id = public.own_prestataire_id());

DROP POLICY IF EXISTS offres_select_public ON public.offres;
CREATE POLICY offres_select_public ON public.offres
  FOR SELECT USING (
    publie = true
    AND EXISTS (SELECT 1 FROM public.prestataires p WHERE p.id = offres.prestataire_id AND p.statut = 'actif')
  );

-- ── PROMOTIONS ─────────────────────────────────────────────────────────

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS promotions_all_staff ON public.promotions;
CREATE POLICY promotions_all_staff ON public.promotions
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS promotions_all_own_prestataire ON public.promotions;
CREATE POLICY promotions_all_own_prestataire ON public.promotions
  FOR ALL USING (prestataire_id = public.own_prestataire_id())
  WITH CHECK (prestataire_id = public.own_prestataire_id());

DROP POLICY IF EXISTS promotions_select_public ON public.promotions;
CREATE POLICY promotions_select_public ON public.promotions
  FOR SELECT USING (
    active = true
    AND EXISTS (SELECT 1 FROM public.prestataires p WHERE p.id = promotions.prestataire_id AND p.statut = 'actif')
  );

-- ── REALISATIONS ───────────────────────────────────────────────────────
-- Pas de colonne "publié" ici (miroir du comportement d'origine maidere-connect :
-- une réalisation ajoutée par le prestataire est visible dès qu'il est actif).

ALTER TABLE public.realisations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS realisations_all_staff ON public.realisations;
CREATE POLICY realisations_all_staff ON public.realisations
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS realisations_all_own_prestataire ON public.realisations;
CREATE POLICY realisations_all_own_prestataire ON public.realisations
  FOR ALL USING (prestataire_id = public.own_prestataire_id())
  WITH CHECK (prestataire_id = public.own_prestataire_id());

DROP POLICY IF EXISTS realisations_select_public ON public.realisations;
CREATE POLICY realisations_select_public ON public.realisations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.prestataires p WHERE p.id = realisations.prestataire_id AND p.statut = 'actif')
  );

-- ── PRESTATAIRES — lecture publique élargie (0027 ajoute la vitrine connect) ──
-- La policy existante prestataires_select_actifs_client (0001) exige déjà
-- own_client_id() IS NOT NULL, donc n'autorise pas un visiteur anonyme.
-- Celle-ci la complète (OR logique entre policies RLS) sans la retirer.

DROP POLICY IF EXISTS prestataires_select_public ON public.prestataires;
CREATE POLICY prestataires_select_public ON public.prestataires
  FOR SELECT USING (statut = 'actif');

-- ── STORAGE — bucket "maideres" pour la galerie de réalisations ──────────
-- Chemin d'objet : "<profile_id auth.uid()>/<timestamp>-<nom fichier>"
-- (convention héritée telle quelle de maidere-connect, cf.
-- docs/integration/02-DATABASE-MAPPING.md). Lecture publique (galerie
-- affichée aux visiteurs anonymes) ; écriture/suppression restreintes au
-- propriétaire du dossier.

INSERT INTO storage.buckets (id, name, public)
VALUES ('maideres', 'maideres', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS maideres_bucket_select_public ON storage.objects;
CREATE POLICY maideres_bucket_select_public ON storage.objects
  FOR SELECT USING (bucket_id = 'maideres');

DROP POLICY IF EXISTS maideres_bucket_write_own_folder ON storage.objects;
CREATE POLICY maideres_bucket_write_own_folder ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'maideres' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS maideres_bucket_update_own_folder ON storage.objects;
CREATE POLICY maideres_bucket_update_own_folder ON storage.objects
  FOR UPDATE USING (bucket_id = 'maideres' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS maideres_bucket_delete_own_folder ON storage.objects;
CREATE POLICY maideres_bucket_delete_own_folder ON storage.objects
  FOR DELETE USING (bucket_id = 'maideres' AND (storage.foldername(name))[1] = auth.uid()::text);
