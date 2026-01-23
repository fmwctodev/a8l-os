/*
  # Conversations Advanced Features - Schema

  ## Overview
  This migration creates the database tables for snippets, AI drafts, and conversation rules
  to enable advanced automation and productivity features in the conversations module.

  ## 1. New Tables

  ### snippets
  Pre-written message templates that users can quickly insert into conversations.
  - `id` (uuid, primary key) - Unique identifier
  - `organization_id` (uuid, FK) - Reference to organization
  - `created_by_user_id` (uuid, FK) - User who created the snippet
  - `name` (text) - Display name for the snippet
  - `content` (text) - Template content with variable placeholders
  - `channel_support` (text[]) - Supported channels: sms, email
  - `scope` (text) - personal, team, or system
  - `department_id` (uuid, FK, nullable) - For team-scoped snippets
  - `is_enabled` (boolean) - Whether snippet is active
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### ai_drafts
  AI-generated message drafts awaiting user approval.
  - `id` (uuid, primary key) - Unique identifier
  - `organization_id` (uuid, FK) - Reference to organization
  - `conversation_id` (uuid, FK) - Reference to conversation
  - `contact_id` (uuid, FK) - Reference to contact
  - `agent_id` (uuid, FK, nullable) - AI agent used for generation
  - `draft_content` (text) - Generated message content
  - `draft_channel` (text) - Target channel: sms, email
  - `draft_subject` (text, nullable) - Email subject if applicable
  - `status` (text) - pending, approved, rejected, superseded
  - `trigger_type` (text) - manual or auto
  - `triggered_by_rule_id` (uuid, FK, nullable) - Rule that triggered generation
  - `context_message_id` (uuid, FK, nullable) - Last message when draft was generated
  - `version` (int) - Increments on regeneration
  - `rejection_reason` (text, nullable) - Why draft was rejected
  - `approved_by` (uuid, FK, nullable) - User who approved
  - `approved_at` (timestamptz, nullable) - When approved
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### conversation_rules
  Automation rules that trigger actions on conversation events.
  - `id` (uuid, primary key) - Unique identifier
  - `organization_id` (uuid, FK) - Reference to organization
  - `name` (text) - Display name for the rule
  - `trigger_type` (text) - incoming_message, new_conversation, etc.
  - `conditions` (jsonb) - Array of condition objects
  - `actions` (jsonb) - Array of action objects
  - `priority` (int) - Lower number = evaluated first
  - `cooldown_minutes` (int) - Minutes before rule can trigger again
  - `max_triggers_per_day` (int) - Daily limit per conversation
  - `continue_evaluation` (boolean) - Allow subsequent rules to run
  - `is_enabled` (boolean) - Whether rule is active
  - `last_triggered_at` (timestamptz, nullable) - Last execution time
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### conversation_rule_logs
  Execution history for conversation rules.
  - `id` (uuid, primary key) - Unique identifier
  - `rule_id` (uuid, FK) - Reference to rule
  - `conversation_id` (uuid, FK) - Reference to conversation
  - `trigger_time` (timestamptz) - When rule was triggered
  - `action_results` (jsonb) - Results of each action
  - `success` (boolean) - Overall execution success
  - `error_message` (text, nullable) - Error details if failed
  - `created_at` (timestamptz) - Creation timestamp

  ## 2. Indexes
  - Optimized indexes for common query patterns
  - Composite indexes for filtering and sorting

  ## 3. Security
  - RLS enabled on all tables (policies in separate migration)
*/

-- Snippets table
CREATE TABLE IF NOT EXISTS snippets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  content text NOT NULL,
  channel_support text[] NOT NULL DEFAULT ARRAY['sms', 'email']::text[],
  scope text NOT NULL DEFAULT 'personal' CHECK (scope IN ('personal', 'team', 'system')),
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT snippets_team_scope_requires_department CHECK (
    scope != 'team' OR department_id IS NOT NULL
  )
);

-- AI Drafts table
CREATE TABLE IF NOT EXISTS ai_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES ai_agents(id) ON DELETE SET NULL,
  draft_content text NOT NULL,
  draft_channel text NOT NULL CHECK (draft_channel IN ('sms', 'email')),
  draft_subject text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'superseded')),
  trigger_type text NOT NULL DEFAULT 'manual' CHECK (trigger_type IN ('manual', 'auto')),
  triggered_by_rule_id uuid,
  context_message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  version int NOT NULL DEFAULT 1,
  rejection_reason text,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Conversation Rules table
CREATE TABLE IF NOT EXISTS conversation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger_type text NOT NULL CHECK (trigger_type IN ('incoming_message', 'new_conversation', 'conversation_reopened', 'no_reply_timeout', 'channel_message')),
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  priority int NOT NULL DEFAULT 100,
  cooldown_minutes int NOT NULL DEFAULT 0,
  max_triggers_per_day int NOT NULL DEFAULT 0,
  continue_evaluation boolean NOT NULL DEFAULT false,
  is_enabled boolean NOT NULL DEFAULT true,
  last_triggered_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Conversation Rule Logs table
CREATE TABLE IF NOT EXISTS conversation_rule_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES conversation_rules(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  trigger_time timestamptz NOT NULL DEFAULT now(),
  action_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  success boolean NOT NULL DEFAULT true,
  error_message text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Add foreign key for triggered_by_rule_id after conversation_rules exists
ALTER TABLE ai_drafts
  ADD CONSTRAINT ai_drafts_triggered_by_rule_fk
  FOREIGN KEY (triggered_by_rule_id)
  REFERENCES conversation_rules(id)
  ON DELETE SET NULL;

-- Indexes for snippets
CREATE INDEX IF NOT EXISTS idx_snippets_org ON snippets(organization_id);
CREATE INDEX IF NOT EXISTS idx_snippets_created_by ON snippets(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_snippets_scope ON snippets(organization_id, scope);
CREATE INDEX IF NOT EXISTS idx_snippets_department ON snippets(department_id) WHERE department_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_snippets_enabled ON snippets(organization_id, is_enabled) WHERE is_enabled = true;

-- Indexes for ai_drafts
CREATE INDEX IF NOT EXISTS idx_ai_drafts_org ON ai_drafts(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_drafts_conversation ON ai_drafts(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_drafts_status ON ai_drafts(conversation_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_drafts_pending ON ai_drafts(organization_id, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_ai_drafts_agent ON ai_drafts(agent_id) WHERE agent_id IS NOT NULL;

-- Indexes for conversation_rules
CREATE INDEX IF NOT EXISTS idx_conversation_rules_org ON conversation_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_conversation_rules_enabled ON conversation_rules(organization_id, is_enabled, priority) WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS idx_conversation_rules_trigger ON conversation_rules(organization_id, trigger_type);

-- Indexes for conversation_rule_logs
CREATE INDEX IF NOT EXISTS idx_rule_logs_rule ON conversation_rule_logs(rule_id);
CREATE INDEX IF NOT EXISTS idx_rule_logs_conversation ON conversation_rule_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_rule_logs_time ON conversation_rule_logs(rule_id, trigger_time DESC);
CREATE INDEX IF NOT EXISTS idx_rule_logs_success ON conversation_rule_logs(rule_id, success);

-- Enable RLS on all tables
ALTER TABLE snippets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_rule_logs ENABLE ROW LEVEL SECURITY;
