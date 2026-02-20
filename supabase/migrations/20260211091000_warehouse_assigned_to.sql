-- Dodaj kolumnę assigned_to do warehouse_items (powiązanie narzędzia z użytkownikiem)
ALTER TABLE public.warehouse_items
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_warehouse_items_assigned_to ON public.warehouse_items(assigned_to);
