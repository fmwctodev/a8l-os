/*
  # Create Meeting Transcriptions Schema

  This migration creates tables for meeting transcription integration,
  primarily for Google Meet recordings with AI-powered insights extraction.
  Includes support for Google Drive recording links for easy access.

  ## 1. New Tables

  ### meeting_transcriptions
  - `id` (uuid, primary key) - Unique transcription identifier
  - `org_id` (uuid) - Organization reference
  - `contact_id` (uuid, nullable) - Primary linked contact
  - `meeting_source` (text) - Source platform (google_meet, zoom, teams)
  - `external_meeting_id` (text) - External platform meeting ID
  - `meeting_title` (text) - Meeting title
  - `meeting_date` (timestamptz) - When meeting occurred
  - `duration_minutes` (integer, nullable) - Meeting duration
  - `participants` (jsonb) - Array of participant info (name, email)
  - `transcript_text` (text) - Full transcript content
  - `summary` (text, nullable) - AI-generated meeting summary
  - `key_points` (jsonb) - Extracted key discussion points
  - `action_items` (jsonb) - Extracted action items
  - `recording_url` (text, nullable) - Google Drive link to recording
  - `recording_file_id` (text, nullable) - Google Drive file ID
  - `recording_duration` (text, nullable) - Recording duration string
  - `recording_size_bytes` (bigint, nullable) - Recording file size
  - `processed_at` (timestamptz, nullable) - When AI processing completed
  - `imported_by` (uuid) - User who imported the transcription
  - `created_at`, `updated_at` - Timestamps

  ### meeting_transcription_contacts
  - `id` (uuid, primary key) - Unique link identifier
  - `org_id` (uuid) - Organization reference
  - `meeting_transcription_id` (uuid) - Reference to transcription
  - `contact_id` (uuid) - Linked contact
  - `participant_email` (text, nullable) - Email that matched
  - `created_at` - Timestamp

  ### contact_meeting_notes
  - `id` (uuid, primary key) - Unique note identifier
  - `org_id` (uuid) - Organization reference
  - `contact_id` (uuid) - Contact this note belongs to
  - `meeting_transcription_id` (uuid, nullable) - Source meeting
  - `title` (text) - Note title
  - `content` (text) - Note content
  - `created_by` (uuid) - User who created the note
  - `created_at`, `updated_at` - Timestamps

  ### proposal_meeting_contexts
  - `id` (uuid, primary key) - Unique link identifier
  - `org_id` (uuid) - Organization reference
  - `proposal_id` (uuid) - Linked proposal
  - `meeting_transcription_id` (uuid) - Linked meeting
  - `included_in_generation` (boolean) - Whether used in AI generation
  - `created_at` - Timestamp

  ## 2. Indexes
  - Performance indexes on all foreign keys
  - Full-text search index on transcript_text
  - Index on external_meeting_id for deduplication
  - Index on participants for email lookup

  ## 3. Important Notes
  - All tables have RLS enabled
  - meeting_transcription_contacts enables many-to-many contact linking
  - recording_url and recording_file_id store Google Drive access info
*/

-- Meeting transcriptions table
CREATE TABLE IF NOT EXISTS meeting_transcriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  meeting_source text NOT NULL DEFAULT 'google_meet' CHECK (meeting_source IN ('google_meet', 'zoom', 'teams', 'other')),
  external_meeting_id text,
  meeting_title text NOT NULL,
  meeting_date timestamptz NOT NULL,
  duration_minutes integer,
  participants jsonb NOT NULL DEFAULT '[]'::jsonb,
  transcript_text text NOT NULL DEFAULT '',
  summary text,
  key_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  action_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  recording_url text,
  recording_file_id text,
  recording_duration text,
  recording_size_bytes bigint,
  processed_at timestamptz,
  imported_by uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, meeting_source, external_meeting_id)
);

-- Meeting transcription to contacts linking table (many-to-many)
CREATE TABLE IF NOT EXISTS meeting_transcription_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  meeting_transcription_id uuid NOT NULL REFERENCES meeting_transcriptions(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  participant_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(meeting_transcription_id, contact_id)
);

-- Contact meeting notes table
CREATE TABLE IF NOT EXISTS contact_meeting_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  meeting_transcription_id uuid REFERENCES meeting_transcriptions(id) ON DELETE SET NULL,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Proposal to meeting context linking table
CREATE TABLE IF NOT EXISTS proposal_meeting_contexts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  proposal_id uuid NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  meeting_transcription_id uuid NOT NULL REFERENCES meeting_transcriptions(id) ON DELETE CASCADE,
  included_in_generation boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(proposal_id, meeting_transcription_id)
);

-- Indexes for meeting_transcriptions
CREATE INDEX IF NOT EXISTS idx_meeting_transcriptions_org ON meeting_transcriptions(org_id);
CREATE INDEX IF NOT EXISTS idx_meeting_transcriptions_contact ON meeting_transcriptions(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meeting_transcriptions_source ON meeting_transcriptions(org_id, meeting_source);
CREATE INDEX IF NOT EXISTS idx_meeting_transcriptions_external_id ON meeting_transcriptions(meeting_source, external_meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_transcriptions_date ON meeting_transcriptions(meeting_date);
CREATE INDEX IF NOT EXISTS idx_meeting_transcriptions_imported_by ON meeting_transcriptions(imported_by);
CREATE INDEX IF NOT EXISTS idx_meeting_transcriptions_created ON meeting_transcriptions(created_at);
CREATE INDEX IF NOT EXISTS idx_meeting_transcriptions_recording ON meeting_transcriptions(recording_file_id) WHERE recording_file_id IS NOT NULL;

-- GIN index for full-text search on transcript
CREATE INDEX IF NOT EXISTS idx_meeting_transcriptions_transcript_search 
ON meeting_transcriptions USING gin(to_tsvector('english', transcript_text));

-- GIN index for participant email lookup
CREATE INDEX IF NOT EXISTS idx_meeting_transcriptions_participants 
ON meeting_transcriptions USING gin(participants);

-- Indexes for meeting_transcription_contacts
CREATE INDEX IF NOT EXISTS idx_meeting_trans_contacts_meeting ON meeting_transcription_contacts(meeting_transcription_id);
CREATE INDEX IF NOT EXISTS idx_meeting_trans_contacts_contact ON meeting_transcription_contacts(contact_id);
CREATE INDEX IF NOT EXISTS idx_meeting_trans_contacts_email ON meeting_transcription_contacts(participant_email) WHERE participant_email IS NOT NULL;

-- Indexes for contact_meeting_notes
CREATE INDEX IF NOT EXISTS idx_contact_meeting_notes_contact ON contact_meeting_notes(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_meeting_notes_meeting ON contact_meeting_notes(meeting_transcription_id) WHERE meeting_transcription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contact_meeting_notes_created ON contact_meeting_notes(created_at);

-- Indexes for proposal_meeting_contexts
CREATE INDEX IF NOT EXISTS idx_proposal_meeting_contexts_proposal ON proposal_meeting_contexts(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_meeting_contexts_meeting ON proposal_meeting_contexts(meeting_transcription_id);

-- Enable RLS on all new tables
ALTER TABLE meeting_transcriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_transcription_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_meeting_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_meeting_contexts ENABLE ROW LEVEL SECURITY;

-- Update triggers for updated_at
CREATE TRIGGER set_meeting_transcriptions_updated_at
  BEFORE UPDATE ON meeting_transcriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_proposals_updated_at();

CREATE TRIGGER set_contact_meeting_notes_updated_at
  BEFORE UPDATE ON contact_meeting_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_proposals_updated_at();
