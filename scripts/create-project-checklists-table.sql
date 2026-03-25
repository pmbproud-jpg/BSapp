-- =====================================================
-- Checklista dokumentów projektu (Vollständigkeitsprüfung)
-- Uruchom w Supabase SQL Editor
-- =====================================================

CREATE TABLE IF NOT EXISTS project_checklists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- Dokumenty techniczne
  has_calculations BOOLEAN DEFAULT FALSE,        -- Berechnungen vorhanden
  has_fire_protection BOOLEAN DEFAULT FALSE,     -- Brandschutzkonzept
  has_floor_plans BOOLEAN DEFAULT FALSE,         -- Grundrisse
  has_sections BOOLEAN DEFAULT FALSE,            -- Schnitte
  has_schematics BOOLEAN DEFAULT FALSE,          -- Schemata beschriftet
  has_calculations_match BOOLEAN DEFAULT FALSE,  -- Berechnungen passen zu Plan

  -- Dokumenty wykonawcze (AFU)
  has_afu BOOLEAN DEFAULT FALSE,                 -- Ausführungsunterlagen
  has_material_list BOOLEAN DEFAULT FALSE,       -- Materialliste aus LV
  has_montage_plan BOOLEAN DEFAULT FALSE,        -- Montageplanung

  -- Dokumenty odbioru
  has_operating_manuals BOOLEAN DEFAULT FALSE,   -- Betriebs-/Wartungsanleitungen
  has_revision_docs BOOLEAN DEFAULT FALSE,       -- Revisionsunterlagen
  has_acceptance_protocol BOOLEAN DEFAULT FALSE, -- Abnahmeprotokoll

  -- Kolizje i problemy
  has_collisions BOOLEAN DEFAULT FALSE,          -- Kollisionen geprüft
  collision_notes TEXT,

  -- Shitlist (braki do wysłania do AG)
  shitlist_notes TEXT,
  shitlist_sent_at TIMESTAMPTZ,

  -- Uwagi ogólne
  notes TEXT,

  -- Metadata
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Jeden checklist per projekt
  UNIQUE(project_id)
);

-- Indeks
CREATE INDEX IF NOT EXISTS idx_project_checklists_project ON project_checklists(project_id);

-- RLS
ALTER TABLE project_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_checklists_select" ON project_checklists
  FOR SELECT USING (true);

CREATE POLICY "project_checklists_insert" ON project_checklists
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "project_checklists_update" ON project_checklists
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Trigger updated_at
CREATE TRIGGER project_checklists_updated_at
  BEFORE UPDATE ON project_checklists
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_reports_updated_at();
