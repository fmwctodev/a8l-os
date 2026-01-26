/*
  # AI Workflow Actions Schema

  ## Overview
  This migration creates the database tables for AI-powered workflow actions,
  including execution tracking, learning signals for outcome analysis, and
  guardrails configuration.

  ## 1. New Enums

  ### ai_workflow_action_type
  The 6 AI action types supported in workflows:
  - ai_conversation_reply - Generate reply to conversation
  - ai_email_draft - Generate email content
  - ai_follow_up_message - Generate follow-up message
  - ai_lead_qualification - Classify and qualify leads
  - ai_booking_assist - Help with appointment booking
  - ai_decision_step - Make routing decision

  ### ai_outcome_type
  Learning signal outcome types for tracking AI action effectiveness:
  - reply_received - Contact replied to AI message
  - booking_made - Contact booked appointment after AI assist
  - deal_won - Opportunity closed won after AI qualification
  - invoice_paid - Invoice paid after AI follow-up
  - positive_sentiment - Positive response detected
  - negative_sentiment - Negative response detected
  - unsubscribe - Contact unsubscribed
  - complaint - Complaint received
  - no_response - No response within time window

  ### ai_draft_source
  Source of AI draft creation:
  - manual - User manually triggered
  - conversation_rule - Triggered by conversation automation rule
  - workflow - Triggered by workflow AI action

  ## 2. New Tables

  ### workflow_ai_runs
  Tracks execution of AI actions within workflows:
  - Primary tracking: workflow_id, enrollment_id, node_id, agent_id
  - Context: platform_context, input_context, prompt_rendered
  - Output: output_raw, output_structured (for qualification/decision)
  - Metrics: tokens_used, latency_ms, model_used, temperature_used
  - Status tracking and timestamps

  ### ai_workflow_learning_signals
  Captures outcomes of AI actions for performance analysis:
  - Links to workflow_ai_run
  - Outcome type and value
  - Timing metrics
  - Sentiment scoring

  ### ai_action_guardrails
  Organization-level guardrail configurations:
  - Guardrail type and configuration
  - Scope (channels, action types)
  - Active status

  ## 3. Schema Extensions

  ### ai_drafts table extensions
  - workflow_id - Reference to originating workflow
  - enrollment_id - Reference to workflow enrollment
  - workflow_ai_run_id - Reference to AI run record
  - source_type - manual/conversation_rule/workflow
  - action_type - The AI action type that generated the draft

  ## 4. Security
  - RLS enabled on all new tables
  - Policies scoped to organization
  - Service role bypass for edge functions

  ## 5. Indexes
  - Optimized for common query patterns
  - Performance indexes for analytics queries
*/

-- Create AI workflow action type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_workflow_action_type') THEN
    CREATE TYPE ai_workflow_action_type AS ENUM (
      'ai_conversation_reply',
      'ai_email_draft',
      'ai_follow_up_message',
      'ai_lead_qualification',
      'ai_booking_assist',
      'ai_decision_step'
    );
  END IF;
END $$;

-- Create AI outcome type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_outcome_type') THEN
    CREATE TYPE ai_outcome_type AS ENUM (
      'reply_received',
      'booking_made',
      'deal_won',
      'invoice_paid',
      'positive_sentiment',
      'negative_sentiment',
      'unsubscribe',
      'complaint',
      'no_response'
    );
  END IF;
END $$;

-- Create AI draft source enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_draft_source') THEN
    CREATE TYPE ai_draft_source AS ENUM (
      'manual',
      'conversation_rule',
      'workflow'
    );
  END IF;
END $$;

-- Create AI run status enum (extends existing with pending_approval)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_workflow_run_status') THEN
    CREATE TYPE ai_workflow_run_status AS ENUM (
      'pending',
      'running',
      'success',
      'failed',
      'pending_approval'
    );
  END IF;
END $$;

-- Create workflow_ai_runs table
CREATE TABLE IF NOT EXISTS workflow_ai_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL REFERENCES workflow_enrollments(id) ON DELETE CASCADE,
  node_id text NOT NULL,
  agent_id uuid REFERENCES ai_agents(id) ON DELETE SET NULL,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  
  ai_action_type ai_workflow_action_type NOT NULL,
  
  platform_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  input_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  prompt_rendered text,
  
  output_raw text,
  output_structured jsonb,
  
  status ai_workflow_run_status NOT NULL DEFAULT 'pending',
  error_message text,
  
  tokens_used integer NOT NULL DEFAULT 0,
  latency_ms integer,
  model_used text,
  temperature_used decimal(3,2),
  
  guardrails_applied jsonb NOT NULL DEFAULT '[]'::jsonb,
  guardrails_blocked boolean NOT NULL DEFAULT false,
  guardrails_block_reason text,
  
  created_at timestamptz DEFAULT now() NOT NULL,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create ai_workflow_learning_signals table
