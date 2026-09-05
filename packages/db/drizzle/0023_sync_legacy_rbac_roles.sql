-- Synchronisation du modèle historique profiles.role avec le RBAC.
-- profiles.role reste la source de vérité pour l'identité legacy/JWT ;
-- rbac_user_profiles fournit les permissions détaillées correspondantes.

INSERT INTO public.rbac_roles (name, label, description, is_system)
VALUES
  ('SUPER_ADMIN', 'Super Administrateur', 'Accès total, non restreint', true),
  ('MANAGER', 'Manager', 'Gestion complète hors administration système', true),
  ('COMMERCIAL', 'Commercial', 'Accès opérationnel commercial', true),
  ('CAISSIER', 'Caissier', 'Encaissements et créances', true),
  ('MAGASINIER', 'Magasinier', 'Stocks et logistique', true),
  ('FORMATEUR', 'Formateur', 'Ressources humaines et rapports', true),
  ('READONLY', 'Lecture seule', 'Consultation sans écriture', true)
ON CONFLICT (name) DO UPDATE
SET label = EXCLUDED.label,
    description = EXCLUDED.description,
    is_system = true,
    updated_at = now();
--> statement-breakpoint

INSERT INTO public.rbac_user_profiles (profile_id, role_id, is_active)
SELECT
  p.id,
  r.id,
  p.actif
FROM public.profiles p
JOIN public.rbac_roles r ON r.name = CASE p.role::text
  WHEN 'admin' THEN 'SUPER_ADMIN'
  WHEN 'superviseur' THEN 'MANAGER'
  WHEN 'operateur' THEN 'COMMERCIAL'
  WHEN 'apprenant' THEN 'READONLY'
END::public.rbac_role_name
ON CONFLICT (profile_id) DO UPDATE
SET role_id = EXCLUDED.role_id,
    is_active = EXCLUDED.is_active,
    updated_at = now();
