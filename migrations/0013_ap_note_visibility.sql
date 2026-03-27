ALTER TABLE ap_notes ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public';
ALTER TABLE ap_notes ADD COLUMN direct_recipient_actor_id TEXT;

CREATE INDEX IF NOT EXISTS ap_notes_visibility_idx ON ap_notes(visibility);
