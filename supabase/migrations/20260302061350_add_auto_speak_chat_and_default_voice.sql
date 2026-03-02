/*
  # Add auto-speak chat setting and set default voice

  1. Modified Tables
    - `assistant_profiles`
      - Add `auto_speak_chat` (boolean, default true) - controls whether Clara auto-speaks text chat responses
  2. Data Updates
    - Set default ElevenLabs voice ID on all profiles where not already set
    - Set voice_enabled to true on all profiles
    - Set auto_speak_chat to true on all profiles
  3. Notes
    - Voice ID 56bWURjYFHyYyVf490Dp is the designated Clara voice
    - Existing profiles with a custom voice will not be overwritten
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assistant_profiles' AND column_name = 'auto_speak_chat'
  ) THEN
    ALTER TABLE assistant_profiles ADD COLUMN auto_speak_chat boolean DEFAULT true NOT NULL;
  END IF;
END $$;

UPDATE assistant_profiles
SET
  elevenlabs_voice_id = COALESCE(elevenlabs_voice_id, '56bWURjYFHyYyVf490Dp'),
  elevenlabs_voice_name = COALESCE(elevenlabs_voice_name, 'Clara Voice'),
  voice_enabled = true,
  auto_speak_chat = true,
  updated_at = now()
WHERE elevenlabs_voice_id IS NULL OR voice_enabled = false;