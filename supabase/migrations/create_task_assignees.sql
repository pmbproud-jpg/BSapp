-- Tabela pośrednia: wielu pracowników przypisanych do jednego zadania
CREATE TABLE IF NOT EXISTS task_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id),
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(task_id, user_id)
);

-- RLS
ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_assignees_select" ON task_assignees FOR SELECT USING (true);
CREATE POLICY "task_assignees_insert" ON task_assignees FOR INSERT WITH CHECK (true);
CREATE POLICY "task_assignees_delete" ON task_assignees FOR DELETE USING (true);
