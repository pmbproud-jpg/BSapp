-- Add custom_permissions column for individual permission overrides
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS custom_permissions jsonb DEFAULT NULL;

-- Ensure admin users can update other profiles (for setting permissions)
-- This policy allows authenticated users with role 'admin' to update any profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'Admin can update all profiles'
  ) THEN
    CREATE POLICY "Admin can update all profiles"
      ON profiles FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid() AND p.role = 'admin'
        )
      );
  END IF;
END $$;
