/*
  # Create Social AI Learning Signals Table
  
  1. New Tables
    - `social_ai_learning_signals`
      - Stores extracted features from social posts for AI learning
      - Includes content characteristics, timing data, and performance metrics
      - Used to derive patterns and insights for content recommendations
  
  2. Columns
    - `id` (uuid, primary key)
    - `organization_id` (uuid, foreign key)
    - `post_id` (uuid, foreign key to social_posts)
    - `platform` (text) - the social platform
    - Content features:
      - `hook_text` (text) - first 120 characters of caption
      - `caption_length` (integer) - total caption character count
      - `word_count` (integer)
      - `emoji_count` (integer)
      - `hashtag_count` (integer)
      - `mention_count` (integer)
      - `has_cta` (boolean) - contains call-to-action
      - `has_question` (boolean) - contains question mark
      - `has_link` (boolean)
    - Media features:
      - `media_type` (text) - image, video, carousel, text
      - `media_count` (integer)
      - `video_duration_seconds` (integer)
      - `has_music` (boolean) - for video content
    - Timing features:
      - `posting_hour` (integer) - 0-23 UTC
      - `posting_day_of_week` (integer) - 0-6 (Sunday = 0)
      - `posting_month` (integer) - 1-12
    - Performance metrics:
      - `engagement_score` (numeric) - overall engagement rate
      - `reach_score` (numeric) - reach as % of followers
      - `engagement_percentile` (numeric) - percentile rank within org
      - `is_high_performer` (boolean) - above 75th percentile
      - `is_low_performer` (boolean) - below 25th percentile
    - `analyzed_at` (timestamptz)
    - `created_at` (timestamptz)
  
  3. Indexes
    - Organization + platform for filtering
    - High performer flag for quick pattern analysis
    - Posting time columns for timing analysis
  
  4. Security
    - Enable RLS with organization-scoped policies
*/

-- Create social_ai_learning_signals table
CREATE TABLE IF NOT EXISTS social_ai_learning_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  platform text NOT NULL,
  
  -- Content features
  hook_text text,
  caption_length integer DEFAULT 0,
  word_count integer DEFAULT 0,
  emoji_count integer DEFAULT 0,
  hashtag_count integer DEFAULT 0,
  mention_count integer DEFAULT 0,
  has_cta boolean DEFAULT false,
  has_question boolean DEFAULT false,
  has_link boolean DEFAULT false,
  
  -- Media features
  media_type text DEFAULT 'text',
  media_count integer DEFAULT 0,
  video_duration_seconds integer,
  has_music boolean DEFAULT false,
  
  -- Timing features
  posting_hour integer,
  posting_day_of_week integer,
  posting_month integer,
  
  -- Performance metrics
  engagement_score numeric(10, 4) DEFAULT 0,
  reach_score numeric(10, 4) DEFAULT 0,
  engagement_percentile numeric(5, 2),
  is_high_performer boolean DEFAULT false,
  is_low_performer boolean DEFAULT false,
  
  analyzed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- Ensure one signal record per post
  CONSTRAINT unique_post_learning_signal UNIQUE (post_id)
);

-- Create indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_ai_learning_org_platform 
  ON social_ai_learning_signals(organization_id, platform);

CREATE INDEX IF NOT EXISTS idx_ai_learning_high_performers 
  ON social_ai_learning_signals(organization_id, is_high_performer) 
  WHERE is_high_performer = true;

CREATE INDEX IF NOT EXISTS idx_ai_learning_timing 
  ON social_ai_learning_signals(organization_id, posting_day_of_week, posting_hour);

CREATE INDEX IF NOT EXISTS idx_ai_learning_media_type 
  ON social_ai_learning_signals(organization_id, media_type);

CREATE INDEX IF NOT EXISTS idx_ai_learning_analyzed 
  ON social_ai_learning_signals(organization_id, analyzed_at DESC);

-- Enable RLS
ALTER TABLE social_ai_learning_signals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their organization's learning signals"
  ON social_ai_learning_signals FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert learning signals for their organization"
  ON social_ai_learning_signals FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update learning signals for their organization"
  ON social_ai_learning_signals FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete learning signals for their organization"
  ON social_ai_learning_signals FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );