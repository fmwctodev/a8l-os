/*
  # Add Voice Input Settings and Voice Events Table

  1. Modified Tables
    - `assistant_profiles`
      - `wake_word_enabled` (boolean, default true) - enables passive listening for wake word
      - `wake_word` (text, default 'clara') - the trigger phrase
      - `barge_in_enabled` (boolean, default true) - allows interrupting Clara mid-speech

  2. New Tables
    - `clara_voice_events`
      - `id` (uuid, primary key)
      - `org_id` (uuid, FK to organizations)
      - `user_id` (uuid, FK to auth.users)
      - `event_type` (text) - one of: wake_detected, command_sent, tts_started, tts_finished, tts_interrupted, mic_denied
      - `message_id` (uuid, nullable) - links to assistant_messages
      - `metadata` (jsonb, nullable) - extensible data
      - `created_at` (timestamptz)

  3. Security
    - Enable RLS on `clara_voice_events`
    - Users can only read and insert their own events
    - Composite index on (user_id, created_at DESC) for efficient querying
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assistant_profiles' AND column_name = 'wake_word_enabled'
  ) THEN
    ALTER TABLE assistant_profiles ADD COLUMN wake_word_enabled boolean NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assistant_profiles' AND column_name = 'wake_word'
  ) THEN
    ALTER TABLE assistant_profiles ADD COLUMN wake_word text NOT NULL DEFAULT 'clara';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assistant_profiles' AND column_name = 'barge_in_enabled'
  ) THEN
    ALTER TABLE assistant_profiles ADD COLUMN barge_in_enabled boolean NOT NULL DEFAULT true;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS clara_voice_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  event_type text NOT NULL CHECK (event_type IN ('wake_detected', 'command_sent', 'tts_started', 'tts_finished', 'tts_interrupted', 'mic_denied')),
  message_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE clara_voice_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own voice events"
  ON clara_voice_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own voice events"
  ON clara_voice_events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_clara_voice_events_user_created
  ON clara_voice_events (user_id, created_at DESC);