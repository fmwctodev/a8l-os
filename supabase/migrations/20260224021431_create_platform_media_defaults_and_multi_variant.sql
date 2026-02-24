/*
  # Platform Media Defaults & Multi-Variant Generation Tables

  1. New Tables
    - `platform_media_defaults` - Per-platform recommended media settings
      - `id` (uuid, primary key)
      - `platform` (text) - instagram, tiktok, youtube, facebook, linkedin, gbp
      - `content_format` (text) - feed_post, story, reel, cover, etc.
      - `recommended_model_id` (uuid, FK to kie_models)
      - `default_aspect_ratio` (text) - e.g. "1:1", "9:16", "16:9"
      - `default_resolution` (text)
      - `default_duration` (integer) - seconds, for video
      - `max_duration` (integer) - platform max
      - `max_file_size_mb` (integer)
      - `prompt_suffix` (text) - platform-specific prompt additions
      - `notes` (text) - admin notes
      - `enabled` (boolean)

    - `multi_variant_jobs` - Parent job for multi-platform generation
      - `id` (uuid, primary key)
      - `organization_id` (uuid, FK)
      - `created_by` (uuid, FK)
      - `base_prompt` (text) - original user prompt
      - `platforms` (jsonb) - array of target platforms
      - `status` (text) - pending/processing/completed/partial_fail/failed
      - `total_variants` (integer)
      - `completed_variants` (integer)
      - `created_at` (timestamptz)
      - `completed_at` (timestamptz)

    - `multi_variant_children` - Individual platform variants within a multi-variant job
      - `id` (uuid, primary key)
      - `parent_job_id` (uuid, FK to multi_variant_jobs)
      - `platform` (text)
      - `content_format` (text)
      - `generation_job_id` (uuid, FK to media_generation_jobs)
      - `adapted_prompt` (text) - platform-optimized prompt
      - `aspect_ratio` (text)
      - `resolution` (text)
      - `duration` (integer)
      - `status` (text) - pending/generating/success/fail
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all new tables
    - platform_media_defaults readable by authenticated users
    - multi_variant tables scoped to organization
*/

-- platform_media_defaults: per-platform recommended settings
CREATE TABLE IF NOT EXISTS platform_media_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'gbp')),
  content_format text NOT NULL DEFAULT 'feed_post',
  recommended_model_id uuid REFERENCES kie_models(id),
  default_aspect_ratio text,
  default_resolution text,
  default_duration integer,
  max_duration integer,
  max_file_size_mb integer,
  prompt_suffix text,
  notes text,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(platform, content_format)
);

-- multi_variant_jobs: parent orchestration for multi-platform generation
CREATE TABLE IF NOT EXISTS multi_variant_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  created_by uuid NOT NULL REFERENCES users(id),
  base_prompt text NOT NULL,
  platforms jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'partial_fail', 'failed')),
  total_variants integer NOT NULL DEFAULT 0,
  completed_variants integer NOT NULL DEFAULT 0,
  brand_kit_id uuid,
  source_upload_id uuid REFERENCES media_source_uploads(id),
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_multi_variant_jobs_org ON multi_variant_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_multi_variant_jobs_status ON multi_variant_jobs(status);

-- multi_variant_children: individual platform variants
CREATE TABLE IF NOT EXISTS multi_variant_children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_job_id uuid NOT NULL REFERENCES multi_variant_jobs(id),
  platform text NOT NULL,
  content_format text NOT NULL DEFAULT 'feed_post',
  generation_job_id uuid REFERENCES media_generation_jobs(id),
  adapted_prompt text,
  aspect_ratio text,
  resolution text,
  duration integer,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'success', 'fail')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_multi_variant_children_parent ON multi_variant_children(parent_job_id);
CREATE INDEX IF NOT EXISTS idx_multi_variant_children_gen_job ON multi_variant_children(generation_job_id);

-- Enable RLS
ALTER TABLE platform_media_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE multi_variant_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE multi_variant_children ENABLE ROW LEVEL SECURITY;

-- RLS: platform_media_defaults - readable by all authenticated (global config)
CREATE POLICY "Authenticated users can view platform defaults"
  ON platform_media_defaults FOR SELECT
  TO authenticated
  USING (enabled = true);

CREATE POLICY "SuperAdmin can manage platform defaults"
  ON platform_media_defaults FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = auth.uid() AND r.name = 'SuperAdmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = auth.uid() AND r.name = 'SuperAdmin'
    )
  );

-- RLS: multi_variant_jobs - org-scoped
CREATE POLICY "Users can view own org multi-variant jobs"
  ON multi_variant_jobs FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create multi-variant jobs in own org"
  ON multi_variant_jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update own multi-variant jobs"
  ON multi_variant_jobs FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- RLS: multi_variant_children - via parent job org check
CREATE POLICY "Users can view own org variant children"
  ON multi_variant_children FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM multi_variant_jobs mvj
      WHERE mvj.id = multi_variant_children.parent_job_id
      AND mvj.organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create variant children for own jobs"
  ON multi_variant_children FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM multi_variant_jobs mvj
      WHERE mvj.id = multi_variant_children.parent_job_id
      AND mvj.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update own variant children"
  ON multi_variant_children FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM multi_variant_jobs mvj
      WHERE mvj.id = multi_variant_children.parent_job_id
      AND mvj.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM multi_variant_jobs mvj
      WHERE mvj.id = multi_variant_children.parent_job_id
      AND mvj.created_by = auth.uid()
    )
  );
