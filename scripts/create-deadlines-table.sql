-- =====================================================
-- Fristen-Kalender (Terminy VOB)
-- Uruchom w Supabase SQL Editor
-- =====================================================

CREATE TABLE IF NOT EXISTS project_deadlines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- Typ terminu
  type TEXT NOT NULL CHECK (type IN (
    'rechnung_pruef',      -- 21 Tage Prüffrist Rechnung
    'rechnung_zahlung',    -- 21 Tage Zahlungsfrist
    'rechnung_nachfrist',  -- 3 Tage Nachfrist
    'abnahme_forderung',   -- 12 Tage förmliche Abnahme
    'abnahme_termin',      -- Abnahmetermin
    'aufmass_pruef',       -- 7 Tage Aufmaß Prüffrist
    'stundenlohn_frist',   -- 6 Tage Stundenlohn
    'behinderung_kuendigung', -- 3 Monate Behinderung → Kündigung
    'gewaehrleistung',     -- 5 Jahre Gewährleistung
    'nachfrist',           -- allgemeine Nachfrist
    'custom'               -- benutzerdefiniert
  )),

  title TEXT NOT NULL,
  description TEXT,

  -- Daty
  start_date DATE,           -- kiedy termin zaczyna biec
  deadline_date DATE NOT NULL,-- termin końcowy
  warning_days INTEGER DEFAULT 3, -- ile dni przed terminem ostrzegać

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'warned', 'overdue', 'completed')),
  completed_at TIMESTAMPTZ,

  -- Powiązanie opcjonalne
  related_obstruction_id UUID REFERENCES project_obstructions(id) ON DELETE SET NULL,

  -- Metadata
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indeksy
CREATE INDEX IF NOT EXISTS idx_project_deadlines_project ON project_deadlines(project_id);
CREATE INDEX IF NOT EXISTS idx_project_deadlines_date ON project_deadlines(deadline_date);
CREATE INDEX IF NOT EXISTS idx_project_deadlines_status ON project_deadlines(status);

-- RLS
ALTER TABLE project_deadlines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_deadlines_select" ON project_deadlines
  FOR SELECT USING (true);

CREATE POLICY "project_deadlines_insert" ON project_deadlines
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "project_deadlines_update" ON project_deadlines
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "project_deadlines_delete" ON project_deadlines
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Trigger updated_at
CREATE TRIGGER project_deadlines_updated_at
  BEFORE UPDATE ON project_deadlines
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_reports_updated_at();
