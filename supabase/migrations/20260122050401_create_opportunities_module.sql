/*
  # Create Opportunities/Pipelines Module

  This migration creates the core tables for the Opportunities (Pipelines) module,
  which replicates GoHighLevel's pipeline/stage logic with kanban views, contact linkage,
  assignment behavior, and outcome tracking.

  ## 1. New Tables

  ### pipelines
  - `id` (uuid, primary key) - Unique pipeline identifier
  - `org_id` (uuid) - Organization that owns this pipeline
  - `name` (text) - Pipeline name (e.g., "Sales Pipeline", "Onboarding")
  - `department_id` (uuid, nullable) - Optional department scope
  - `sort_order` (integer) - Display order in UI
  - `created_at`, `updated_at` - Timestamps

  ### pipeline_stages
  - `id` (uuid, primary key) - Unique stage identifier
  - `org_id` (uuid) - Organization reference
  - `pipeline_id` (uuid) - Parent pipeline
  - `name` (text) - Stage name (e.g., "New Lead", "Qualified", "Proposal Sent")
  - `sort_order` (integer) - Column order in kanban
  - `created_at`, `updated_at` - Timestamps

  ### opportunities
  - `id` (uuid, primary key) - Unique opportunity identifier
  - `org_id` (uuid) - Organization reference
  - `contact_id` (uuid) - Required link to a contact
  - `pipeline_id` (uuid) - Which pipeline this belongs to
  - `stage_id` (uuid) - Current stage in the pipeline
  - `assigned_user_id` (uuid, nullable) - Assigned sales rep/owner
  - `department_id` (uuid, nullable) - Department for RLS
  - `value_amount` (numeric) - Deal value/amount
  - `currency` (text) - Currency code (default USD)
  - `status` (text) - open, won, or lost
  - `source` (text, nullable) - Lead source
  - `close_date` (date, nullable) - Expected or actual close date
  - `created_by` (uuid) - User who created the opportunity
  - `closed_at` (timestamptz, nullable) - When status changed to won/lost
  - `lost_reason` (text, nullable) - Reason if lost
  - `created_at`, `updated_at` - Timestamps

  ### pipeline_custom_fields
  - `id` (uuid, primary key) - Unique field identifier
  - `org_id` (uuid) - Organization reference
  - `pipeline_id` (uuid) - Scoped to specific pipeline
  - `field_key` (text) - Unique key within pipeline
  - `label` (text) - Display label
  - `field_type` (text) - text, number, date, dropdown, multi_select, boolean
  - `options` (jsonb) - For dropdown/multi_select types
  - `required` (boolean) - If field is mandatory
  - `filterable` (boolean) - If field can be used in filters
  - `sort_order` (integer) - Display order
  - `created_at`, `updated_at` - Timestamps

  ### opportunity_custom_field_values
  - `id` (uuid, primary key) - Unique value identifier
  - `org_id` (uuid) - Organization reference
  - `opportunity_id` (uuid) - Which opportunity
  - `pipeline_custom_field_id` (uuid) - Which custom field
  - `value_text`, `value_number`, `value_date`, `value_boolean`, `value_json` - Typed value storage
  - `updated_at` - Timestamp

  ### opportunity_notes
  - `id` (uuid, primary key) - Unique note identifier
  - `org_id` (uuid) - Organization reference
  - `opportunity_id` (uuid) - Which opportunity
  - `body` (text) - Note content
  - `created_by` (uuid) - Author
  - `created_at`, `updated_at`, `deleted_at` - Timestamps (soft delete)

  ### opportunity_timeline_events
  - `id` (uuid, primary key) - Unique event identifier
  - `org_id` (uuid) - Organization reference
  - `opportunity_id` (uuid) - Which opportunity
  - `contact_id` (uuid) - Related contact
  - `event_type` (text) - Type of event (created, stage_changed, etc.)
  - `summary` (text) - Human-readable summary
  - `payload` (jsonb) - Detailed event data
  - `actor_user_id` (uuid, nullable) - Who triggered the event
  - `created_at` - Timestamp

  ## 2. Schema Changes

  ### contact_tasks
  - Adds `opportunity_id` (uuid, nullable) - Links tasks to opportunities

  ## 3. Indexes
  - Performance indexes on all foreign keys and commonly filtered columns
  - Composite indexes for common query patterns

  ## 4. Important Notes
  - All tables have RLS enabled (policies in separate migration)
  - Opportunities always require a contact (contact_id NOT NULL)
  - Pipeline custom fields are separate from org-wide contact custom fields
*/

-- Pipelines table
CREATE TABLE IF NOT EXISTS pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, name)
);

-- Pipeline stages table
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  pipeline_id uuid NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pipeline_id, name)
);

-- Opportunities table
CREATE TABLE IF NOT EXISTS opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  pipeline_id uuid NOT NULL REFERENCES pipelines(id) ON DELETE RESTRICT,
  stage_id uuid NOT NULL REFERENCES pipeline_stages(id) ON DELETE RESTRICT,
  assigned_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  value_amount numeric(15, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost')),
  source text,
  close_date date,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  closed_at timestamptz,
  lost_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Pipeline custom fields table
CREATE TABLE IF NOT EXISTS pipeline_custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  pipeline_id uuid NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'dropdown', 'multi_select', 'boolean')),
  options jsonb DEFAULT '[]'::jsonb,
  required boolean NOT NULL DEFAULT false,
  filterable boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pipeline_id, field_key)
);

