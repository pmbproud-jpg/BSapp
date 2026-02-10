-- =====================================================
-- MIGRACJA: Załączniki dla zadań i projektów
-- =====================================================

-- 1. Tworzenie tabeli załączników zadań
CREATE TABLE IF NOT EXISTS task_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER DEFAULT 0,
    uploaded_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tworzenie tabeli załączników projektów
CREATE TABLE IF NOT EXISTS project_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER DEFAULT 0,
    uploaded_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Indeksy
CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_project_attachments_project_id ON project_attachments(project_id);

-- 4. RLS (Row Level Security)
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_attachments ENABLE ROW LEVEL SECURITY;

-- Polityki dla task_attachments
CREATE POLICY "Authenticated users can view task attachments"
    ON task_attachments FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert task attachments"
    ON task_attachments FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can delete task attachments"
    ON task_attachments FOR DELETE
    TO authenticated
    USING (true);

-- Polityki dla project_attachments
CREATE POLICY "Authenticated users can view project attachments"
    ON project_attachments FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert project attachments"
    ON project_attachments FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can delete project attachments"
    ON project_attachments FOR DELETE
    TO authenticated
    USING (true);

-- =====================================================
-- KONFIGURACJA STORAGE BUCKET (wykonaj w Supabase Dashboard)
-- =====================================================
-- 
-- 1. Idź do Storage w Supabase Dashboard
-- 2. Kliknij "New bucket"
-- 3. Nazwa: attachments
-- 4. Public bucket: TAK (zaznacz)
-- 5. Kliknij "Create bucket"
--
-- Alternatywnie wykonaj poniższe SQL:

INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Polityki dostępu do storage
CREATE POLICY "Authenticated users can upload attachments"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'attachments');

CREATE POLICY "Anyone can view attachments"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'attachments');

CREATE POLICY "Authenticated users can delete attachments"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'attachments');
