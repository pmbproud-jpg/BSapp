-- Tabela company_settings: przechowuje nazwę firmy i logo
CREATE TABLE IF NOT EXISTS company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL DEFAULT 'Building Solutions GmbH',
  logo_url text,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES profiles(id)
);

-- Wstaw domyślny rekord
INSERT INTO company_settings (company_name) VALUES ('Building Solutions GmbH')
ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- Wszyscy zalogowani mogą czytać
CREATE POLICY "company_settings_select" ON company_settings
  FOR SELECT TO authenticated USING (true);

-- Tylko admin/management mogą aktualizować
CREATE POLICY "company_settings_update" ON company_settings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'management')
    )
  );
