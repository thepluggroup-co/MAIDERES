-- ═══════════════════════════════════════════════════════════════════════════
-- MAIDERES — RLS sur audit_log (créée en 0002, après la passe RLS de 0001)
-- Staff en lecture seule, append-only (jamais d'UPDATE/DELETE, y compris admin) —
-- l'écriture se fait uniquement via auditMiddleware (service role, bypass RLS).
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_log_select_staff ON public.audit_log;
CREATE POLICY audit_log_select_staff ON public.audit_log
  FOR SELECT USING (public.is_staff());