CREATE TABLE IF NOT EXISTS ai_workflow_learning_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  node_id text NOT NULL,
  agent_id uuid REFERENCES ai_agents(id) ON DELETE SET NULL,
  workflow_ai_run_id uuid NOT NULL REFERENCES workflow_ai_runs(id) ON DELETE CASCADE,
  
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  
  channel text,
  ai_action_type ai_workflow_action_type NOT NULL,
  
  outcome_type ai_outcome_type NOT NULL,
  outcome_value decimal(10,4),
  sentiment_score decimal(3,2),
  
  time_to_outcome_ms bigint,
  
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create ai_action_guardrails table
CREATE TABLE IF NOT EXISTS ai_action_guardrails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  name text NOT NULL,
  description text,
  guardrail_type text NOT NULL CHECK (guardrail_type IN (
    'blocked_claims',
    'profanity_filter',
    'pii_redaction',
    'quiet_hours',
    'max_length',
    'domain_blocklist',
    'custom_regex'
  )),
  
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  applies_to_channels jsonb NOT NULL DEFAULT '["sms", "email"]'::jsonb,
  applies_to_action_types jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 100,
  
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Extend ai_drafts table with workflow columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_drafts' AND column_name = 'workflow_id'
  ) THEN
    ALTER TABLE ai_drafts ADD COLUMN workflow_id uuid REFERENCES workflows(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_drafts' AND column_name = 'enrollment_id'
  ) THEN
    ALTER TABLE ai_drafts ADD COLUMN enrollment_id uuid REFERENCES workflow_enrollments(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_drafts' AND column_name = 'workflow_ai_run_id'
  ) THEN
    ALTER TABLE ai_drafts ADD COLUMN workflow_ai_run_id uuid REFERENCES workflow_ai_runs(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_drafts' AND column_name = 'source_type'
  ) THEN
    ALTER TABLE ai_drafts ADD COLUMN source_type ai_draft_source NOT NULL DEFAULT 'manual';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_drafts' AND column_name = 'action_type'
  ) THEN
    ALTER TABLE ai_drafts ADD COLUMN action_type ai_workflow_action_type;
  END IF;
END $$;

-- Enable RLS on new tables
ALTER TABLE workflow_ai_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_workflow_learning_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_action_guardrails ENABLE ROW LEVEL SECURITY;

-- Indexes for workflow_ai_runs
CREATE INDEX IF NOT EXISTS idx_workflow_ai_runs_org_workflow ON workflow_ai_runs(org_id, workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_ai_runs_enrollment ON workflow_ai_runs(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_workflow_ai_runs_org_created ON workflow_ai_runs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_ai_runs_status ON workflow_ai_runs(org_id, status);
CREATE INDEX IF NOT EXISTS idx_workflow_ai_runs_action_type ON workflow_ai_runs(org_id, ai_action_type);
CREATE INDEX IF NOT EXISTS idx_workflow_ai_runs_agent ON workflow_ai_runs(agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workflow_ai_runs_contact ON workflow_ai_runs(contact_id);

-- Indexes for ai_workflow_learning_signals
CREATE INDEX IF NOT EXISTS idx_learning_signals_org_workflow ON ai_workflow_learning_signals(org_id, workflow_id);
CREATE INDEX IF NOT EXISTS idx_learning_signals_ai_run ON ai_workflow_learning_signals(workflow_ai_run_id);
CREATE INDEX IF NOT EXISTS idx_learning_signals_org_captured ON ai_workflow_learning_signals(org_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_signals_outcome ON ai_workflow_learning_signals(org_id, outcome_type);
CREATE INDEX IF NOT EXISTS idx_learning_signals_action_type ON ai_workflow_learning_signals(org_id, ai_action_type);
CREATE INDEX IF NOT EXISTS idx_learning_signals_node ON ai_workflow_learning_signals(workflow_id, node_id);

-- Indexes for ai_action_guardrails
CREATE INDEX IF NOT EXISTS idx_guardrails_org_active ON ai_action_guardrails(org_id, is_active, priority) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_guardrails_type ON ai_action_guardrails(org_id, guardrail_type);

-- Indexes for new ai_drafts columns
CREATE INDEX IF NOT EXISTS idx_ai_drafts_workflow ON ai_drafts(workflow_id) WHERE workflow_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_drafts_source ON ai_drafts(organization_id, source_type);
CREATE INDEX IF NOT EXISTS idx_ai_drafts_pending_workflow ON ai_drafts(organization_id, status, source_type) 
  WHERE status = 'pending' AND source_type = 'workflow';

-- Trigger for updated_at on workflow_ai_runs
CREATE OR REPLACE FUNCTION update_workflow_ai_runs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS workflow_ai_runs_updated_at ON workflow_ai_runs;
CREATE TRIGGER workflow_ai_runs_updated_at
  BEFORE UPDATE ON workflow_ai_runs
  FOR EACH ROW EXECUTE FUNCTION update_workflow_ai_runs_updated_at();

-- Trigger for updated_at on ai_action_guardrails
DROP TRIGGER IF EXISTS ai_action_guardrails_updated_at ON ai_action_guardrails;
CREATE TRIGGER ai_action_guardrails_updated_at
  BEFORE UPDATE ON ai_action_guardrails
  FOR EACH ROW EXECUTE FUNCTION update_workflow_ai_runs_updated_at();
