/*
  # Extend Conversations Module for Vapi Communication Logs

  Normalizes Vapi voice calls, SMS, and webchat sessions into the unified
  conversations/messages tables so they appear in the standard inbox.

  1. Modified Tables
    - `conversations`
      - `provider` (text) - 'vapi' for Vapi-originated threads
      - `external_call_id` (text) - Vapi call ID for voice threads
      - `external_session_id` (text) - Vapi session ID for SMS/webchat
      - `external_assistant_id` (text) - internal vapi_assistants.id reference
      - `external_binding_id` (text) - phone number or widget binding ID
      - `conversation_metadata` (jsonb) - recording_url, duration, summary, etc.
    - `messages`
      - `message_type` (text) - text, call_event, summary, system_note
      - `sender_name` (text) - AI assistant name on outbound
      - `sender_identifier` (text) - phone number or session user identifier
    - `messages` channel constraint expanded with vapi_voice, vapi_sms, vapi_webchat
    - `vapi_webhook_logs`
      - `vapi_call_id` (text) - links webhook logs to specific calls

  2. New Tables
    - `conversation_participants` - tracks customer, assistant, user roles per thread
    - `org_vapi_conversation_settings` - per-org settings for Vapi normalization

  3. Security
    - RLS enabled on all new tables
    - Org-isolation policies on conversation_participants via join
    - Org-member read/write on org_vapi_conversation_settings

  4. Indexes
    - conversations(provider), conversations(external_call_id), conversations(external_session_id)
    - conversation_participants(conversation_id)
    - vapi_webhook_logs(vapi_call_id)
*/

-- ============================================================
-- 1. Extend conversations table
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'provider'
  ) THEN
    ALTER TABLE conversations ADD COLUMN provider text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'external_call_id'
  ) THEN
    ALTER TABLE conversations ADD COLUMN external_call_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'external_session_id'
  ) THEN
    ALTER TABLE conversations ADD COLUMN external_session_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'external_assistant_id'
  ) THEN
    ALTER TABLE conversations ADD COLUMN external_assistant_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'external_binding_id'
  ) THEN
    ALTER TABLE conversations ADD COLUMN external_binding_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'conversation_metadata'
  ) THEN
    ALTER TABLE conversations ADD COLUMN conversation_metadata jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_conversations_provider ON conversations(provider) WHERE provider IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_external_call_id ON conversations(external_call_id) WHERE external_call_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_external_session_id ON conversations(external_session_id) WHERE external_session_id IS NOT NULL;

-- ============================================================
-- 2. Extend messages table
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'message_type'
  ) THEN
    ALTER TABLE messages ADD COLUMN message_type text DEFAULT 'text';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'sender_name'
  ) THEN
    ALTER TABLE messages ADD COLUMN sender_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'sender_identifier'
  ) THEN
    ALTER TABLE messages ADD COLUMN sender_identifier text;
  END IF;
END $$;

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_channel_check;
ALTER TABLE messages ADD CONSTRAINT messages_channel_check
  CHECK (channel IN ('sms', 'email', 'voice', 'webchat', 'social_dm', 'vapi_voice', 'vapi_sms', 'vapi_webchat'));

-- ============================================================
-- 3. Add vapi_call_id to vapi_webhook_logs
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vapi_webhook_logs' AND column_name = 'vapi_call_id'
  ) THEN
    ALTER TABLE vapi_webhook_logs ADD COLUMN vapi_call_id text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_vapi_webhook_logs_call_id ON vapi_webhook_logs(vapi_call_id) WHERE vapi_call_id IS NOT NULL;

-- ============================================================
-- 4. Create conversation_participants table
-- ============================================================
CREATE TABLE IF NOT EXISTS conversation_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role text NOT NULL,
  name text,
  identifier text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversation_participants_role_check CHECK (role IN ('customer', 'assistant', 'user', 'system'))
);

CREATE INDEX IF NOT EXISTS idx_conversation_participants_conv ON conversation_participants(conversation_id);

ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view conversation participants"
  ON conversation_participants FOR SELECT TO authenticated
  USING (conversation_id IN (
    SELECT c.id FROM conversations c
    JOIN users u ON u.organization_id = c.organization_id
    WHERE u.id = auth.uid()
  ));

CREATE POLICY "Org members can insert conversation participants"
  ON conversation_participants FOR INSERT TO authenticated
  WITH CHECK (conversation_id IN (
    SELECT c.id FROM conversations c
    JOIN users u ON u.organization_id = c.organization_id
    WHERE u.id = auth.uid()
  ));

CREATE POLICY "Org members can delete conversation participants"
  ON conversation_participants FOR DELETE TO authenticated
  USING (conversation_id IN (
    SELECT c.id FROM conversations c
    JOIN users u ON u.organization_id = c.organization_id
    WHERE u.id = auth.uid()
  ));

-- ============================================================
-- 5. Create org_vapi_conversation_settings table
-- ============================================================
CREATE TABLE IF NOT EXISTS org_vapi_conversation_settings (
  org_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  auto_create_contacts boolean NOT NULL DEFAULT true,
  store_call_recordings boolean NOT NULL DEFAULT true,
  store_call_summaries boolean NOT NULL DEFAULT true,
  show_tool_events boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE org_vapi_conversation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view vapi conversation settings"
  ON org_vapi_conversation_settings FOR SELECT TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Org members can insert vapi conversation settings"
  ON org_vapi_conversation_settings FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Org members can update vapi conversation settings"
  ON org_vapi_conversation_settings FOR UPDATE TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()))
  WITH CHECK (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));
