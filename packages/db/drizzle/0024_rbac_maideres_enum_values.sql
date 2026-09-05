-- Ajout des valeurs métier ; les valeurs ERP existantes sont conservées dans
-- l'enum PostgreSQL afin de préserver les éventuels journaux historiques.
ALTER TYPE public.rbac_module ADD VALUE IF NOT EXISTS 'DEMANDES';
ALTER TYPE public.rbac_module ADD VALUE IF NOT EXISTS 'MATCHING';
ALTER TYPE public.rbac_module ADD VALUE IF NOT EXISTS 'PRESTATAIRES';
ALTER TYPE public.rbac_module ADD VALUE IF NOT EXISTS 'CLIENTS';
ALTER TYPE public.rbac_module ADD VALUE IF NOT EXISTS 'INTERVENTIONS';
ALTER TYPE public.rbac_module ADD VALUE IF NOT EXISTS 'TRANSACTIONS';
ALTER TYPE public.rbac_module ADD VALUE IF NOT EXISTS 'REVERSEMENTS';
ALTER TYPE public.rbac_module ADD VALUE IF NOT EXISTS 'PARAMETRAGE';
ALTER TYPE public.rbac_module ADD VALUE IF NOT EXISTS 'UTILISATEURS';
ALTER TYPE public.rbac_module ADD VALUE IF NOT EXISTS 'AUDIT';
--> statement-breakpoint
ALTER TYPE public.rbac_role_name ADD VALUE IF NOT EXISTS 'OPS_MANAGER';
ALTER TYPE public.rbac_role_name ADD VALUE IF NOT EXISTS 'DISPATCHER';
ALTER TYPE public.rbac_role_name ADD VALUE IF NOT EXISTS 'PARTNER_MANAGER';
ALTER TYPE public.rbac_role_name ADD VALUE IF NOT EXISTS 'FINANCE_MANAGER';
ALTER TYPE public.rbac_role_name ADD VALUE IF NOT EXISTS 'AUDITOR';
