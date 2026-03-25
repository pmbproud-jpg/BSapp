-- =====================================================
-- Bautagebuch (Dziennik Budowy) - tabela SQL
-- Uruchom w Supabase SQL Editor
-- =====================================================

-- Tabela główna: wpisy dziennika budowy
CREATE TABLE IF NOT EXISTS daily_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,

  -- Personel
  worker_count INTEGER DEFAULT 0,
  worker_details TEXT,                -- np. "3 Monteure, 1 Helfer"

  -- Warunki pogodowe
  weather TEXT,                       -- np. "sonnig", "Regen", "Frost"
  temperature TEXT,                   -- np. "-5°C", "20°C"

  -- Godziny pracy
  work_start TIME,
  work_end TIME,

  -- Opis wykonanych prac
  work_description TEXT,

  -- Zakłócenia (Störungen)
  had_disruptions BOOLEAN DEFAULT FALSE,
  disruption_description TEXT,

  -- Polecenia Bauleitera (Anordnungen)
  had_orders BOOLEAN DEFAULT FALSE,
  order_description TEXT,

  -- Prace godzinowe (Stundenlohnarbeiten)
  had_hourly_work BOOLEAN DEFAULT FALSE,
  hourly_work_description TEXT,
  hourly_work_hours NUMERIC(6,2),

  -- Uwagi ogólne
  notes TEXT,

  -- Metadata
  created_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unikalny wpis na dzień per projekt
  UNIQUE(project_id, report_date)
);

-- Indeksy
CREATE INDEX IF NOT EXISTS idx_daily_reports_project ON daily_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_reports(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_reports_status ON daily_reports(status);

-- RLS
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;

-- Polityki RLS (dostosuj do swoich potrzeb)
CREATE POLICY "daily_reports_select" ON daily_reports
  FOR SELECT USING (true);

CREATE POLICY "daily_reports_insert" ON daily_reports
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "daily_reports_update" ON daily_reports
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "daily_reports_delete" ON daily_reports
  FOR DELETE USING (auth.uid() = created_by);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_daily_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER daily_reports_updated_at
  BEFORE UPDATE ON daily_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_reports_updated_at();
