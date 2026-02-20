ALTER TABLE tasks ADD COLUMN IF NOT EXISTS edited_by uuid REFERENCES auth.users(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS edited_at timestamptz;
