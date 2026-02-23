/*
  # AI Social Manager Module

  1. New Tables
    - `social_ai_threads` - Chat conversation threads between users and the AI social strategist
      - `id` (uuid, primary key)
      - `organization_id` (uuid, FK to organizations)
      - `user_id` (uuid, FK to auth.users)
      - `title` (text) - Auto-generated from first message
      - `status` (text: active/archived)
      - `created_at`, `updated_at` (timestamptz)

    - `social_ai_messages` - Individual messages within chat threads
      - `id` (uuid, primary key)
      - `thread_id` (uuid, FK to social_ai_threads)
      - `role` (text: user/assistant/system)
      - `content` (text) - Message text
      - `message_type` (text) - Type classification
      - `attachments` (jsonb) - URLs, file refs, scraped content
      - `generated_posts` (jsonb) - Platform-specific draft array
      - `metadata` (jsonb) - Engagement predictions, brand context
      - `created_at` (timestamptz)

    - `social_campaigns` - Recurring campaign definitions
      - `id` (uuid, primary key)
      - `organization_id` (uuid, FK)
      - `created_by` (uuid, FK)
      - `name`, `description`, `theme` (text)
      - `frequency` (text: daily/weekly/biweekly/monthly)
      - `platforms` (jsonb) - Target platform array
      - `content_type`, `hook_style_preset` (text)
      - `approval_required`, `autopilot_mode` (boolean)
      - `status` (text: active/paused/completed)
      - `next_generation_at`, `last_generated_at` (timestamptz)
      - `post_count` (integer)

    - `social_guidelines` - User and workspace content memory/preferences
      - `id` (uuid, primary key)
      - `organization_id` (uuid, FK)
      - `user_id` (uuid, FK, nullable - null = workspace-level)
      - Tone, hashtag, CTA, emoji, visual style preferences
      - Unique constraint on (organization_id, user_id)

    - `social_content_patterns` - Performance learning data
      - `id` (uuid, primary key)
      - `organization_id` (uuid, FK)
      - `post_id` (uuid, FK to social_posts)
      - Hook type, content topic, engagement metrics
      - Platform, posting time data

  2. Modified Tables
    - `social_posts` - Added columns:
      - `campaign_id` (uuid, FK to social_campaigns)
      - `thread_id` (uuid, FK to social_ai_threads)
      - `engagement_prediction` (numeric)
      - `hook_text`, `cta_text` (text)
      - `hashtags` (text[])
      - `visual_style_suggestion` (text)
      - `ab_variant_group` (uuid)

  3. Security
    - RLS enabled on all new tables
    - Policies scoped to organization membership via auth.uid()
    - Separate SELECT, INSERT, UPDATE, DELETE policies
*/

-- ─────────────────────────────────────────────
-- 1. social_ai_threads
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_ai_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_ai_threads_org_user
  ON social_ai_threads(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_social_ai_threads_status
  ON social_ai_threads(organization_id, status);

ALTER TABLE social_ai_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org threads"
  ON social_ai_threads FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create threads in own org"
  ON social_ai_threads FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.users WHERE id = auth.uid()
    )
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can update own threads"
  ON social_ai_threads FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own threads"
  ON social_ai_threads FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- 2. social_ai_messages
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES social_ai_threads(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL DEFAULT '',
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN (
    'text', 'url_scrape', 'youtube_transcript', 'file_upload',
    'post_draft', 'campaign_request', 'image_suggestion'
  )),
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_posts jsonb DEFAULT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_ai_messages_thread
  ON social_ai_messages(thread_id, created_at);

