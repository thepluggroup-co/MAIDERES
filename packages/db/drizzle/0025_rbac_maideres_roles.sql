-- Fonctions internes MAIDERES. Client et prestataire restent des identités
-- externes déterminées par leurs fiches métier et les policies RLS.
INSERT INTO public.rbac_roles (name, label, description, is_system)
VALUES
  ('SUPER_ADMIN', 'Administrateur plateforme', 'Gouvernance, sécurité et accès total à la plateforme.', true),
  ('OPS_MANAGER', 'Responsable opérations', 'Pilote les opérations, les incidents et les performances.', true),
  ('DISPATCHER', 'Opérateur de mise en relation', 'Traite les demandes, réalise le matching et suit les interventions.', true),
  ('PARTNER_MANAGER', 'Gestionnaire prestataires', 'Recrute, qualifie et accompagne les prestataires partenaires.', true),
  ('FINANCE_MANAGER', 'Gestionnaire des reversements', 'Contrôle les transactions, commissions et reversements.', true),
  ('AUDITOR', 'Consultation interne', 'Consulte les rapports et journaux autorisés, sans action opérationnelle.', true)
ON CONFLICT (name) DO UPDATE SET label = EXCLUDED.label, description = EXCLUDED.description, is_system = true, updated_at = now();
--> statement-breakpoint
DELETE FROM public.rbac_user_profiles up
USING public.profiles p
WHERE up.profile_id = p.id
  AND p.role = 'apprenant'
  AND (EXISTS (SELECT 1 FROM public.clients c WHERE c.profile_id = p.id)
       OR EXISTS (SELECT 1 FROM public.prestataires pr WHERE pr.profile_id = p.id));
--> statement-breakpoint
INSERT INTO public.rbac_user_profiles (profile_id, role_id, is_active)
SELECT p.id, r.id, p.actif
FROM public.profiles p
JOIN public.rbac_roles r ON r.name = CASE
  WHEN p.role = 'admin' THEN 'SUPER_ADMIN'
  WHEN p.role = 'superviseur' THEN 'OPS_MANAGER'
  WHEN p.role = 'operateur' THEN 'DISPATCHER'
  WHEN p.role = 'apprenant' THEN 'AUDITOR'
END::public.rbac_role_name
WHERE p.role <> 'apprenant'
   OR (NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.profile_id = p.id)
       AND NOT EXISTS (SELECT 1 FROM public.prestataires pr WHERE pr.profile_id = p.id))
ON CONFLICT (profile_id) DO UPDATE SET role_id = EXCLUDED.role_id, is_active = EXCLUDED.is_active, updated_at = now();
--> statement-breakpoint
DELETE FROM public.rbac_role_permissions;
DELETE FROM public.rbac_permissions;
DELETE FROM public.rbac_roles
WHERE name IN ('MANAGER', 'COMMERCIAL', 'CAISSIER', 'MAGASINIER', 'FORMATEUR', 'READONLY');
