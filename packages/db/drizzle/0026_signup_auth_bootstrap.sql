-- ═══════════════════════════════════════════════════════════════════════════
-- MAIDERES — Bootstrap automatique de public.profiles à l'inscription
-- (auth.users). Nécessaire pour le self-service (maidere-connect) : un
-- client/prestataire qui s'inscrit via supabase.auth.signUp() ne peut pas
-- lui-même écrire dans public.profiles (policy profiles_insert_admin,
-- 0001_rls_policies.sql, réserve l'INSERT à is_admin()) — il faut donc un
-- trigger SECURITY DEFINER sur auth.users pour créer la ligne à sa place.
--
-- Rôle par défaut : 'apprenant' — la valeur la plus basse-privilège de
-- profiles.role (cf. packages/db/src/seed.ts, qui utilise déjà cette
-- convention pour les comptes client/prestataire). 'admin'/'superviseur'/
-- 'operateur' ne sont JAMAIS attribués ici ; le staff est créé uniquement
-- via POST /api/admin/users/invite (apps/api/src/routes/admin.ts), qui fait
-- déjà un upsert sur profiles APRÈS l'insertion auth.users — ce trigger
-- s'exécute avant et est donc écrasé sans conflit par cet upsert (vérifié :
-- admin.ts utilise .upsert(), jamais .insert(), sur ce chemin).
--
-- Ce trigger ne crée PAS de ligne clients/prestataires — cette décision est
-- déportée sur l'appelant (POST /api/clients ou /api/prestataires, déjà
-- conçus pour l'auto-inscription : profile_id par défaut = l'utilisateur
-- authentifié lui-même). Dupliquer cette logique en SQL dupliquerait aussi
-- la validation métier (NIU requis pour entreprise/organisation, etc.) déjà
-- écrite et testée côté API.
--
-- Idempotent : CREATE OR REPLACE FUNCTION, DROP TRIGGER IF EXISTS + CREATE,
-- INSERT ... ON CONFLICT DO NOTHING.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nom, telephone, role, actif)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'nom', ''), split_part(NEW.email, '@', 1)),
    NULLIF(NEW.raw_user_meta_data->>'telephone', ''),
    'apprenant',
    true
  )
  ON CONFLICT (id) DO NOTHING;

  -- Best-effort : reflète le rôle par défaut dans le JWT (app_metadata),
  -- lu par apps/api/src/middleware/auth.ts. Ne touche jamais un rôle déjà
  -- présent (ex. le chemin invite, qui fixe app_metadata.role explicitement
  -- juste après). Note : le tout premier JWT retourné par signUp() peut ne
  -- pas refléter cette mise à jour tant qu'une session n'est pas rafraîchie
  -- (comportement GoTrue standard) — sans conséquence ici puisque aucune
  -- route self-service (POST /clients, /prestataires) ne distingue les
  -- rôles non-staff entre eux, seulement staff/non-staff.
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'apprenant')
  WHERE id = NEW.id
    AND (raw_app_meta_data ->> 'role') IS NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
