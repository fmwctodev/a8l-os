/*
  # Add Theme Preference and Profile Photos Storage

  1. Changes to user_preferences
    - Add `theme` column (text, default 'system')
    - Values: 'light', 'dark', 'system'

  2. New Storage Bucket
    - Create `profile-photos` bucket for user avatar uploads
    - Enable public access for profile photo URLs
    - Set up storage policies for authenticated uploads

  3. Security
    - Users can only upload to their own folder in the bucket
    - Public read access for profile photos
    - Authenticated write access restricted to user's own folder
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_preferences' AND column_name = 'theme'
  ) THEN
    ALTER TABLE user_preferences ADD COLUMN theme text DEFAULT 'system';
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-photos',
  'profile-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage'
    AND policyname = 'Users can upload their own profile photos'
  ) THEN
    CREATE POLICY "Users can upload their own profile photos"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'profile-photos' AND
        (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage'
    AND policyname = 'Users can update their own profile photos'
  ) THEN
    CREATE POLICY "Users can update their own profile photos"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'profile-photos' AND
        (storage.foldername(name))[1] = auth.uid()::text
      )
      WITH CHECK (
        bucket_id = 'profile-photos' AND
        (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage'
    AND policyname = 'Users can delete their own profile photos'
  ) THEN
    CREATE POLICY "Users can delete their own profile photos"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'profile-photos' AND
        (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage'
    AND policyname = 'Profile photos are publicly readable'
  ) THEN
    CREATE POLICY "Profile photos are publicly readable"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'profile-photos');
  END IF;
END $$;
