-- =====================================================
-- Behinderungsanzeige / Bedenkenanzeige (Zgłoszenia przeszkód)
-- Uruchom w Supabase SQL Editor
-- =====================================================

CREATE TABLE IF NOT EXISTS project_obstructions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- Typ: behinderung (przeszkoda) lub bedenken (zastrzeżenie)
  type TEXT NOT NULL DEFAULT 'behinderung' CHECK (type IN ('behinderung', 'bedenken')),

  -- Status workflow
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'escalated')),

  -- Treść
  title TEXT NOT NULL,
  description TEXT,
  cause TEXT,                          -- Ursache
  consequences TEXT,                   -- Folgen
  cost_estimate NUMERIC(12,2),         -- Kostenschätzung

  -- Daty
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,

  -- Kto
  reported_by UUID REFERENCES profiles(id),
  resolved_by UUID REFERENCES profiles(id),

  -- Notatki
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indeksy
CREATE INDEX IF NOT EXISTS idx_project_obstructions_project ON project_obstructions(project_id);
CREATE INDEX IF NOT EXISTS idx_project_obstructions_status ON project_obstructions(status);
CREATE INDEX IF NOT EXISTS idx_project_obstructions_type ON project_obstructions(type);

-- RLS
ALTER TABLE project_obstructions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_obstructions_select" ON project_obstructions
  FOR SELECT USING (true);

CREATE POLICY "project_obstructions_insert" ON project_obstructions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "project_obstructions_update" ON project_obstructions
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "project_obstructions_delete" ON project_obstructions
  FOR DELETE USING (auth.uid() = reported_by);

-- Trigger updated_at
CREATE TRIGGER project_obstructions_updated_at
  BEFORE UPDATE ON project_obstructions
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_reports_updated_at();