ALTER TABLE social_ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in own org threads"
  ON social_ai_messages FOR SELECT TO authenticated
  USING (
    thread_id IN (
      SELECT t.id FROM social_ai_threads t
      JOIN public.users u ON u.organization_id = t.organization_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages into own threads"
  ON social_ai_messages FOR INSERT TO authenticated
  WITH CHECK (
    thread_id IN (
      SELECT id FROM social_ai_threads WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete messages in own threads"
  ON social_ai_messages FOR DELETE TO authenticated
  USING (
    thread_id IN (
      SELECT id FROM social_ai_threads WHERE user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────
-- 3. social_campaigns
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  theme text NOT NULL DEFAULT '',
  frequency text NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly')),
  platforms jsonb NOT NULL DEFAULT '[]'::jsonb,
  content_type text NOT NULL DEFAULT '',
  hook_style_preset text NOT NULL DEFAULT 'question' CHECK (hook_style_preset IN (
    'question', 'statistic', 'story', 'bold_claim', 'educational'
  )),
  approval_required boolean NOT NULL DEFAULT false,
  autopilot_mode boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  next_generation_at timestamptz DEFAULT NULL,
  last_generated_at timestamptz DEFAULT NULL,
  post_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_campaigns_org_status
  ON social_campaigns(organization_id, status);

ALTER TABLE social_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view campaigns in own org"
  ON social_campaigns FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create campaigns in own org"
  ON social_campaigns FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.users WHERE id = auth.uid()
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Users can update campaigns in own org"
  ON social_campaigns FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete campaigns in own org"
  ON social_campaigns FOR DELETE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users WHERE id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────
-- 4. social_guidelines
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_guidelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  tone_preferences jsonb NOT NULL DEFAULT '{"formality":50,"friendliness":50,"energy":50,"confidence":50}'::jsonb,
  words_to_avoid text[] NOT NULL DEFAULT '{}',
  hashtag_preferences jsonb NOT NULL DEFAULT '{"preferred":[],"banned":[]}'::jsonb,
  cta_rules text[] NOT NULL DEFAULT '{}',
  emoji_rules jsonb NOT NULL DEFAULT '{"frequency":"minimal","banned":[]}'::jsonb,
  industry_positioning text NOT NULL DEFAULT '',
  visual_style_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  platform_tweaks jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_social_guidelines_org_user UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_social_guidelines_org
  ON social_guidelines(organization_id);

ALTER TABLE social_guidelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view guidelines in own org"
  ON social_guidelines FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create guidelines in own org"
  ON social_guidelines FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.users WHERE id = auth.uid()
    )
    AND (user_id IS NULL OR user_id = auth.uid())
  );

CREATE POLICY "Users can update own or workspace guidelines"
  ON social_guidelines FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users WHERE id = auth.uid()
    )
    AND (user_id IS NULL OR user_id = auth.uid())
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.users WHERE id = auth.uid()
    )
    AND (user_id IS NULL OR user_id = auth.uid())
  );

CREATE POLICY "Users can delete own guidelines"
  ON social_guidelines FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
  );

-- ─────────────────────────────────────────────
-- 5. social_content_patterns
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_content_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  post_id uuid REFERENCES social_posts(id) ON DELETE SET NULL,
  hook_type text NOT NULL DEFAULT '',
  content_topic text NOT NULL DEFAULT '',
  hashtags_used text[] NOT NULL DEFAULT '{}',
  visual_style text NOT NULL DEFAULT '',
  posting_hour integer NOT NULL DEFAULT 0 CHECK (posting_hour >= 0 AND posting_hour <= 23),
  posting_day integer NOT NULL DEFAULT 0 CHECK (posting_day >= 0 AND posting_day <= 6),
  engagement_rate numeric NOT NULL DEFAULT 0,
  reach integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  platform text NOT NULL DEFAULT '',
  analyzed_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_content_patterns_org_platform
  ON social_content_patterns(organization_id, platform);

ALTER TABLE social_content_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view patterns in own org"
  ON social_content_patterns FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create patterns in own org"
  ON social_content_patterns FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update patterns in own org"
  ON social_content_patterns FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete patterns in own org"
  ON social_content_patterns FOR DELETE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users WHERE id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────
-- 6. Extend social_posts with new columns
-- ─────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_posts' AND column_name = 'campaign_id'
  ) THEN
    ALTER TABLE social_posts ADD COLUMN campaign_id uuid REFERENCES social_campaigns(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_posts' AND column_name = 'thread_id'
  ) THEN
    ALTER TABLE social_posts ADD COLUMN thread_id uuid REFERENCES social_ai_threads(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_posts' AND column_name = 'engagement_prediction'
  ) THEN
    ALTER TABLE social_posts ADD COLUMN engagement_prediction numeric DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_posts' AND column_name = 'hook_text'
  ) THEN
    ALTER TABLE social_posts ADD COLUMN hook_text text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_posts' AND column_name = 'cta_text'
  ) THEN
    ALTER TABLE social_posts ADD COLUMN cta_text text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_posts' AND column_name = 'hashtags'
  ) THEN
    ALTER TABLE social_posts ADD COLUMN hashtags text[] DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_posts' AND column_name = 'visual_style_suggestion'
  ) THEN
    ALTER TABLE social_posts ADD COLUMN visual_style_suggestion text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_posts' AND column_name = 'ab_variant_group'
  ) THEN
    ALTER TABLE social_posts ADD COLUMN ab_variant_group uuid DEFAULT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_social_posts_campaign
  ON social_posts(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_social_posts_thread
  ON social_posts(thread_id) WHERE thread_id IS NOT NULL;
