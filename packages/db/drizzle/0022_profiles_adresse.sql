-- Adresse de contact affichée et modifiée depuis le compte utilisateur.
-- Nullable : les profils existants et les comptes nouvellement créés peuvent ne
-- pas encore disposer d'une adresse renseignée.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS adresse text;
