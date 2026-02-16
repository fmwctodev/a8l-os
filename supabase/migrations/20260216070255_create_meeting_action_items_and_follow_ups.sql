/*
  # Create Meeting Action Items, Follow-Ups, and Follow-Up Settings

  This migration creates the normalized action items tracking system and
  AI-powered follow-up messaging infrastructure for post-meeting automation.

  ## 1. New Tables

  ### meeting_action_items
  - Normalized table for discrete, trackable action items extracted from meetings
  - Replaces reliance on JSONB blob in meeting_transcriptions
  - Supports database-level deduplication via unique constraint
  - Tracks link to created contact_tasks for traceability

  ### meeting_follow_ups
  - Tracks scheduled AI-generated follow-up messages (SMS/email) per contact per meeting
  - Supports draft/approval/scheduled/sent lifecycle
  - Stores AI-generated content and generation context

  ### meeting_follow_up_settings
  - Org-level configuration for follow-up automation
  - Controls channels, delays, auto-send, quiet hours, internal exclusion

  ## 2. Modified Tables

  ### contact_tasks
  - Added `source_meeting_id` (uuid, nullable) for direct traceability to originating meeting

  ## 3. Security
  - RLS enabled on all new tables
  - Policies restrict access to authenticated org members
  - Separate SELECT/INSERT/UPDATE/DELETE policies

  ## 4. Important Notes
  - meeting_action_items has UNIQUE(meeting_transcription_id, contact_id, description) for dedup
  - meeting_follow_ups has UNIQUE(meeting_transcription_id, contact_id, channel) to prevent duplicates
  - meeting_follow_up_settings has UNIQUE(org_id) for one config per org
*/

-- ============================================================
-- 1. meeting_action_items table
-- ============================================================
CREATE TABLE IF NOT EXISTS meeting_action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  meeting_transcription_id uuid NOT NULL REFERENCES meeting_transcriptions(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  contact_task_id uuid REFERENCES contact_tasks(id) ON DELETE SET NULL,
  description text NOT NULL,
  assignee_name text,
  assignee_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  due_date timestamptz,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'task_created', 'dismissed')),
  source text NOT NULL DEFAULT 'gemini_notes' CHECK (source IN ('gemini_notes', 'transcript_ai')),
  raw_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_action_items_dedup
  ON meeting_action_items(meeting_transcription_id, contact_id, description);

CREATE INDEX IF NOT EXISTS idx_meeting_action_items_meeting
  ON meeting_action_items(meeting_transcription_id);

CREATE INDEX IF NOT EXISTS idx_meeting_action_items_contact
  ON meeting_action_items(contact_id);

CREATE INDEX IF NOT EXISTS idx_meeting_action_items_status
  ON meeting_action_items(status) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_meeting_action_items_org
  ON meeting_action_items(org_id);

ALTER TABLE meeting_action_items ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. meeting_follow_ups table
-- ============================================================
CREATE TABLE IF NOT EXISTS meeting_follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  meeting_transcription_id uuid NOT NULL REFERENCES meeting_transcriptions(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('sms', 'email')),
  scheduled_for timestamptz,
  sent_at timestamptz,
  ai_draft_content text NOT NULL DEFAULT '',
  ai_draft_subject text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'scheduled', 'sent', 'cancelled', 'failed')),
  generation_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_follow_ups_dedup
  ON meeting_follow_ups(meeting_transcription_id, contact_id, channel);

CREATE INDEX IF NOT EXISTS idx_meeting_follow_ups_status_schedule
  ON meeting_follow_ups(status, scheduled_for)
  WHERE status IN ('scheduled', 'approved');

CREATE INDEX IF NOT EXISTS idx_meeting_follow_ups_contact
  ON meeting_follow_ups(contact_id);

CREATE INDEX IF NOT EXISTS idx_meeting_follow_ups_org
  ON meeting_follow_ups(org_id);

CREATE INDEX IF NOT EXISTS idx_meeting_follow_ups_meeting
  ON meeting_follow_ups(meeting_transcription_id);

ALTER TABLE meeting_follow_ups ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. meeting_follow_up_settings table
-- ============================================================
CREATE TABLE IF NOT EXISTS meeting_follow_up_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  default_delay_minutes integer NOT NULL DEFAULT 120,
  default_channel text NOT NULL DEFAULT 'email' CHECK (default_channel IN ('sms', 'email', 'both')),
  auto_send boolean NOT NULL DEFAULT false,
  respect_quiet_hours boolean NOT NULL DEFAULT true,
  exclude_internal boolean NOT NULL DEFAULT true,
  internal_domains text[] NOT NULL DEFAULT '{}',
  ai_instructions text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id)
);

ALTER TABLE meeting_follow_up_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. Extend contact_tasks with source_meeting_id
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contact_tasks' AND column_name = 'source_meeting_id'
  ) THEN
    ALTER TABLE contact_tasks ADD COLUMN source_meeting_id uuid REFERENCES meeting_transcriptions(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_contact_tasks_source_meeting
  ON contact_tasks(source_meeting_id) WHERE source_meeting_id IS NOT NULL;

-- ============================================================
-- 5. RLS Policies - meeting_action_items
-- ============================================================

CREATE POLICY "Org members can view meeting action items"
  ON meeting_action_items FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Org members can create meeting action items"
  ON meeting_action_items FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Org members can update meeting action items"
  ON meeting_action_items FOR UPDATE
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

CREATE POLICY "Org members can delete meeting action items"
  ON meeting_action_items FOR DELETE
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- ============================================================
-- 6. RLS Policies - meeting_follow_ups
-- ============================================================

CREATE POLICY "Org members can view meeting follow-ups"
  ON meeting_follow_ups FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Org members can create meeting follow-ups"
  ON meeting_follow_ups FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Org members can update meeting follow-ups"
  ON meeting_follow_ups FOR UPDATE
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

CREATE POLICY "Org members can delete meeting follow-ups"
  ON meeting_follow_ups FOR DELETE
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- ============================================================
-- 7. RLS Policies - meeting_follow_up_settings
-- ============================================================

CREATE POLICY "Org members can view follow-up settings"
  ON meeting_follow_up_settings FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Org members can create follow-up settings"
  ON meeting_follow_up_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Org members can update follow-up settings"
  ON meeting_follow_up_settings FOR UPDATE
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

CREATE POLICY "Org members can delete follow-up settings"
  ON meeting_follow_up_settings FOR DELETE
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );
