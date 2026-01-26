/*
  # Create Social Post Metrics Table for Analytics
  
  1. New Tables
    - `social_post_metrics`
      - `id` (uuid, primary key)
      - `post_id` (uuid, foreign key to social_posts)
      - `organization_id` (uuid, foreign key to organizations)
      - `platform` (text) - instagram, facebook, linkedin, tiktok, youtube, twitter
      - `impressions` (integer) - total times content was displayed
      - `reach` (integer) - unique accounts that saw the content
      - `likes` (integer) - total likes/reactions
      - `comments` (integer) - total comments
      - `shares` (integer) - shares/reposts/retweets
      - `saves` (integer) - saves/bookmarks
      - `clicks` (integer) - link clicks
      - `video_views` (integer) - video view count if applicable
      - `watch_time_seconds` (integer) - total watch time for videos
      - `engagement_score` (numeric) - calculated engagement rate
      - `reach_score` (numeric) - reach as percentage of followers
      - `fetched_at` (timestamptz) - when metrics were last fetched
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Indexes
    - Composite index on (post_id, fetched_at) for latest metrics lookup
    - Index on (organization_id, platform, fetched_at) for platform analytics
    - Index on (organization_id, created_at) for time-based queries
  
  3. Security
    - Enable RLS
    - Policies for organization-scoped access
*/

-- Create social_post_metrics table
CREATE TABLE IF NOT EXISTS social_post_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  platform text NOT NULL,
  impressions integer DEFAULT 0,
  reach integer DEFAULT 0,
  likes integer DEFAULT 0,
  comments integer DEFAULT 0,
  shares integer DEFAULT 0,
  saves integer DEFAULT 0,
  clicks integer DEFAULT 0,
  video_views integer DEFAULT 0,
  watch_time_seconds integer DEFAULT 0,
  engagement_score numeric(10, 4) DEFAULT 0,
  reach_score numeric(10, 4) DEFAULT 0,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_social_post_metrics_post_fetched 
  ON social_post_metrics(post_id, fetched_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_post_metrics_org_platform_fetched 
  ON social_post_metrics(organization_id, platform, fetched_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_post_metrics_org_created 
  ON social_post_metrics(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_post_metrics_engagement 
  ON social_post_metrics(organization_id, engagement_score DESC);

-- Enable RLS
ALTER TABLE social_post_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their organization's post metrics"
  ON social_post_metrics FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert metrics for their organization"
  ON social_post_metrics FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update metrics for their organization"
  ON social_post_metrics FOR UPDATE
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

CREATE POLICY "Users can delete metrics for their organization"
  ON social_post_metrics FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_social_post_metrics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_social_post_metrics_updated_at
  BEFORE UPDATE ON social_post_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_social_post_metrics_updated_at();