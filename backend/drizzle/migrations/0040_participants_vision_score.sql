-- Vision score participant (match-v5) pour agrégats champion_stats / onglet Vision.
ALTER TABLE participants ADD COLUMN IF NOT EXISTS vision_score INTEGER NOT NULL DEFAULT 0;
