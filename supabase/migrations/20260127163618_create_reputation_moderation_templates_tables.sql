/*
  # Create Review Moderation and Templates Tables

  1. New Tables
    - `review_moderation_log` - Audit trail for moderation actions
    - `review_templates` - A/B testing templates for review requests

  2. Security
    - Enable RLS with appropriate policies
*/

-- Create review_moderation_log table
CREATE TABLE IF NOT EXISTS review_moderation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  review_id uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('spam_flagged', 'spam_unflagged', 'hidden', 'unhidden', 'reply_edited', 'reply_deleted')),
  performed_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  previous_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_moderation_log_org ON review_moderation_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_review_moderation_log_review ON review_moderation_log(review_id);
CREATE INDEX IF NOT EXISTS idx_review_moderation_log_action ON review_moderation_log(action);
CREATE INDEX IF NOT EXISTS idx_review_moderation_log_created ON review_moderation_log(created_at DESC);

ALTER TABLE review_moderation_log ENABLE ROW LEVEL SECURITY;

-- Create review_templates table for A/B testing
CREATE TABLE IF NOT EXISTS review_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('sms', 'email')),
  subject text,
  body text NOT NULL,
  is_active boolean DEFAULT true,
  is_default boolean DEFAULT false,
  total_sent integer DEFAULT 0,
  total_clicked integer DEFAULT 0,
  total_completed integer DEFAULT 0,
  conversion_rate numeric(5,2) DEFAULT 0,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_templates_org ON review_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_review_templates_channel ON review_templates(channel);
CREATE INDEX IF NOT EXISTS idx_review_templates_active ON review_templates(is_active);

ALTER TABLE review_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for review_moderation_log
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'review_moderation_log' AND policyname = 'Users can view own org moderation logs'
  ) THEN
    CREATE POLICY "Users can view own org moderation logs"
      ON review_moderation_log FOR SELECT
      TO authenticated
      USING (
        organization_id IN (
          SELECT organization_id FROM users WHERE id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'review_moderation_log' AND policyname = 'Users with permission can create moderation logs'
  ) THEN
    CREATE POLICY "Users with permission can create moderation logs"
      ON review_moderation_log FOR INSERT
      TO authenticated
      WITH CHECK (
        organization_id IN (
          SELECT organization_id FROM users WHERE id = auth.uid()
        )
        AND EXISTS (
          SELECT 1 FROM users u
          JOIN role_permissions rp ON u.role_id = rp.role_id
          JOIN permissions p ON rp.permission_id = p.id
          WHERE u.id = auth.uid()
          AND p.key = 'reputation.manage'
        )
      );
  END IF;
END $$;

-- RLS Policies for review_templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'review_templates' AND policyname = 'Users can view own org templates'
  ) THEN
    CREATE POLICY "Users can view own org templates"
      ON review_templates FOR SELECT
      TO authenticated
      USING (
        organization_id IN (
          SELECT organization_id FROM users WHERE id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'review_templates' AND policyname = 'Users with permission can manage templates'
  ) THEN
    CREATE POLICY "Users with permission can manage templates"
      ON review_templates FOR ALL
      TO authenticated
      USING (
        organization_id IN (
          SELECT organization_id FROM users WHERE id = auth.uid()
        )
        AND EXISTS (
          SELECT 1 FROM users u
          JOIN role_permissions rp ON u.role_id = rp.role_id
          JOIN permissions p ON rp.permission_id = p.id
          WHERE u.id = auth.uid()
          AND p.key = 'reputation.manage'
        )
      )
      WITH CHECK (
        organization_id IN (
          SELECT organization_id FROM users WHERE id = auth.uid()
        )
        AND EXISTS (
          SELECT 1 FROM users u
          JOIN role_permissions rp ON u.role_id = rp.role_id
          JOIN permissions p ON rp.permission_id = p.id
          WHERE u.id = auth.uid()
          AND p.key = 'reputation.manage'
        )
      );
  END IF;
END $$;
