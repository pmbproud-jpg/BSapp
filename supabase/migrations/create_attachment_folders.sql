-- Foldery załączników w projektach
CREATE TABLE IF NOT EXISTS attachment_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name varchar(255) NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Dodaj folder_id do project_attachments (NULL = poza folderem)
ALTER TABLE project_attachments ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES attachment_folders(id) ON DELETE CASCADE;

-- RLS
ALTER TABLE attachment_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attachment_folders_select" ON attachment_folders FOR SELECT USING (true);
CREATE POLICY "attachment_folders_insert" ON attachment_folders FOR INSERT WITH CHECK (true);
CREATE POLICY "attachment_folders_update" ON attachment_folders FOR UPDATE USING (true);
CREATE POLICY "attachment_folders_delete" ON attachment_folders FOR DELETE USING (true);
