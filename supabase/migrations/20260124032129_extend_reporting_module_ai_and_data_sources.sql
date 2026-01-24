/*
  # Extend Reporting Module with AI Queries and New Data Sources

  1. Schema Changes
    - Add new data sources to reports table CHECK constraint:
      - opportunities, invoices, payments, tasks, ai_runs, marketing, reputation
    - Add report_type column to reports table: 'manual' | 'ai_generated'
    
  2. New Tables
    - `ai_report_queries` - Stores natural language queries and AI responses
      - `id` (uuid, primary key)
      - `organization_id` (uuid, FK to organizations)
      - `user_id` (uuid, FK to users)
      - `query_text` (text) - Natural language question
      - `response_text` (text) - AI's text answer
      - `response_data` (jsonb) - Structured data for charts/tables
      - `data_sources_used` (text[]) - Which tables were queried
      - `sql_generated` (text) - Generated SQL for transparency
      - `execution_time_ms` (integer) - Query execution duration
      - `tokens_used` (integer) - LLM tokens consumed
      - `data_scope` (text) - 'my_data', 'department', 'organization'
      - `time_range` (jsonb) - Time range filters applied
      - `saved_as_report_id` (uuid, nullable) - If saved as report
      - `created_at` timestamp

  3. Security
    - RLS enabled on ai_report_queries
    - Users can only see their own queries
    - Data scope enforced at query execution time

  4. Permissions
    - Add 'reporting.ai.query' permission for AI reporting access
*/

-- Step 1: Alter the data_source CHECK constraint to include new sources
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_data_source_check;

ALTER TABLE reports ADD CONSTRAINT reports_data_source_check 
  CHECK (data_source IN (
    'contacts', 'conversations', 'appointments', 'forms', 'surveys', 'workflows',
    'opportunities', 'invoices', 'payments', 'tasks', 'ai_runs', 'marketing', 'reputation'
  ));

-- Step 2: Add report_type column to reports table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'reports' AND column_name = 'report_type'
  ) THEN
    ALTER TABLE reports ADD COLUMN report_type text NOT NULL DEFAULT 'manual' 
      CHECK (report_type IN ('manual', 'ai_generated'));
  END IF;
END $$;

-- Step 3: Create ai_report_queries table
CREATE TABLE IF NOT EXISTS ai_report_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query_text text NOT NULL,
  response_text text,
  response_data jsonb DEFAULT '{}',
  data_sources_used text[] DEFAULT '{}',
  sql_generated text,
  execution_time_ms integer,
  tokens_used integer,
  data_scope text NOT NULL DEFAULT 'my_data' CHECK (data_scope IN ('my_data', 'department', 'organization')),
  time_range jsonb DEFAULT '{}',
  saved_as_report_id uuid REFERENCES reports(id) ON DELETE SET NULL,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Step 4: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_report_queries_user ON ai_report_queries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_report_queries_org ON ai_report_queries(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_report_queries_saved ON ai_report_queries(saved_as_report_id) WHERE saved_as_report_id IS NOT NULL;

-- Step 5: Enable RLS
ALTER TABLE ai_report_queries ENABLE ROW LEVEL SECURITY;

-- Step 6: Create RLS policies for ai_report_queries
CREATE POLICY "Users can view own AI queries"
  ON ai_report_queries
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own AI queries"
  ON ai_report_queries
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own AI queries"
  ON ai_report_queries
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own AI queries"
  ON ai_report_queries
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Step 7: Add AI reporting permission
INSERT INTO permissions (key, description, module_name)
VALUES ('reporting.ai.query', 'Can use AI to query and analyze data', 'reporting')
ON CONFLICT (key) DO NOTHING;

-- Step 8: Grant permission to admin roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('Super Admin', 'Admin', 'Manager')
  AND p.key = 'reporting.ai.query'
ON CONFLICT DO NOTHING;
