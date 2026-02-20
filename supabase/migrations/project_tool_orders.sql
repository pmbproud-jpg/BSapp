-- Tabela zamówień narzędzi dla projektów (analogiczna do project_material_orders)
CREATE TABLE IF NOT EXISTS project_tool_orders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tool_id uuid NOT NULL REFERENCES warehouse_items(id) ON DELETE CASCADE,
  ilosc numeric DEFAULT 1,
  uwagi text,
  ordered_by uuid REFERENCES auth.users(id),
  status text DEFAULT 'pending',
  ordered_at timestamptz,
  data_dostawy text,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE project_tool_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read project_tool_orders"
  ON project_tool_orders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert project_tool_orders"
  ON project_tool_orders FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update project_tool_orders"
  ON project_tool_orders FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete project_tool_orders"
  ON project_tool_orders FOR DELETE
  TO authenticated
  USING (true);
