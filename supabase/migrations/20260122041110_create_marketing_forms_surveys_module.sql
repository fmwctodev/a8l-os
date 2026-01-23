/*
  # Create Marketing Forms and Surveys Module

  1. New Tables
    - `forms`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `name` (text) - form name
      - `description` (text) - optional description
      - `status` (text) - draft, published, archived
      - `definition` (jsonb) - form fields configuration
      - `settings` (jsonb) - form behavior settings
      - `public_slug` (text, unique) - URL-safe identifier for public access
      - `created_by` (uuid, references users)
      - `published_at` (timestamptz)
      - `created_at`, `updated_at` (timestamptz)
    
    - `form_submissions`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `form_id` (uuid, references forms)
      - `contact_id` (uuid, nullable, references contacts)
      - `payload` (jsonb) - submitted field values
      - `attribution` (jsonb) - UTM params, referrer, IP, user agent
      - `processed_status` (text) - pending, processed, failed
      - `error` (text) - error message if processing failed
      - `idempotency_key` (text) - prevent duplicate submissions
      - `submitted_at` (timestamptz)
    
    - `surveys`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `name` (text)
      - `description` (text)
      - `status` (text) - draft, published, archived
      - `definition` (jsonb) - steps, questions, branching logic
      - `settings` (jsonb) - scoring config, thank you message, etc
      - `public_slug` (text, unique)
      - `created_by` (uuid, references users)
      - `published_at` (timestamptz)
      - `created_at`, `updated_at` (timestamptz)
    
    - `survey_submissions`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `survey_id` (uuid, references surveys)
      - `contact_id` (uuid, nullable, references contacts)
      - `answers` (jsonb) - question answers with scores
      - `score_total` (integer) - calculated total score
      - `score_band` (text) - determined score band label
      - `attribution` (jsonb)
      - `processed_status` (text)
      - `error` (text)
      - `idempotency_key` (text)
      - `submitted_at` (timestamptz)

  2. Indexes
    - Forms: organization_id, public_slug, status, created_by
    - Form submissions: form_id, contact_id, submitted_at, idempotency_key
    - Surveys: organization_id, public_slug, status, created_by
    - Survey submissions: survey_id, contact_id, submitted_at, idempotency_key

  3. Security
    - Enable RLS on all tables (policies added in separate migration)
*/

-- Create forms table
CREATE TABLE IF NOT EXISTS forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  definition jsonb NOT NULL DEFAULT '{"fields": []}'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  public_slug text UNIQUE,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  published_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create form submissions table
CREATE TABLE IF NOT EXISTS form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  form_id uuid NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  attribution jsonb DEFAULT '{}'::jsonb,
  processed_status text NOT NULL DEFAULT 'pending' CHECK (processed_status IN ('pending', 'processed', 'failed')),
  error text,
  idempotency_key text,
  submitted_at timestamptz DEFAULT now()
);

-- Create surveys table
CREATE TABLE IF NOT EXISTS surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  definition jsonb NOT NULL DEFAULT '{"steps": []}'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  public_slug text UNIQUE,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  published_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create survey submissions table
CREATE TABLE IF NOT EXISTS survey_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  score_total integer DEFAULT 0,
  score_band text,
  attribution jsonb DEFAULT '{}'::jsonb,
  processed_status text NOT NULL DEFAULT 'pending' CHECK (processed_status IN ('pending', 'processed', 'failed')),
  error text,
  idempotency_key text,
  submitted_at timestamptz DEFAULT now()
);

-- Create indexes for forms
CREATE INDEX IF NOT EXISTS idx_forms_organization_id ON forms(organization_id);
CREATE INDEX IF NOT EXISTS idx_forms_public_slug ON forms(public_slug) WHERE public_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_forms_status ON forms(status);
CREATE INDEX IF NOT EXISTS idx_forms_created_by ON forms(created_by);

-- Create indexes for form submissions
CREATE INDEX IF NOT EXISTS idx_form_submissions_organization_id ON form_submissions(organization_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_form_id ON form_submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_contact_id ON form_submissions(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_form_submissions_submitted_at ON form_submissions(submitted_at);
CREATE INDEX IF NOT EXISTS idx_form_submissions_idempotency ON form_submissions(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_form_submissions_processed_status ON form_submissions(processed_status);

-- Create indexes for surveys
CREATE INDEX IF NOT EXISTS idx_surveys_organization_id ON surveys(organization_id);
CREATE INDEX IF NOT EXISTS idx_surveys_public_slug ON surveys(public_slug) WHERE public_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_surveys_status ON surveys(status);
CREATE INDEX IF NOT EXISTS idx_surveys_created_by ON surveys(created_by);

-- Create indexes for survey submissions
CREATE INDEX IF NOT EXISTS idx_survey_submissions_organization_id ON survey_submissions(organization_id);
CREATE INDEX IF NOT EXISTS idx_survey_submissions_survey_id ON survey_submissions(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_submissions_contact_id ON survey_submissions(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_survey_submissions_submitted_at ON survey_submissions(submitted_at);
CREATE INDEX IF NOT EXISTS idx_survey_submissions_idempotency ON survey_submissions(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_survey_submissions_score_band ON survey_submissions(score_band) WHERE score_band IS NOT NULL;

-- Enable RLS on all tables
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_submissions ENABLE ROW LEVEL SECURITY;

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_forms_updated_at ON forms;
CREATE TRIGGER update_forms_updated_at
  BEFORE UPDATE ON forms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_surveys_updated_at ON surveys;
CREATE TRIGGER update_surveys_updated_at
  BEFORE UPDATE ON surveys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
