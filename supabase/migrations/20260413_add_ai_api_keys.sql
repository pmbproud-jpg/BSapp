-- =====================================================================
-- Migracja: 20260413_add_ai_api_keys
-- Dodaje kolumny z kluczami API (Anthropic, OpenAI) do company_settings.
--
-- UWAGA bezpieczeństwa (do naprawy w Fazie 7):
--   Klucze są trzymane w plaintext w DB. Migracja 20260419_harden_rls
--   ogranicza SELECT na company_settings do ról admin/mgmt, żeby workery
--   nie mogły ich wykraść przez bezpośredni klient. Długoterminowo
--   klucze AI powinny przejść do Netlify env vars (ANTHROPIC_API_KEY,
--   OPENAI_API_KEY), a AI calls robi tylko Netlify Function.
--
-- Wcześniej: plik leżał jako supabase/add_ai_api_keys.sql (do ręcznego
-- wklejenia w Dashboard SQL Editor). Przeniesiony do migrations/ żeby
-- `supabase db push` go aplikowało.
-- =====================================================================

ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS anthropic_api_key TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS openai_api_key TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN company_settings.anthropic_api_key IS 'Anthropic Claude API key for AI Chat, Reports, Voice Reports, Smart Planning';
COMMENT ON COLUMN company_settings.openai_api_key IS 'OpenAI API key for Whisper speech-to-text (Voice Reports)';
