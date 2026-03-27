/*
  # Fix profile photo storage UPDATE RLS policy

  1. Changes
    - Drop and recreate the UPDATE policy on `storage.objects` for `profile-photos` bucket
    - Use consistent `(SELECT auth.uid())::text` casting
  
  2. Security
    - Authenticated users can only update files in their own folder
*/

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can update their own profile photos" ON storage.objects;
END $$;

CREATE POLICY "Users can update their own profile photos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
