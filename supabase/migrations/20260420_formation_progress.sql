-- Table pour tracker la progression des formations par membre
CREATE TABLE IF NOT EXISTS formation_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  formation_key TEXT NOT NULL,
  progress JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, formation_key)
);

-- Index pour lecture rapide par user
CREATE INDEX IF NOT EXISTS idx_formation_progress_user ON formation_progress(user_id);

-- RLS : chaque user ne voit que sa propre progression
ALTER TABLE formation_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own progress"
  ON formation_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own progress"
  ON formation_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress"
  ON formation_progress FOR UPDATE
  USING (auth.uid() = user_id);

-- Admins peuvent tout voir
CREATE POLICY "Admins can read all progress"
  ON formation_progress FOR SELECT
  USING (EXISTS(SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
