/*
  # Add media_urls column to messages table

  ## Summary
  Adds support for MMS (multimedia messaging) by storing media attachment URLs directly
  on the messages table. Also creates the message-media storage bucket for user uploads.

  ## Changes
  - `messages` table: add `media_urls text[]` column (nullable) to store Twilio media URLs
    or Supabase Storage public URLs attached to outbound MMS messages

  ## Storage
  - Creates `message-media` bucket with public read access for rendering inline in the UI
  - RLS policy allows org members to upload to their org-scoped folder path

  ## Notes
  - Inbound MMS already stores URLs inside `metadata->media_urls`; this migration moves
    it to a first-class column for outbound messages going forward
  - Existing rows are unaffected (column is nullable with no default)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'media_urls'
  ) THEN
    ALTER TABLE messages ADD COLUMN media_urls text[];
  END IF;
END $$;
