/*
  # Create AI Agents Module

  This migration creates the core tables for AI-powered agents that can read CRM data,
  analyze conversations, and generate draft responses for user approval.

  1. New Tables
    - `ai_agents` - AI agent configurations
      - `id` (uuid, primary key)
      - `org_id` (uuid, FK to organizations)
      - `name` (text) - Agent display name
      - `description` (text, nullable) - Agent purpose description
      - `system_prompt` (text) - Instructions for the AI
      - `allowed_tools` (jsonb) - Array of tool names agent can use
      - `allowed_channels` (jsonb) - Array of output channels (sms, email, internal_note)
      - `temperature` (decimal) - AI creativity setting 0-1
      - `max_tokens` (integer) - Maximum response length
      - `enabled` (boolean) - Whether agent is active
      - `created_by_user_id` (uuid, FK to users)
      - `created_at`, `updated_at` (timestamptz)

    - `ai_agent_memory` - Per-contact memory for each agent
      - `id` (uuid, primary key)
      - `org_id` (uuid, FK to organizations)
      - `agent_id` (uuid, FK to ai_agents)
      - `contact_id` (uuid, FK to contacts)
      - `memory_summary` (text) - Overall summary of interactions
      - `key_facts` (jsonb) - Important facts about the contact
      - `conversation_summary` (text) - Summary of conversations
      - `last_decision` (text) - What the agent last decided
      - `confidence_level` (text) - Agent's confidence in assessment
      - `lead_stage` (text) - Determined lead stage
      - `last_updated_at` (timestamptz)

    - `ai_agent_runs` - Execution history for agents
      - `id` (uuid, primary key)
      - `org_id` (uuid, FK to organizations)
      - `agent_id` (uuid, FK to ai_agents)
      - `contact_id` (uuid, FK to contacts)
      - `conversation_id` (uuid, nullable, FK to conversations)
      - `triggered_by` (text) - 'user' or 'automation'
      - `trigger_source_id` (uuid, nullable) - Source workflow enrollment ID
      - `status` (text) - pending, running, success, failed, stopped
      - `input_prompt` (text) - The prompt sent to the AI
      - `output_summary` (text, nullable) - Summary of what agent did
      - `draft_message` (text, nullable) - Generated message draft
      - `draft_channel` (text, nullable) - Channel for draft (sms/email)
      - `draft_subject` (text, nullable) - Email subject if applicable
      - `user_approved` (boolean, nullable) - Whether user accepted draft
      - `approved_at` (timestamptz, nullable) - When approved
      - `approved_by_user_id` (uuid, nullable) - Who approved
      - `messages_sent` (integer) - Count of messages actually sent
      - `tool_calls_count` (integer) - Number of tools invoked
      - `error_message` (text, nullable) - Error if failed
      - `started_at` (timestamptz)
      - `completed_at` (timestamptz, nullable)
      - `created_at` (timestamptz)

    - `ai_agent_tool_calls` - Detailed log of each tool invocation
      - `id` (uuid, primary key)
      - `org_id` (uuid, FK to organizations)
      - `agent_run_id` (uuid, FK to ai_agent_runs)
      - `tool_name` (text) - Name of tool called
      - `input_payload` (jsonb) - Tool input parameters
      - `output_payload` (jsonb, nullable) - Tool output
      - `status` (text) - success or failed
      - `error_message` (text, nullable) - Error if failed
      - `duration_ms` (integer) - Execution time
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled on all tables (policies in separate migration)
    - All tables scoped to organization via org_id

  3. Indexes
    - ai_agent_runs(contact_id, created_at) for contact history
    - ai_agent_runs(agent_id, status) for agent stats
    - ai_agent_memory(agent_id, contact_id) for quick lookup
    - ai_agent_tool_calls(agent_run_id) for run details
*/

-- Create agent run status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_agent_run_status') THEN
    CREATE TYPE ai_agent_run_status AS ENUM ('pending', 'running', 'success', 'failed', 'stopped');
  END IF;
END $$;

-- Create agent trigger type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_agent_trigger_type') THEN
    CREATE TYPE ai_agent_trigger_type AS ENUM ('user', 'automation');
  END IF;
END $$;

-- Create tool call status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_tool_call_status') THEN
    CREATE TYPE ai_tool_call_status AS ENUM ('success', 'failed');
  END IF;
END $$;

-- Main AI agents configuration table
CREATE TABLE IF NOT EXISTS ai_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  system_prompt text NOT NULL,
  allowed_tools jsonb NOT NULL DEFAULT '[]'::jsonb,
  allowed_channels jsonb NOT NULL DEFAULT '["internal_note"]'::jsonb,
  temperature decimal(3,2) NOT NULL DEFAULT 0.7 CHECK (temperature >= 0 AND temperature <= 1),
  max_tokens integer NOT NULL DEFAULT 1024 CHECK (max_tokens >= 128 AND max_tokens <= 4096),
  enabled boolean NOT NULL DEFAULT true,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Per-contact memory for agents
CREATE TABLE IF NOT EXISTS ai_agent_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  memory_summary text,
  key_facts jsonb NOT NULL DEFAULT '{}'::jsonb,
  conversation_summary text,
  last_decision text,
  confidence_level text,
  lead_stage text,
  last_updated_at timestamptz DEFAULT now(),
  UNIQUE(agent_id, contact_id)
);

-- Agent execution runs
CREATE TABLE IF NOT EXISTS ai_agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  triggered_by ai_agent_trigger_type NOT NULL,
  trigger_source_id uuid,
  status ai_agent_run_status NOT NULL DEFAULT 'pending',
  input_prompt text NOT NULL,
  output_summary text,
  draft_message text,
  draft_channel text,
  draft_subject text,
  user_approved boolean,
  approved_at timestamptz,
  approved_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  messages_sent integer NOT NULL DEFAULT 0,
  tool_calls_count integer NOT NULL DEFAULT 0,
  error_message text,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Tool call audit log
CREATE TABLE IF NOT EXISTS ai_agent_tool_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_run_id uuid NOT NULL REFERENCES ai_agent_runs(id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  input_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_payload jsonb,
  status ai_tool_call_status NOT NULL,
  error_message text,
  duration_ms integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_tool_calls ENABLE ROW LEVEL SECURITY;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_ai_agents_org_enabled ON ai_agents(org_id, enabled);
CREATE INDEX IF NOT EXISTS idx_ai_agent_memory_agent_contact ON ai_agent_memory(agent_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_memory_contact ON ai_agent_memory(contact_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_contact_created ON ai_agent_runs(contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_agent_status ON ai_agent_runs(agent_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_org_created ON ai_agent_runs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_agent_tool_calls_run ON ai_agent_tool_calls(agent_run_id, created_at);

-- Create trigger for updated_at timestamps
CREATE OR REPLACE FUNCTION update_ai_agent_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ai_agents_updated_at ON ai_agents;
CREATE TRIGGER ai_agents_updated_at
  BEFORE UPDATE ON ai_agents
  FOR EACH ROW EXECUTE FUNCTION update_ai_agent_updated_at();

-- Trigger to update memory timestamp
CREATE OR REPLACE FUNCTION update_ai_agent_memory_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ai_agent_memory_updated ON ai_agent_memory;
CREATE TRIGGER ai_agent_memory_updated
  BEFORE UPDATE ON ai_agent_memory
  FOR EACH ROW EXECUTE FUNCTION update_ai_agent_memory_timestamp();