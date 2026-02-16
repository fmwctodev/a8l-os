/*
  # Create Google Meet Sessions Table

  1. New Tables
    - `google_meet_sessions`
      - `id` (uuid, primary key) - Unique session identifier
      - `org_id` (uuid, FK to organizations) - Organization scope
      - `user_id` (uuid, FK to users) - Calendar connection owner
      - `connection_id` (uuid, FK to google_calendar_connections) - Source connection
      - `google_event_id` (text) - Google Calendar event ID
      - `meet_conference_id` (text, nullable) - conferenceData.conferenceId
      - `calendar_event_summary` (text, nullable) - Event title
      - `event_start_time` (timestamptz, nullable) - Meeting start
      - `event_end_time` (timestamptz, nullable) - Meeting end
      - `organizer_email` (text, nullable) - Meeting organizer
      - `attendees` (jsonb) - Full attendee array from calendar event
      - `meet_link` (text, nullable) - Google Meet URL
      - `html_link` (text, nullable) - Calendar event URL
      - `recording_file_id` (text, nullable) - Drive file ID for recording
      - `recording_url` (text, nullable) - Drive web view link for recording
      - `transcript_file_id` (text, nullable) - Drive file ID for transcript
      - `transcript_url` (text, nullable) - Drive web view link for transcript
      - `transcript_content` (text, nullable) - Extracted transcript text
      - `gemini_notes_file_id` (text, nullable) - Drive file ID for Gemini notes
      - `gemini_notes_url` (text, nullable) - Drive web view link for Gemini notes
      - `gemini_notes_content` (text, nullable) - Extracted Gemini notes text
      - `meeting_transcription_id` (uuid, nullable, FK to meeting_transcriptions) - Link to CRM transcription record
      - `status` (text) - Processing status: detected, queued, processing, completed, failed, no_artifacts
      - `processed` (boolean) - Whether processing is complete
      - `processing_error` (text, nullable) - Last error message
      - `retry_count` (integer) - Number of processing attempts
      - `first_check_after` (timestamptz, nullable) - Earliest time to check for artifacts (end_time + 15 min)
      - `last_processed_at` (timestamptz, nullable) - Last processing attempt timestamp
      - `created_at` (timestamptz) - Record creation time
      - `updated_at` (timestamptz) - Last update time

  2. Security
    - Enable RLS on `google_meet_sessions` table
    - Add SELECT policy for authenticated users within their org
    - Service role handles INSERT/UPDATE from edge functions

  3. Important Notes
    - UNIQUE constraint on (connection_id, google_event_id) prevents duplicate detection
    - Indexes on org_id, status, processed, and first_check_after for efficient cron queries
    - The first_check_after field implements the 15-minute delay before checking Drive for artifacts
    - Status transitions: detected -> processing -> completed/failed/no_artifacts
*/

CREATE TABLE IF NOT EXISTS google_meet_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES google_calendar_connections(id) ON DELETE CASCADE,
  google_event_id text NOT NULL,
  meet_conference_id text,
  calendar_event_summary text,
  event_start_time timestamptz,
  event_end_time timestamptz,
  organizer_email text,
  attendees jsonb NOT NULL DEFAULT '[]'::jsonb,
  meet_link text,
  html_link text,
  recording_file_id text,
  recording_url text,
  transcript_file_id text,
  transcript_url text,
  transcript_content text,
  gemini_notes_file_id text,
  gemini_notes_url text,
  gemini_notes_content text,
  meeting_transcription_id uuid REFERENCES meeting_transcriptions(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'detected' CHECK (status IN ('detected', 'queued', 'processing', 'completed', 'failed', 'no_artifacts')),
  processed boolean NOT NULL DEFAULT false,
  processing_error text,
  retry_count integer NOT NULL DEFAULT 0,
  first_check_after timestamptz,
  last_processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(connection_id, google_event_id)
);

CREATE INDEX IF NOT EXISTS idx_google_meet_sessions_org_id ON google_meet_sessions(org_id);
CREATE INDEX IF NOT EXISTS idx_google_meet_sessions_status ON google_meet_sessions(status);
CREATE INDEX IF NOT EXISTS idx_google_meet_sessions_processed ON google_meet_sessions(processed);
CREATE INDEX IF NOT EXISTS idx_google_meet_sessions_first_check ON google_meet_sessions(first_check_after)
  WHERE processed = false;
CREATE INDEX IF NOT EXISTS idx_google_meet_sessions_conference_id ON google_meet_sessions(meet_conference_id)
  WHERE meet_conference_id IS NOT NULL;

ALTER TABLE google_meet_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view meet sessions in their org"
  ON google_meet_sessions
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert meet sessions in their org"
  ON google_meet_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update meet sessions in their org"
  ON google_meet_sessions
  FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );
