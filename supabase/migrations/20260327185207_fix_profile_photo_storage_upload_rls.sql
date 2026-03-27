/*
  # Fix profile photo storage upload RLS policy

  1. Changes
    - Drop and recreate the INSERT policy on `storage.objects` for `profile-photos` bucket
    - Use `(auth.uid())::text` with explicit casting to ensure reliable matching
    - Add fallback: also allow upload when the path prefix matches the authenticated user's ID
  
  2. Security
    - Authenticated users can only upload to their own folder (`{user_id}/filename`)
    - No change to SELECT, UPDATE, or DELETE policies
  
  3. Notes
    - The previous policy may have failed due to auth.uid() type casting issues
      in certain Supabase storage engine versions
*/

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can upload their own profile photos" ON storage.objects;
END $$;

CREATE POLICY "Users can upload their own profile photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
