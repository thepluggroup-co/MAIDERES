-- MAIDERES — RBAC : rôles, permissions et profils de sécurité utilisateurs.
-- Cette migration est idempotente pour pouvoir être appliquée aux environnements
-- déjà initialisés, sans modifier la table legacy public.profiles.

DO $$ BEGIN
  CREATE TYPE public.rbac_module AS ENUM (
    'STOCK', 'COMMERCIAL', 'FINANCE', 'HR', 'PRODUCTION',
    'LOGISTICS', 'ADMIN', 'REPORTS', 'RECEIVABLES'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE public.rbac_action AS ENUM (
    'READ', 'CREATE', 'UPDATE', 'DELETE', 'VALIDATE', 'CONFIGURE', 'EXPORT'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE public.rbac_role_name AS ENUM (
    'SUPER_ADMIN', 'MANAGER', 'COMMERCIAL', 'CAISSIER',
    'MAGASINIER', 'FORMATEUR', 'READONLY'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE public.audit_action_type AS ENUM (
    'ACCESS_DENIED', 'USER_CREATED', 'USER_UPDATED', 'USER_DEACTIVATED', 'USER_DELETED',
    'ROLE_CHANGED', 'PERMISSION_CHANGED', 'SETTINGS_CHANGED',
    'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'DATA_EXPORT',
    'PASSWORD_RESET', 'PASSWORD_CHANGED', 'SESSION_EXPIRED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.rbac_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  name public.rbac_role_name NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.rbac_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  module public.rbac_module NOT NULL,
  action public.rbac_action NOT NULL,
  label text NOT NULL,
  description text,
  is_immutable boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT rbac_permissions_module_action_unique UNIQUE (module, action)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.rbac_role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  role_id uuid NOT NULL REFERENCES public.rbac_roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.rbac_permissions(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT rbac_role_permissions_role_permission_unique UNIQUE (role_id, permission_id)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.rbac_user_profiles (
  profile_id uuid PRIMARY KEY NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.rbac_roles(id),
  is_active boolean NOT NULL DEFAULT true,
  password_must_change boolean NOT NULL DEFAULT false,
  last_login_at timestamp with time zone,
  session_timeout_minutes integer NOT NULL DEFAULT 60 CHECK (session_timeout_minutes > 0),
  failed_login_count integer NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
  locked_until timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.rbac_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action_type public.audit_action_type NOT NULL,
  module public.rbac_module,
  resource_type text,
  resource_id text,
  payload_before jsonb,
  payload_after jsonb,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.rbac_security_settings (
  id text PRIMARY KEY NOT NULL DEFAULT 'singleton' CHECK (id = 'singleton'),
  password_min_length integer NOT NULL DEFAULT 8 CHECK (password_min_length > 0),
  password_require_upper boolean NOT NULL DEFAULT true,
  password_require_number boolean NOT NULL DEFAULT true,
  password_require_special boolean NOT NULL DEFAULT false,
  password_expiration_days integer NOT NULL DEFAULT 90 CHECK (password_expiration_days >= 0),
  max_login_attempts integer NOT NULL DEFAULT 5 CHECK (max_login_attempts > 0),
  lockout_duration_minutes integer NOT NULL DEFAULT 30 CHECK (lockout_duration_minutes > 0),
  session_timeout_minutes integer NOT NULL DEFAULT 60 CHECK (session_timeout_minutes > 0),
  allowed_hours_enabled boolean NOT NULL DEFAULT false,
  allowed_hours_start text NOT NULL DEFAULT '08:00',
  allowed_hours_end text NOT NULL DEFAULT '18:00',
  allowed_days text NOT NULL DEFAULT '1,2,3,4,5',
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.rbac_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  email text NOT NULL,
  ip_address text,
  success boolean NOT NULL DEFAULT false,
  user_agent text,
  attempted_at timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS rbac_role_permissions_permission_id_idx ON public.rbac_role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS rbac_user_profiles_role_id_idx ON public.rbac_user_profiles(role_id);
CREATE INDEX IF NOT EXISTS rbac_audit_logs_user_created_at_idx ON public.rbac_audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS rbac_audit_logs_action_created_at_idx ON public.rbac_audit_logs(action_type, created_at DESC);
CREATE INDEX IF NOT EXISTS rbac_login_attempts_email_ip_attempted_at_idx ON public.rbac_login_attempts(email, ip_address, attempted_at DESC);
--> statement-breakpoint

-- Les tables ne sont accessibles directement qu'en lecture aux utilisateurs
-- authentifiés ; les écritures passent par l'API (service role) ou un admin legacy.
ALTER TABLE public.rbac_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbac_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbac_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbac_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbac_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbac_security_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbac_login_attempts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY rbac_roles_select_authenticated ON public.rbac_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY rbac_permissions_select_authenticated ON public.rbac_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY rbac_role_permissions_select_authenticated ON public.rbac_role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY rbac_user_profiles_select_own_or_admin ON public.rbac_user_profiles FOR SELECT
  USING (profile_id = auth.uid() OR public.is_admin());
CREATE POLICY rbac_audit_logs_select_admin ON public.rbac_audit_logs FOR SELECT USING (public.is_admin());
CREATE POLICY rbac_security_settings_select_admin ON public.rbac_security_settings FOR SELECT USING (public.is_admin());
CREATE POLICY rbac_security_settings_write_admin ON public.rbac_security_settings FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY rbac_login_attempts_select_admin ON public.rbac_login_attempts FOR SELECT USING (public.is_admin());

INSERT INTO public.rbac_security_settings (id)
VALUES ('singleton')
ON CONFLICT (id) DO NOTHING;
