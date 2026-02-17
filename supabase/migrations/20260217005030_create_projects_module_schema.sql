/*
  # Create Projects Module Schema

  1. New Tables
    - `project_pipelines` - Pipeline definitions for project workflows
      - `id` (uuid, primary key)
      - `org_id` (uuid, FK to organizations)
      - `name` (text, unique per org)
      - `department_id` (uuid, FK to departments, nullable)
      - `sort_order` (integer)
      - `created_at` / `updated_at` (timestamptz)

    - `project_stages` - Stages within project pipelines
      - `id` (uuid, primary key)
      - `org_id` (uuid, FK to organizations)
      - `pipeline_id` (uuid, FK to project_pipelines)
      - `name` (text, unique per pipeline)
      - `sort_order` (integer)
      - `sla_days` (integer, default 0 -- drives SLA/overdue indicators)
      - `color` (text, nullable)
      - `created_at` / `updated_at` (timestamptz)

    - `projects` - Core project records
      - `id` (uuid, primary key)
      - `org_id`, `contact_id`, `opportunity_id`, `proposal_id`, `invoice_id` (FK refs)
      - `pipeline_id`, `stage_id` (FK to project_pipelines/stages)
      - `assigned_user_id`, `department_id` (FK refs)
      - `name`, `description`, `status`, `priority`, `risk_level`
      - `start_date`, `target_end_date`, `actual_end_date`
      - `budget_amount`, `actual_cost`, `currency`
      - `progress_percent`, `financial_locked`
      - `google_drive_folder_id` (text, nullable)
      - `created_by`, `stage_changed_at`, `created_at`, `updated_at`

    - `project_tasks` - Tasks within projects (supports subtasks and dependencies)
      - `id` (uuid, primary key)
      - `project_id` (FK to projects)
      - `parent_task_id` (self-ref for subtasks)
      - `depends_on_task_id` (self-ref for dependencies)
      - `assigned_user_id`, `title`, `description`, `status`, `priority`
      - `due_date`, `completed_at`, `sort_order`

    - `project_activity_log` - Timeline of all project events
      - `id` (uuid, primary key)
      - `project_id` (FK to projects)
      - `event_type`, `summary`, `payload` (jsonb)
      - `actor_user_id`, `created_at`

    - `project_files` - Files attached to projects
      - `id` (uuid, primary key)
      - `project_id` (FK to projects)
      - `drive_file_id`, `google_drive_file_id`
      - `file_name`, `mime_type`, `size_bytes`
      - `uploaded_by`, `note`, `created_at`

    - `project_notes` - Notes on projects (soft-deletable)
      - `id` (uuid, primary key)
      - `project_id` (FK to projects)
      - `body`, `created_by`
      - `created_at`, `updated_at`, `deleted_at`

    - `project_costs` - Cost line items tracked per project
      - `id` (uuid, primary key)
      - `project_id` (FK to projects)
      - `description`, `amount`, `currency`, `category`, `date`
      - `created_by`, `created_at`

  2. Modified Tables
    - `opportunities` - Added `financial_locked` boolean column (default false)

  3. Indexes
    - Comprehensive indexes on all foreign keys and frequently queried columns
*/

-- project_pipelines
CREATE TABLE IF NOT EXISTS project_pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, name)
);

ALTER TABLE project_pipelines ENABLE ROW LEVEL SECURITY;

-- project_stages
CREATE TABLE IF NOT EXISTS project_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  pipeline_id uuid NOT NULL REFERENCES project_pipelines(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  sla_days integer NOT NULL DEFAULT 0,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pipeline_id, name)
);

ALTER TABLE project_stages ENABLE ROW LEVEL SECURITY;

-- projects
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  opportunity_id uuid REFERENCES opportunities(id) ON DELETE SET NULL,
  proposal_id uuid REFERENCES proposals(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  pipeline_id uuid NOT NULL REFERENCES project_pipelines(id) ON DELETE RESTRICT,
  stage_id uuid NOT NULL REFERENCES project_stages(id) ON DELETE RESTRICT,
  assigned_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_hold', 'completed', 'cancelled')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  start_date date,
  target_end_date date,
  actual_end_date date,
  budget_amount numeric NOT NULL DEFAULT 0,
  actual_cost numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  risk_level text NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  progress_percent integer NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  financial_locked boolean NOT NULL DEFAULT false,
  google_drive_folder_id text,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  stage_changed_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- project_tasks
CREATE TABLE IF NOT EXISTS project_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_task_id uuid REFERENCES project_tasks(id) ON DELETE CASCADE,
  assigned_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'in_review', 'completed', 'cancelled')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date date,
  completed_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  depends_on_task_id uuid REFERENCES project_tasks(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;

-- project_activity_log
CREATE TABLE IF NOT EXISTS project_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  summary text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE project_activity_log ENABLE ROW LEVEL SECURITY;

-- project_files
CREATE TABLE IF NOT EXISTS project_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  drive_file_id uuid REFERENCES drive_files(id) ON DELETE SET NULL,
  google_drive_file_id text,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;

-- project_notes
CREATE TABLE IF NOT EXISTS project_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE project_notes ENABLE ROW LEVEL SECURITY;

-- project_costs
CREATE TABLE IF NOT EXISTS project_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description text NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  category text,
  date date NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE project_costs ENABLE ROW LEVEL SECURITY;

-- Add financial_locked to opportunities
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'opportunities' AND column_name = 'financial_locked'
  ) THEN
    ALTER TABLE opportunities ADD COLUMN financial_locked boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_project_pipelines_org_id ON project_pipelines(org_id);
CREATE INDEX IF NOT EXISTS idx_project_pipelines_department_id ON project_pipelines(department_id);
CREATE INDEX IF NOT EXISTS idx_project_stages_pipeline_id ON project_stages(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_project_stages_org_id ON project_stages(org_id);
CREATE INDEX IF NOT EXISTS idx_projects_org_id ON projects(org_id);
CREATE INDEX IF NOT EXISTS idx_projects_contact_id ON projects(contact_id);
CREATE INDEX IF NOT EXISTS idx_projects_opportunity_id ON projects(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_projects_pipeline_id ON projects(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_projects_stage_id ON projects(stage_id);
CREATE INDEX IF NOT EXISTS idx_projects_assigned_user_id ON projects(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_projects_department_id ON projects(department_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);
CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id ON project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_assigned_user_id ON project_tasks(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_parent_task_id ON project_tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_depends_on ON project_tasks(depends_on_task_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_status ON project_tasks(status);
CREATE INDEX IF NOT EXISTS idx_project_activity_log_project_id ON project_activity_log(project_id);
CREATE INDEX IF NOT EXISTS idx_project_activity_log_event_type ON project_activity_log(event_type);
CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_project_notes_project_id ON project_notes(project_id);
CREATE INDEX IF NOT EXISTS idx_project_costs_project_id ON project_costs(project_id);
