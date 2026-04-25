-- Ajouter le champ photo_url pour les fournisseurs
ALTER TABLE annuaire ADD COLUMN IF NOT EXISTS photo_url TEXT;
