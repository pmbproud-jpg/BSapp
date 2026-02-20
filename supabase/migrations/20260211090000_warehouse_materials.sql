-- Tabela materiałów magazynowych
CREATE TABLE IF NOT EXISTS public.warehouse_materials (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pozycja text,
  art_nr text,
  nazwa text,
  ilosc numeric,
  dlugosc text,
  szerokosc text,
  wysokosc text,
  waga text,
  zamawiajacy text,
  data_zamowienia text,
  data_dostawy text,
  min_stan numeric,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.warehouse_materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "warehouse_materials_select" ON public.warehouse_materials;
CREATE POLICY "warehouse_materials_select" ON public.warehouse_materials
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "warehouse_materials_insert" ON public.warehouse_materials;
CREATE POLICY "warehouse_materials_insert" ON public.warehouse_materials
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "warehouse_materials_update" ON public.warehouse_materials;
CREATE POLICY "warehouse_materials_update" ON public.warehouse_materials
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "warehouse_materials_delete" ON public.warehouse_materials;
CREATE POLICY "warehouse_materials_delete" ON public.warehouse_materials
  FOR DELETE USING (true);
