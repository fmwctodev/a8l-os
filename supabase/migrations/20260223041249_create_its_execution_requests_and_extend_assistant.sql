/*
  # Clara Internal Tool Schema (ITS) - Execution Requests & Schema Extensions

  1. New Tables
    - `assistant_execution_requests`
      - `id` (uuid, primary key) - unique execution request ID
      - `user_id` (uuid, FK to users) - user who initiated the request
      - `org_id` (uuid, FK to organizations) - organization context
      - `thread_id` (uuid, FK to assistant_threads) - parent conversation thread
      - `intent` (text) - LLM-derived intent description
      - `confidence` (numeric) - LLM confidence score 0.0-1.0
      - `requires_confirmation` (boolean) - whether user approval is needed
      - `confirmation_reason` (text, nullable) - why confirmation is required
      - `actions` (jsonb) - full array of ITS action objects
      - `response_to_user` (text) - Clara's natural language response
      - `execution_status` (text) - pending/executing/success/partial/failed/awaiting_confirmation
      - `results` (jsonb) - execution receipt array after processing
      - `model_used` (text) - which LLM model produced the plan
      - `raw_llm_output` (jsonb) - full raw LLM response for debugging
      - `created_at` (timestamptz)
      - `completed_at` (timestamptz, nullable)

  2. Modified Tables
    - `assistant_action_logs` - adds execution_request_id, action_id, depends_on columns
    - `assistant_profiles` - adds system_prompt_override column

  3. Security
    - Enable RLS on `assistant_execution_requests`
    - Users can only view/create their own execution requests
    - Indexes for common query patterns
*/

-- Create assistant_execution_requests table
CREATE TABLE IF NOT EXISTS assistant_execution_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  org_id uuid NOT NULL REFERENCES organizations(id),
  thread_id uuid REFERENCES assistant_threads(id),
  intent text NOT NULL DEFAULT '',
  confidence numeric NOT NULL DEFAULT 0,
  requires_confirmation boolean NOT NULL DEFAULT false,
  confirmation_reason text,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  response_to_user text NOT NULL DEFAULT '',
  execution_status text NOT NULL DEFAULT 'pending',
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  model_used text NOT NULL DEFAULT '',
  raw_llm_output jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE assistant_execution_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own execution requests"
  ON assistant_execution_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own execution requests"
  ON assistant_execution_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own execution requests"
  ON assistant_execution_requests
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_assistant_exec_requests_user_id
  ON assistant_execution_requests(user_id);

CREATE INDEX IF NOT EXISTS idx_assistant_exec_requests_thread_id
  ON assistant_execution_requests(thread_id);

CREATE INDEX IF NOT EXISTS idx_assistant_exec_requests_status
  ON assistant_execution_requests(execution_status);

CREATE INDEX IF NOT EXISTS idx_assistant_exec_requests_created_at
  ON assistant_execution_requests(created_at DESC);

-- Extend assistant_action_logs with ITS fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assistant_action_logs' AND column_name = 'execution_request_id'
  ) THEN
    ALTER TABLE assistant_action_logs ADD COLUMN execution_request_id uuid REFERENCES assistant_execution_requests(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assistant_action_logs' AND column_name = 'action_id'
  ) THEN
    ALTER TABLE assistant_action_logs ADD COLUMN action_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assistant_action_logs' AND column_name = 'depends_on'
  ) THEN
    ALTER TABLE assistant_action_logs ADD COLUMN depends_on text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_assistant_action_logs_exec_req_id
  ON assistant_action_logs(execution_request_id);

-- Add system_prompt_override to assistant_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assistant_profiles' AND column_name = 'system_prompt_override'
  ) THEN
    ALTER TABLE assistant_profiles ADD COLUMN system_prompt_override text;
  END IF;
END $$;
