/*
  # AI Usage Logs Table

  This migration creates the usage logs table for tracking all AI agent
  executions, enabling monitoring, analytics, and export functionality.

  1. New Tables
    - `ai_usage_logs` - Log of all AI agent runs
      - `id` (uuid, PK)
      - `org_id` (uuid, FK to organizations)
      - `agent_id` (uuid, FK to ai_agents, nullable for deleted agents)
      - `agent_name` (text) - Snapshot of agent name at time of run
      - `user_id` (uuid, FK to users) - Who triggered the run
      - `model_key` (text) - Model used for this run
      - `action_summary` (text) - Brief description of action performed
      - `status` (text) - success, failed
      - `error_message` (text, nullable) - Error details if failed
      - `duration_ms` (integer) - Execution time in milliseconds
      - `input_tokens` (integer, nullable) - Tokens used in prompt
      - `output_tokens` (integer, nullable) - Tokens in response
      - `metadata` (jsonb) - Additional run metadata
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Users can view logs for their organization

  3. Indexes
    - Optimized for common query patterns (date ranges, agent, user, status)
*/

-- AI Usage Logs table
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES ai_agents(id) ON DELETE SET NULL,
  agent_name text NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  user_name text,
  model_key text NOT NULL,
  action_summary text NOT NULL,
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed')),
  error_message text,
  duration_ms integer NOT NULL DEFAULT 0,
  input_tokens integer,
  output_tokens integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_org_created ON ai_usage_logs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_agent ON ai_usage_logs(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user ON ai_usage_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_status ON ai_usage_logs(org_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_date_range ON ai_usage_logs(org_id, created_at);

-- Partial index for failed logs (commonly filtered)
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_failed ON ai_usage_logs(org_id, created_at DESC) 
  WHERE status = 'failed';