-- Opportunity custom field values table
CREATE TABLE IF NOT EXISTS opportunity_custom_field_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  pipeline_custom_field_id uuid NOT NULL REFERENCES pipeline_custom_fields(id) ON DELETE CASCADE,
  value_text text,
  value_number numeric(15, 4),
  value_date date,
  value_boolean boolean,
  value_json jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(opportunity_id, pipeline_custom_field_id)
);

-- Opportunity notes table
CREATE TABLE IF NOT EXISTS opportunity_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- Opportunity timeline events table
CREATE TABLE IF NOT EXISTS opportunity_timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  summary text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add opportunity_id to contact_tasks for linking tasks to opportunities
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contact_tasks' AND column_name = 'opportunity_id'
  ) THEN
    ALTER TABLE contact_tasks ADD COLUMN opportunity_id uuid REFERENCES opportunities(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Indexes for pipelines
CREATE INDEX IF NOT EXISTS idx_pipelines_org ON pipelines(org_id);
CREATE INDEX IF NOT EXISTS idx_pipelines_department ON pipelines(department_id) WHERE department_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pipelines_sort ON pipelines(org_id, sort_order);

-- Indexes for pipeline_stages
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline ON pipeline_stages(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_sort ON pipeline_stages(pipeline_id, sort_order);

-- Indexes for opportunities
CREATE INDEX IF NOT EXISTS idx_opportunities_org_pipeline ON opportunities(org_id, pipeline_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_org_stage ON opportunities(org_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_org_contact ON opportunities(org_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_org_assigned ON opportunities(org_id, assigned_user_id) WHERE assigned_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_org_status ON opportunities(org_id, status);
CREATE INDEX IF NOT EXISTS idx_opportunities_org_department ON opportunities(org_id, department_id) WHERE department_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_created_at ON opportunities(created_at);
CREATE INDEX IF NOT EXISTS idx_opportunities_updated_at ON opportunities(updated_at);
CREATE INDEX IF NOT EXISTS idx_opportunities_close_date ON opportunities(close_date) WHERE close_date IS NOT NULL;

-- Indexes for pipeline_custom_fields
CREATE INDEX IF NOT EXISTS idx_pipeline_custom_fields_pipeline ON pipeline_custom_fields(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_custom_fields_sort ON pipeline_custom_fields(pipeline_id, sort_order);

-- Indexes for opportunity_custom_field_values
CREATE INDEX IF NOT EXISTS idx_opp_custom_field_values_opp ON opportunity_custom_field_values(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opp_custom_field_values_field ON opportunity_custom_field_values(pipeline_custom_field_id);

-- Indexes for opportunity_notes
CREATE INDEX IF NOT EXISTS idx_opportunity_notes_opp ON opportunity_notes(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_notes_created ON opportunity_notes(created_at);
CREATE INDEX IF NOT EXISTS idx_opportunity_notes_not_deleted ON opportunity_notes(opportunity_id) WHERE deleted_at IS NULL;

-- Indexes for opportunity_timeline_events
CREATE INDEX IF NOT EXISTS idx_opp_timeline_opp ON opportunity_timeline_events(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opp_timeline_contact ON opportunity_timeline_events(contact_id);
CREATE INDEX IF NOT EXISTS idx_opp_timeline_type ON opportunity_timeline_events(event_type);
CREATE INDEX IF NOT EXISTS idx_opp_timeline_created ON opportunity_timeline_events(created_at);

-- Index for contact_tasks opportunity linkage
CREATE INDEX IF NOT EXISTS idx_contact_tasks_opportunity ON contact_tasks(opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contact_tasks_opp_status ON contact_tasks(opportunity_id, status, due_date) WHERE opportunity_id IS NOT NULL;

-- Enable RLS on all new tables
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_custom_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_timeline_events ENABLE ROW LEVEL SECURITY;

-- Update triggers for updated_at
CREATE OR REPLACE FUNCTION update_opportunities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_pipelines_updated_at
  BEFORE UPDATE ON pipelines
  FOR EACH ROW
  EXECUTE FUNCTION update_opportunities_updated_at();

CREATE TRIGGER set_pipeline_stages_updated_at
  BEFORE UPDATE ON pipeline_stages
  FOR EACH ROW
  EXECUTE FUNCTION update_opportunities_updated_at();

CREATE TRIGGER set_opportunities_updated_at
  BEFORE UPDATE ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION update_opportunities_updated_at();

CREATE TRIGGER set_pipeline_custom_fields_updated_at
  BEFORE UPDATE ON pipeline_custom_fields
  FOR EACH ROW
  EXECUTE FUNCTION update_opportunities_updated_at();

CREATE TRIGGER set_opp_custom_field_values_updated_at
  BEFORE UPDATE ON opportunity_custom_field_values
  FOR EACH ROW
  EXECUTE FUNCTION update_opportunities_updated_at();

CREATE TRIGGER set_opportunity_notes_updated_at
  BEFORE UPDATE ON opportunity_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_opportunities_updated_at();
