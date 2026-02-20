-- ============================================================
-- Tabela: project_plans — plany budowlane (PDF/zdjęcia)
-- ============================================================
CREATE TABLE IF NOT EXISTS project_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                          -- np. "Parter - Instalacja elektryczna"
  description TEXT,
  floor_level TEXT,                             -- np. "Parter", "Piętro 1", "Dach"
  file_url TEXT NOT NULL,                      -- URL z Supabase Storage
  file_type TEXT NOT NULL DEFAULT 'image',     -- 'image' | 'pdf'
  version INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Tabela: plan_pins — pinezki na planach
-- ============================================================
CREATE TABLE IF NOT EXISTS plan_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES project_plans(id) ON DELETE CASCADE,
  x_percent DOUBLE PRECISION NOT NULL,         -- pozycja X jako % szerokości (0-100)
  y_percent DOUBLE PRECISION NOT NULL,         -- pozycja Y jako % wysokości (0-100)
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',         -- 'open' | 'in_progress' | 'resolved' | 'closed'
  priority TEXT NOT NULL DEFAULT 'medium',     -- 'low' | 'medium' | 'high' | 'critical'
  category TEXT,                                -- np. 'electrical', 'plumbing', 'structural', 'finishing'
  assigned_to UUID REFERENCES auth.users(id),
  due_date DATE,
  task_id UUID REFERENCES tasks(id),           -- opcjonalne powiązanie z zadaniem
  photos JSONB DEFAULT '[]'::jsonb,            -- tablica URL-i zdjęć
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Indeksy
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_project_plans_project_id ON project_plans(project_id);
CREATE INDEX IF NOT EXISTS idx_plan_pins_plan_id ON plan_pins(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_pins_status ON plan_pins(status);
CREATE INDEX IF NOT EXISTS idx_plan_pins_assigned_to ON plan_pins(assigned_to);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
ALTER TABLE project_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_pins ENABLE ROW LEVEL SECURITY;

-- Polityki: wszyscy zalogowani mogą czytać
CREATE POLICY "project_plans_select" ON project_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "project_plans_insert" ON project_plans FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "project_plans_update" ON project_plans FOR UPDATE TO authenticated USING (true);
CREATE POLICY "project_plans_delete" ON project_plans FOR DELETE TO authenticated USING (true);

CREATE POLICY "plan_pins_select" ON plan_pins FOR SELECT TO authenticated USING (true);
CREATE POLICY "plan_pins_insert" ON plan_pins FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "plan_pins_update" ON plan_pins FOR UPDATE TO authenticated USING (true);
CREATE POLICY "plan_pins_delete" ON plan_pins FOR DELETE TO authenticated USING (true);

-- ============================================================
-- Storage bucket dla planów
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('project-plans', 'project-plans', true)
ON CONFLICT (id) DO NOTHING;

-- Polityki storage
CREATE POLICY "project_plans_storage_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'project-plans');
CREATE POLICY "project_plans_storage_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'project-plans');
CREATE POLICY "project_plans_storage_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'project-plans');
CREATE POLICY "project_plans_storage_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'project-plans');
