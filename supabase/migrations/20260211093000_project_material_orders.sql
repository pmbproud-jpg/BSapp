-- Tabela zamówień materiałów z poziomu projektu
CREATE TABLE IF NOT EXISTS public.project_material_orders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  material_id uuid REFERENCES public.warehouse_materials(id) ON DELETE SET NULL,
  ilosc numeric NOT NULL,
  uwagi text,
  status text NOT NULL DEFAULT 'pending',
  ordered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ordered_at timestamptz,
  data_dostawy text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_material_orders_project ON public.project_material_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_project_material_orders_material ON public.project_material_orders(material_id);

-- RLS
ALTER TABLE public.project_material_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_material_orders_select" ON public.project_material_orders;
CREATE POLICY "project_material_orders_select" ON public.project_material_orders
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "project_material_orders_insert" ON public.project_material_orders;
CREATE POLICY "project_material_orders_insert" ON public.project_material_orders
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "project_material_orders_update" ON public.project_material_orders;
CREATE POLICY "project_material_orders_update" ON public.project_material_orders
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "project_material_orders_delete" ON public.project_material_orders;
CREATE POLICY "project_material_orders_delete" ON public.project_material_orders
  FOR DELETE USING (true);
