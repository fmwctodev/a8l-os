/*
  # Extend Reputation Settings - AI and Automation

  1. Schema Changes
    - Add AI provider settings to reputation_settings
    - Add brand voice and response tone settings
    - Add negative review automation settings
    - Add notification settings
*/

-- Add AI and automation settings to reputation_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reputation_settings' AND column_name = 'ai_provider'
  ) THEN
    ALTER TABLE reputation_settings ADD COLUMN ai_provider text DEFAULT 'openai' CHECK (ai_provider IN ('openai', 'anthropic', 'both'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reputation_settings' AND column_name = 'brand_voice_description'
  ) THEN
    ALTER TABLE reputation_settings ADD COLUMN brand_voice_description text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reputation_settings' AND column_name = 'response_tone'
  ) THEN
    ALTER TABLE reputation_settings ADD COLUMN response_tone text DEFAULT 'professional' CHECK (response_tone IN ('professional', 'friendly', 'apologetic', 'casual'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reputation_settings' AND column_name = 'auto_analyze_reviews'
  ) THEN
    ALTER TABLE reputation_settings ADD COLUMN auto_analyze_reviews boolean DEFAULT true;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reputation_settings' AND column_name = 'negative_review_threshold'
  ) THEN
    ALTER TABLE reputation_settings ADD COLUMN negative_review_threshold integer DEFAULT 3 CHECK (negative_review_threshold >= 1 AND negative_review_threshold <= 5);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reputation_settings' AND column_name = 'negative_review_create_task'
  ) THEN
    ALTER TABLE reputation_settings ADD COLUMN negative_review_create_task boolean DEFAULT true;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reputation_settings' AND column_name = 'negative_review_task_assignee'
  ) THEN
    ALTER TABLE reputation_settings ADD COLUMN negative_review_task_assignee uuid REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reputation_settings' AND column_name = 'negative_review_task_due_hours'
  ) THEN
    ALTER TABLE reputation_settings ADD COLUMN negative_review_task_due_hours integer DEFAULT 24;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reputation_settings' AND column_name = 'negative_review_notify_email'
  ) THEN
    ALTER TABLE reputation_settings ADD COLUMN negative_review_notify_email boolean DEFAULT true;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reputation_settings' AND column_name = 'negative_review_notify_sms'
  ) THEN
    ALTER TABLE reputation_settings ADD COLUMN negative_review_notify_sms boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reputation_settings' AND column_name = 'notification_recipients'
  ) THEN
    ALTER TABLE reputation_settings ADD COLUMN notification_recipients uuid[] DEFAULT '{}';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reputation_settings' AND column_name = 'response_time_goal_hours'
  ) THEN
    ALTER TABLE reputation_settings ADD COLUMN response_time_goal_hours integer DEFAULT 24;
  END IF;
END $$;
