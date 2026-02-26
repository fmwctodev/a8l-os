/*
  # Extend Media Generation Jobs for Multi-Endpoint Support

  1. Modified Tables
    - `media_generation_jobs`
      - `job_type` (text) - generation type: text_to_video, image_to_video, text_to_image, etc.
      - `style_preset_id` (uuid, FK) - optional link to media_style_presets
      - `source_image_urls` (jsonb) - image URLs for image-to-video jobs
      - `upgrade_task_ids` (jsonb) - tracks 1080p/4K upgrade task IDs

  2. Indexes
    - Index on job_type for filtered queries
    - Index on style_preset_id for joins

  3. Important Notes
    - All new columns are nullable for backwards compatibility
    - Existing jobs remain unaffected
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'media_generation_jobs' AND column_name = 'job_type'
  ) THEN
    ALTER TABLE media_generation_jobs ADD COLUMN job_type text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'media_generation_jobs' AND column_name = 'style_preset_id'
  ) THEN
    ALTER TABLE media_generation_jobs ADD COLUMN style_preset_id uuid REFERENCES media_style_presets(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'media_generation_jobs' AND column_name = 'source_image_urls'
  ) THEN
    ALTER TABLE media_generation_jobs ADD COLUMN source_image_urls jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'media_generation_jobs' AND column_name = 'upgrade_task_ids'
  ) THEN
    ALTER TABLE media_generation_jobs ADD COLUMN upgrade_task_ids jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_media_generation_jobs_job_type ON media_generation_jobs (job_type);
CREATE INDEX IF NOT EXISTS idx_media_generation_jobs_style_preset_id ON media_generation_jobs (style_preset_id);
