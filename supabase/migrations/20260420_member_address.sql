-- Ajouter le champ adresse pour le profil membre
ALTER TABLE members ADD COLUMN IF NOT EXISTS address TEXT;
