-- ═══════════════════════════════════════════════════════════════════════════
-- MAIDERES — Valeurs réelles de seuil_alerte_heures (colonne ajoutée en 0016
-- avec un défaut 0 générique, pour éviter le blocage NOT NULL sur les lignes
-- existantes). Convention : seuil ≈ moitié du délai cible — passage à
-- "alerte" (orange) à mi-chemin de l'échéance, avant le rouge à delai_cible.
-- Ajustable ensuite depuis l'écran Paramètres, jamais figé côté code.
--
-- Idempotent : ne touche que les lignes encore au défaut 0.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE public.sla_config SET seuil_alerte_heures = 1  WHERE niveau_urgence = 'immediate' AND seuil_alerte_heures = 0;
UPDATE public.sla_config SET seuil_alerte_heures = 12 WHERE niveau_urgence = 'urgent'    AND seuil_alerte_heures = 0;
UPDATE public.sla_config SET seuil_alerte_heures = 48 WHERE niveau_urgence = 'planifie'  AND seuil_alerte_heures = 0;
