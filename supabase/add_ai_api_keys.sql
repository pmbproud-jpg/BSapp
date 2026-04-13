-- Add API key columns to company_settings table
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)

ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS anthropic_api_key TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS openai_api_key TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN company_settings.anthropic_api_key IS 'Anthropic Claude API key for AI Chat, Reports, Voice Reports, Smart Planning';
COMMENT ON COLUMN company_settings.openai_api_key IS 'OpenAI API key for Whisper speech-to-text (Voice Reports)';
