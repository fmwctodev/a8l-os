/*
  # Kie.ai Media Studio - Core Tables

  1. New Tables
    - `kie_models` - Registry of all available Kie.ai models (image/video generation)
      - `id` (uuid, primary key)
      - `provider` (text) - upstream provider name e.g. "openai/sora-2"
      - `model_key` (text, unique) - Kie.ai model identifier sent to API
      - `display_name` (text) - human-readable name
      - `type` (text) - "image" or "video"
      - `supports_aspect_ratios` (jsonb) - array of supported ratios
      - `supports_durations` (jsonb) - array of supported durations in seconds
      - `supports_resolutions` (jsonb) - array of supported resolutions
      - `supports_reference_images` (boolean) - whether model accepts image input
      - `supports_negative_prompt` (boolean)
      - `default_params` (jsonb) - default parameter values
      - `enabled` (boolean) - whether model is available for use
      - `is_recommended` (boolean) - show in curated top picks
      - `display_priority` (integer) - sort order (lower = higher priority)
      - `badge_label` (text) - optional badge e.g. "NEW", "FAST", "HD"
      - `short_description` (text) - brief model description
      - `api_endpoint_override` (text) - for models needing non-standard endpoints (Veo)
      - `min_credits` (numeric) - minimum credit cost per generation

    - `media_assets` - Generated media files stored in Supabase storage
      - `id` (uuid, primary key)
      - `organization_id` (uuid, FK)
      - `created_by` (uuid, FK)
      - `job_id` (uuid, FK to media_generation_jobs)
      - `storage_path` (text) - path in Supabase storage bucket
      - `public_url` (text) - CDN URL
      - `thumbnail_url` (text) - thumbnail for video assets
      - `media_type` (text) - "image" or "video"
      - `mime_type` (text)
      - `file_size_bytes` (bigint)
      - `width` (integer)
      - `height` (integer)
      - `duration_seconds` (numeric) - for video
      - `metadata` (jsonb) - additional file metadata
      - `expires_at` (timestamptz) - 30-day auto-purge timestamp
      - `created_at` (timestamptz)

    - `media_generation_jobs` - Async job tracking for Kie.ai API calls
      - `id` (uuid, primary key)
      - `organization_id` (uuid, FK)
      - `created_by` (uuid, FK)
      - `model_id` (uuid, FK to kie_models)
      - `kie_task_id` (text) - Kie.ai remote task ID
      - `status` (text) - waiting/queuing/generating/success/fail/cancelled
      - `prompt` (text)
      - `negative_prompt` (text)
      - `params` (jsonb) - all generation parameters sent
      - `result_urls` (jsonb) - array of result URLs from Kie.ai
      - `error_message` (text)
      - `webhook_received_at` (timestamptz)
      - `started_at` (timestamptz)
      - `completed_at` (timestamptz)
      - `created_at` (timestamptz)
      - `brand_kit_id` (uuid) - optional brand kit used for prompt injection
      - `source_upload_id` (uuid) - optional reference image used
      - `post_id` (uuid) - optional link to social_posts draft

    - `media_source_uploads` - Reference images and avatars uploaded by users
      - `id` (uuid, primary key)
      - `organization_id` (uuid, FK)
      - `created_by` (uuid, FK)
      - `storage_path` (text)
      - `public_url` (text)
      - `filename` (text)
      - `mime_type` (text)
      - `file_size_bytes` (bigint)
      - `purpose` (text) - "reference_image", "avatar", "style_transfer"
      - `created_at` (timestamptz)

  2. Modified Tables
    - `social_posts` - Add `media_asset_ids` uuid array column

  3. Storage
    - Create `social-media-assets` bucket for generated media

  4. Security
    - Enable RLS on all new tables
    - Policies scoped to organization membership
    - kie_models readable by all authenticated users (global catalog)
    - Media tables restricted to same-org users
*/

-- kie_models: global model registry (not org-scoped)
CREATE TABLE IF NOT EXISTS kie_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  model_key text UNIQUE NOT NULL,
  display_name text NOT NULL,
  type text NOT NULL CHECK (type IN ('image', 'video')),
  supports_aspect_ratios jsonb DEFAULT '[]'::jsonb,
  supports_durations jsonb DEFAULT '[]'::jsonb,
  supports_resolutions jsonb DEFAULT '[]'::jsonb,
  supports_reference_images boolean DEFAULT false,
  supports_negative_prompt boolean DEFAULT false,
  default_params jsonb DEFAULT '{}'::jsonb,
  enabled boolean DEFAULT false,
  is_recommended boolean DEFAULT false,
  display_priority integer DEFAULT 100,
  badge_label text,
  short_description text,
  api_endpoint_override text,
  min_credits numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- media_assets: generated media stored in Supabase storage
