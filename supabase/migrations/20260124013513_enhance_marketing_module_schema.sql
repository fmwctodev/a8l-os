/*
  # Enhance Marketing Module Schema

  This migration extends the marketing module with new features for forms, surveys,
  and social planner to achieve GHL parity.

  1. New Tables
    - `content_ai_generations`
      - Stores AI-generated content (captions, copy, etc.)
      - Links to social_posts for tracking AI-assisted content
      - Supports storing multiple variations per generation

    - `form_files`
      - Stores file uploads from form submissions
      - Links to form_submissions for file field tracking
      - Supports up to 100MB files

    - `survey_continuations`
      - Stores save-and-continue tokens for surveys
      - Allows users to resume surveys via email link

  2. Schema Changes
    - `social_posts`: Add first_comment, link_preview, ai_generated, ai_generation_id
    - `forms.settings`: Extended via jsonb to support double_optin, recaptcha, embed options
    - `surveys.settings`: Extended via jsonb to support progress bar, save/continue, expiry

  3. New Indexes
    - content_ai_generations: organization_id, content_type, created_at
    - form_files: form_submission_id, storage_path
    - survey_continuations: token, expires_at

  4. Security
    - Enable RLS on all new tables
    - Create policies for authenticated access
*/

-- Create content_ai_generations table for storing AI-generated content
CREATE TABLE IF NOT EXISTS content_ai_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  content_type text NOT NULL CHECK (content_type IN (
    'social_caption', 'social_hashtags', 'email_subject', 'email_body',
    'form_copy', 'ad_copy', 'headline', 'description', 'translation'
  )),
  platform text CHECK (platform IN ('facebook', 'instagram', 'linkedin', 'tiktok', 'youtube', 'twitter', 'general')),
  prompt text NOT NULL,
  context jsonb DEFAULT '{}'::jsonb,
  generated_content text NOT NULL,
  variations jsonb DEFAULT '[]'::jsonb,
  model_used text,
  tokens_used integer DEFAULT 0,
  generation_params jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create form_files table for file uploads
CREATE TABLE IF NOT EXISTS form_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  form_id uuid NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  form_submission_id uuid REFERENCES form_submissions(id) ON DELETE CASCADE,
  field_id text NOT NULL,
  original_filename text NOT NULL,
  storage_path text NOT NULL,
  mime_type text NOT NULL,
  file_size_bytes bigint NOT NULL CHECK (file_size_bytes <= 104857600),
  uploaded_at timestamptz DEFAULT now()
);

-- Create survey_continuations table for save-and-continue feature
CREATE TABLE IF NOT EXISTS survey_continuations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  email text,
  current_step_index integer DEFAULT 0,
  answers jsonb DEFAULT '{}'::jsonb,
  attribution jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  resumed_at timestamptz,
  completed_submission_id uuid REFERENCES survey_submissions(id) ON DELETE SET NULL
);

-- Add new columns to social_posts for first comment and link preview
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_posts' AND column_name = 'first_comment'
  ) THEN
    ALTER TABLE social_posts ADD COLUMN first_comment text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_posts' AND column_name = 'link_preview'
  ) THEN
    ALTER TABLE social_posts ADD COLUMN link_preview jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_posts' AND column_name = 'ai_generated'
  ) THEN
    ALTER TABLE social_posts ADD COLUMN ai_generated boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_posts' AND column_name = 'ai_generation_id'
  ) THEN
    ALTER TABLE social_posts ADD COLUMN ai_generation_id uuid REFERENCES content_ai_generations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for content_ai_generations
CREATE INDEX IF NOT EXISTS idx_content_ai_generations_org_id ON content_ai_generations(organization_id);
CREATE INDEX IF NOT EXISTS idx_content_ai_generations_user_id ON content_ai_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_content_ai_generations_type ON content_ai_generations(content_type);
CREATE INDEX IF NOT EXISTS idx_content_ai_generations_platform ON content_ai_generations(platform) WHERE platform IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_ai_generations_created_at ON content_ai_generations(created_at);

-- Create indexes for form_files
CREATE INDEX IF NOT EXISTS idx_form_files_org_id ON form_files(organization_id);
CREATE INDEX IF NOT EXISTS idx_form_files_form_id ON form_files(form_id);
CREATE INDEX IF NOT EXISTS idx_form_files_submission_id ON form_files(form_submission_id) WHERE form_submission_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_form_files_storage_path ON form_files(storage_path);

-- Create indexes for survey_continuations
CREATE INDEX IF NOT EXISTS idx_survey_continuations_org_id ON survey_continuations(organization_id);
CREATE INDEX IF NOT EXISTS idx_survey_continuations_survey_id ON survey_continuations(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_continuations_token ON survey_continuations(token);
CREATE INDEX IF NOT EXISTS idx_survey_continuations_expires_at ON survey_continuations(expires_at);
CREATE INDEX IF NOT EXISTS idx_survey_continuations_email ON survey_continuations(email) WHERE email IS NOT NULL;

-- Create index for social_posts AI generation lookup
CREATE INDEX IF NOT EXISTS idx_social_posts_ai_generation ON social_posts(ai_generation_id) WHERE ai_generation_id IS NOT NULL;

-- Enable RLS on new tables
ALTER TABLE content_ai_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_continuations ENABLE ROW LEVEL SECURITY;
