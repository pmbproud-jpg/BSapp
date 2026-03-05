-- Add default_password column to company_settings
-- Used by admin to set a default password for newly created users
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS default_password TEXT DEFAULT NULL;