CREATE TABLE IF NOT EXISTS media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  created_by uuid NOT NULL REFERENCES users(id),
  job_id uuid,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  thumbnail_url text,
  media_type text NOT NULL CHECK (media_type IN ('image', 'video')),
  mime_type text,
  file_size_bytes bigint DEFAULT 0,
  width integer,
  height integer,
  duration_seconds numeric,
  metadata jsonb DEFAULT '{}'::jsonb,
  expires_at timestamptz DEFAULT (now() + interval '30 days'),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_assets_org ON media_assets(organization_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_created_by ON media_assets(created_by);
CREATE INDEX IF NOT EXISTS idx_media_assets_job ON media_assets(job_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_expires ON media_assets(expires_at);

-- media_generation_jobs: async job tracking
CREATE TABLE IF NOT EXISTS media_generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  created_by uuid NOT NULL REFERENCES users(id),
  model_id uuid NOT NULL REFERENCES kie_models(id),
  kie_task_id text,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'queuing', 'generating', 'success', 'fail', 'cancelled')),
  prompt text NOT NULL,
  negative_prompt text,
  params jsonb DEFAULT '{}'::jsonb,
  result_urls jsonb DEFAULT '[]'::jsonb,
  error_message text,
  webhook_received_at timestamptz,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  brand_kit_id uuid,
  source_upload_id uuid,
  post_id uuid
);

CREATE INDEX IF NOT EXISTS idx_media_jobs_org ON media_generation_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_media_jobs_created_by ON media_generation_jobs(created_by);
CREATE INDEX IF NOT EXISTS idx_media_jobs_status ON media_generation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_media_jobs_kie_task ON media_generation_jobs(kie_task_id);
CREATE INDEX IF NOT EXISTS idx_media_jobs_post ON media_generation_jobs(post_id);

-- media_source_uploads: reference images and avatars
CREATE TABLE IF NOT EXISTS media_source_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  created_by uuid NOT NULL REFERENCES users(id),
  storage_path text NOT NULL,
  public_url text NOT NULL,
  filename text,
  mime_type text,
  file_size_bytes bigint DEFAULT 0,
  purpose text NOT NULL DEFAULT 'reference_image' CHECK (purpose IN ('reference_image', 'avatar', 'style_transfer')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_uploads_org ON media_source_uploads(organization_id);

-- Add foreign keys from media_generation_jobs to source uploads and media_assets job_id
ALTER TABLE media_generation_jobs
  ADD CONSTRAINT fk_media_jobs_source_upload
  FOREIGN KEY (source_upload_id) REFERENCES media_source_uploads(id);

ALTER TABLE media_assets
  ADD CONSTRAINT fk_media_assets_job
  FOREIGN KEY (job_id) REFERENCES media_generation_jobs(id);

-- Add media_asset_ids array column to social_posts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_posts' AND column_name = 'media_asset_ids'
  ) THEN
    ALTER TABLE social_posts ADD COLUMN media_asset_ids uuid[] DEFAULT '{}';
  END IF;
END $$;

-- Enable RLS on all new tables
ALTER TABLE kie_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_source_uploads ENABLE ROW LEVEL SECURITY;

-- RLS: kie_models - readable by all authenticated users (global catalog)
CREATE POLICY "Authenticated users can view enabled models"
  ON kie_models FOR SELECT
  TO authenticated
  USING (enabled = true);

CREATE POLICY "SuperAdmin can manage all models"
  ON kie_models FOR ALL
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

-- RLS: media_assets - org-scoped
CREATE POLICY "Users can view own org media assets"
  ON media_assets FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert media assets in own org"
  ON media_assets FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update own media assets"
  ON media_assets FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete own media assets"
  ON media_assets FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- RLS: media_generation_jobs - org-scoped
CREATE POLICY "Users can view own org generation jobs"
  ON media_generation_jobs FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create generation jobs in own org"
  ON media_generation_jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update own generation jobs"
  ON media_generation_jobs FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- RLS: media_source_uploads - org-scoped
CREATE POLICY "Users can view own org source uploads"
  ON media_source_uploads FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert source uploads in own org"
  ON media_source_uploads FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own source uploads"
  ON media_source_uploads FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Create storage bucket for generated media
INSERT INTO storage.buckets (id, name, public)
VALUES ('social-media-assets', 'social-media-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: allow authenticated users to upload/read from the bucket
CREATE POLICY "Authenticated users can upload media assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'social-media-assets');

CREATE POLICY "Anyone can view media assets"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'social-media-assets');

CREATE POLICY "Users can delete own media assets from storage"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'social-media-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
