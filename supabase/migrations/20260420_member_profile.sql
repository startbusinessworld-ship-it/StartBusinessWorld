-- Champs additionnels pour le profil membre
ALTER TABLE members ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS business_project TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT FALSE;
