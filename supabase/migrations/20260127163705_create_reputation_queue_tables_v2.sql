/*
  # Create Review Sync and Reply Queue Tables

  1. New Tables
    - `review_sync_queue` - Queue for managing review sync jobs
    - `review_reply_queue` - Queue for managing reply posting jobs
    - `negative_review_tasks` - Links negative reviews to tasks

  2. Security
    - Enable RLS with appropriate policies
*/

-- Create review_sync_queue table for managing sync jobs
CREATE TABLE IF NOT EXISTS review_sync_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES review_providers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  started_at timestamptz,
  completed_at timestamptz,
  reviews_synced integer DEFAULT 0,
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_sync_queue_org ON review_sync_queue(organization_id);
CREATE INDEX IF NOT EXISTS idx_review_sync_queue_status ON review_sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_review_sync_queue_provider ON review_sync_queue(provider_id);

ALTER TABLE review_sync_queue ENABLE ROW LEVEL SECURITY;

-- Create review_reply_queue table for managing reply posting
CREATE TABLE IF NOT EXISTS review_reply_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  review_id uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google', 'facebook', 'yelp')),
  reply_text text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'posted', 'failed')),
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  last_error text,
  scheduled_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_reply_queue_org ON review_reply_queue(organization_id);
CREATE INDEX IF NOT EXISTS idx_review_reply_queue_status ON review_reply_queue(status);
CREATE INDEX IF NOT EXISTS idx_review_reply_queue_review ON review_reply_queue(review_id);

ALTER TABLE review_reply_queue ENABLE ROW LEVEL SECURITY;

-- Create negative_review_tasks table
CREATE TABLE IF NOT EXISTS negative_review_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  review_id uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES contact_tasks(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  notification_sent_at timestamptz,
  notification_method text CHECK (notification_method IN ('email', 'sms', 'both')),
  follow_up_completed boolean DEFAULT false,
  follow_up_completed_at timestamptz,
  follow_up_notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(review_id)
);

CREATE INDEX IF NOT EXISTS idx_negative_review_tasks_org ON negative_review_tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_negative_review_tasks_review ON negative_review_tasks(review_id);
CREATE INDEX IF NOT EXISTS idx_negative_review_tasks_task ON negative_review_tasks(task_id);

ALTER TABLE negative_review_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for review_sync_queue
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'review_sync_queue' AND policyname = 'Users can view own org sync queue'
  ) THEN
    CREATE POLICY "Users can view own org sync queue"
      ON review_sync_queue FOR SELECT
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
    WHERE tablename = 'review_sync_queue' AND policyname = 'Service role can manage sync queue'
  ) THEN
    CREATE POLICY "Service role can manage sync queue"
      ON review_sync_queue FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- RLS Policies for review_reply_queue
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'review_reply_queue' AND policyname = 'Users can view own org reply queue'
  ) THEN
    CREATE POLICY "Users can view own org reply queue"
      ON review_reply_queue FOR SELECT
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
    WHERE tablename = 'review_reply_queue' AND policyname = 'Users with permission can create reply queue entries'
  ) THEN
    CREATE POLICY "Users with permission can create reply queue entries"
      ON review_reply_queue FOR INSERT
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
          AND p.key IN ('reputation.manage', 'reputation.reply')
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'review_reply_queue' AND policyname = 'Service role can manage reply queue'
  ) THEN
    CREATE POLICY "Service role can manage reply queue"
      ON review_reply_queue FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- RLS Policies for negative_review_tasks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'negative_review_tasks' AND policyname = 'Users can view own org negative review tasks'
  ) THEN
    CREATE POLICY "Users can view own org negative review tasks"
      ON negative_review_tasks FOR SELECT
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
    WHERE tablename = 'negative_review_tasks' AND policyname = 'Service role can manage negative review tasks'
  ) THEN
    CREATE POLICY "Service role can manage negative review tasks"
      ON negative_review_tasks FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Add new permissions for reputation module
INSERT INTO permissions (key, description, module_name)
VALUES 
  ('reputation.reply', 'Can post replies to reviews on external platforms', 'reputation'),
  ('reputation.spam.manage', 'Can flag and manage spam reviews', 'reputation'),
  ('reputation.analytics.view', 'Can view advanced review analytics', 'reputation')
ON CONFLICT (key) DO NOTHING;

-- Grant new permissions to admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Admin'
AND p.key IN ('reputation.reply', 'reputation.spam.manage', 'reputation.analytics.view')
ON CONFLICT DO NOTHING;

-- Grant reply permission to manager role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Manager'
AND p.key IN ('reputation.reply', 'reputation.analytics.view')
ON CONFLICT DO NOTHING;
