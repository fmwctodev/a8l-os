/*
  # Create Automation Templates Module Schema

  1. New Tables
    - `automation_templates`
      - `id` (uuid, primary key)
      - `org_id` (uuid, nullable for system templates, FK to organizations)
      - `name` (text, not null)
      - `description` (text)
      - `category` (text, not null, check constraint for valid categories)
      - `icon_name` (text, default 'Zap')
      - `channel_tags` (text array, default empty)
      - `estimated_time` (text, e.g. "5 minutes")
      - `complexity` (text, check constraint: simple/moderate/advanced)
      - `is_system` (boolean, default false)
      - `status` (text, check constraint: draft/published/archived)
      - `created_by_user_id` (uuid, nullable, FK to users)
      - `published_at` (timestamptz)
      - `use_count` (integer, default 0)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `automation_template_versions`
      - `id` (uuid, primary key)
      - `template_id` (uuid, FK to automation_templates)
      - `version_number` (integer, not null)
      - `definition_snapshot` (jsonb, stores complete WorkflowDefinition)
      - `change_summary` (text)
      - `created_by_user_id` (uuid, nullable)
      - `created_at` (timestamptz)

    - `automation_template_instances`
      - `id` (uuid, primary key)
      - `template_id` (uuid, FK to automation_templates)
      - `template_version_id` (uuid, FK to automation_template_versions)
      - `workflow_id` (uuid, FK to workflows)
      - `org_id` (uuid, FK to organizations)
      - `created_by_user_id` (uuid, nullable)
      - `customizations` (jsonb)
      - `created_at` (timestamptz)

  2. Indexes
    - automation_templates(category)
    - automation_templates(status, is_system)
    - automation_templates(org_id)
    - automation_template_versions(template_id, version_number)
    - automation_template_instances(template_id)
    - automation_template_instances(workflow_id)
    - automation_template_instances(org_id)

  3. Security
    - RLS enabled on all tables
*/

CREATE TABLE IF NOT EXISTS automation_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  category text NOT NULL CHECK (category IN ('sales', 'lead_management', 'scheduling', 'proposal', 'follow_up', 'internal_ops')),
  icon_name text NOT NULL DEFAULT 'Zap',
  channel_tags text[] NOT NULL DEFAULT '{}',
  estimated_time text,
  complexity text NOT NULL DEFAULT 'simple' CHECK (complexity IN ('simple', 'moderate', 'advanced')),
  is_system boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  published_at timestamptz,
  use_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS automation_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES automation_templates(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  definition_snapshot jsonb NOT NULL DEFAULT '{"nodes":[],"edges":[],"viewport":{"x":0,"y":0,"zoom":1}}',
  change_summary text,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(template_id, version_number)
);

CREATE TABLE IF NOT EXISTS automation_template_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES automation_templates(id) ON DELETE CASCADE,
  template_version_id uuid NOT NULL REFERENCES automation_template_versions(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  customizations jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_templates_category ON automation_templates(category);
CREATE INDEX IF NOT EXISTS idx_automation_templates_status_system ON automation_templates(status, is_system);
CREATE INDEX IF NOT EXISTS idx_automation_templates_org_id ON automation_templates(org_id);
CREATE INDEX IF NOT EXISTS idx_automation_template_versions_template ON automation_template_versions(template_id, version_number);
CREATE INDEX IF NOT EXISTS idx_automation_template_instances_template ON automation_template_instances(template_id);
CREATE INDEX IF NOT EXISTS idx_automation_template_instances_workflow ON automation_template_instances(workflow_id);
CREATE INDEX IF NOT EXISTS idx_automation_template_instances_org ON automation_template_instances(org_id);

ALTER TABLE automation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_template_instances ENABLE ROW LEVEL SECURITY;
