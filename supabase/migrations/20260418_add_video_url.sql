-- Add video_url column to lecons for directly uploaded videos (Supabase Storage)
ALTER TABLE lecons ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Extend lecon_type to include uploaded videos
-- (No constraint change needed; values are free text: youtube, text, video)
