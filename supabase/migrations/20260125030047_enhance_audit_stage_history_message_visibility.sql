/*
  # Enhance Audit Logging, Stage History, and Message Visibility

  ## Overview
  This migration adds enhancements for comprehensive audit tracking, opportunity
  stage history, and message soft-delete functionality.

  ## 1. Audit Logs Enhancements
  - Add `organization_id` column for org-scoped filtering
  - Add `actor_user_name` column for display without joins
  - Add `user_agent` column for device/browser tracking
  - Add indexes for efficient querying

  ## 2. New Tables
  ### opportunity_stage_history
  - Tracks all stage changes for opportunities
  - `id` (uuid, primary key) - Unique identifier
  - `org_id` (uuid, FK) - Organization reference
  - `opportunity_id` (uuid, FK) - Reference to opportunity
  - `from_stage_id` (uuid, FK, nullable) - Previous stage
  - `to_stage_id` (uuid, FK) - New stage
  - `changed_at` (timestamptz) - When the change occurred
  - `changed_by_user_id` (uuid, FK) - User who made the change

  ## 3. Messages Table Updates
  - Add `hidden_at` column for soft-delete timestamp
  - Add `hidden_by_user_id` column for audit trail
  - Messages with hidden_at set are excluded from UI queries

  ## 4. Security
  - Enable RLS on opportunity_stage_history
  - Add appropriate policies for organization access
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'actor_user_name'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN actor_user_name text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'user_agent'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN user_agent text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_logs_organization ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);

CREATE TABLE IF NOT EXISTS opportunity_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  from_stage_id uuid REFERENCES pipeline_stages(id) ON DELETE SET NULL,
  to_stage_id uuid NOT NULL REFERENCES pipeline_stages(id) ON DELETE CASCADE,
  changed_at timestamptz DEFAULT now() NOT NULL,
  changed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_opp_stage_history_org ON opportunity_stage_history(org_id);
CREATE INDEX IF NOT EXISTS idx_opp_stage_history_opportunity ON opportunity_stage_history(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opp_stage_history_changed_at ON opportunity_stage_history(changed_at DESC);

ALTER TABLE opportunity_stage_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'opportunity_stage_history' AND policyname = 'Users can view their org stage history'
  ) THEN
    CREATE POLICY "Users can view their org stage history"
      ON opportunity_stage_history
      FOR SELECT
      TO authenticated
      USING (
        org_id IN (
          SELECT organization_id FROM users WHERE id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'opportunity_stage_history' AND policyname = 'Users can insert stage history in their org'
  ) THEN
    CREATE POLICY "Users can insert stage history in their org"
      ON opportunity_stage_history
      FOR INSERT
      TO authenticated
      WITH CHECK (
        org_id IN (
          SELECT organization_id FROM users WHERE id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'hidden_at'
  ) THEN
    ALTER TABLE messages ADD COLUMN hidden_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'hidden_by_user_id'
  ) THEN
    ALTER TABLE messages ADD COLUMN hidden_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_messages_hidden ON messages(conversation_id) WHERE hidden_at IS NULL;