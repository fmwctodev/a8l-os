/*
  # Extend AI Agents for Multi-Modal Control Center

  This migration extends the AI agents system to support both Conversation AI and Voice AI,
  along with a new agent-specific knowledge system and templates.

  1. Schema Changes to ai_agents Table
    - Add `agent_type` (enum: 'conversation', 'voice') - Default 'conversation'
    - Add Voice AI specific fields:
      - `voice_provider` (text) - Default 'elevenlabs'
      - `voice_id` (text, nullable) - FK reference to elevenlabs voice
      - `speaking_speed` (decimal) - Default 1.0, range 0.5-2.0
      - `voice_tone` (text, nullable) - Descriptive tone
    - Add Conversation AI specific fields:
      - `requires_approval` (boolean) - Default false (changed from always true)
      - `auto_reply_enabled` (boolean) - Default false
      - `cooldown_minutes` (integer, nullable) - Minutes between auto-replies
      - `max_messages_per_day` (integer, nullable) - Daily message limit per contact
      - `per_channel_rules` (jsonb, nullable) - Channel-specific configuration

  2. New Tables
    - `agent_knowledge_sources` - Agent-specific knowledge base
      - Supports: website, faq, table, rich_text, file_upload
      - Tracks embedding status and metadata

    - `agent_templates` - Reusable agent templates
      - Stores agent configurations as templates
      - Tracks usage statistics

  3. Data Migration
    - Set all existing agents to agent_type = 'conversation'
    - Set requires_approval = false for existing agents (new default)

  4. Security
    - RLS enabled on all new tables
    - Policies created in separate migration
*/

-- Create agent type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_agent_type') THEN
    CREATE TYPE ai_agent_type AS ENUM ('conversation', 'voice');
  END IF;
END $$;

-- Create knowledge source type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agent_knowledge_source_type') THEN
    CREATE TYPE agent_knowledge_source_type AS ENUM ('website', 'faq', 'table', 'rich_text', 'file_upload');
  END IF;
END $$;

-- Create knowledge source status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agent_knowledge_source_status') THEN
    CREATE TYPE agent_knowledge_source_status AS ENUM ('active', 'processing', 'error', 'inactive');
  END IF;
END $$;

-- Extend ai_agents table with new fields
DO $$
BEGIN
  -- Add agent_type column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_agents' AND column_name = 'agent_type'
  ) THEN
    ALTER TABLE ai_agents ADD COLUMN agent_type ai_agent_type NOT NULL DEFAULT 'conversation';
  END IF;

  -- Voice AI fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_agents' AND column_name = 'voice_provider'
  ) THEN
    ALTER TABLE ai_agents ADD COLUMN voice_provider text DEFAULT 'elevenlabs';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_agents' AND column_name = 'voice_id'
  ) THEN
    ALTER TABLE ai_agents ADD COLUMN voice_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_agents' AND column_name = 'speaking_speed'
  ) THEN
    ALTER TABLE ai_agents ADD COLUMN speaking_speed decimal(3,2) DEFAULT 1.0 CHECK (speaking_speed >= 0.5 AND speaking_speed <= 2.0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_agents' AND column_name = 'voice_tone'
  ) THEN
    ALTER TABLE ai_agents ADD COLUMN voice_tone text;
  END IF;

  -- Conversation AI fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_agents' AND column_name = 'requires_approval'
  ) THEN
    ALTER TABLE ai_agents ADD COLUMN requires_approval boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_agents' AND column_name = 'auto_reply_enabled'
  ) THEN
    ALTER TABLE ai_agents ADD COLUMN auto_reply_enabled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_agents' AND column_name = 'cooldown_minutes'
  ) THEN
    ALTER TABLE ai_agents ADD COLUMN cooldown_minutes integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_agents' AND column_name = 'max_messages_per_day'
  ) THEN
    ALTER TABLE ai_agents ADD COLUMN max_messages_per_day integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_agents' AND column_name = 'per_channel_rules'
  ) THEN
    ALTER TABLE ai_agents ADD COLUMN per_channel_rules jsonb;
  END IF;
END $$;

-- Create agent_knowledge_sources table
CREATE TABLE IF NOT EXISTS agent_knowledge_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES ai_agents(id) ON DELETE CASCADE,
  source_type agent_knowledge_source_type NOT NULL,
  source_name text NOT NULL,
  source_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  chunk_size integer NOT NULL DEFAULT 1000,
  refresh_frequency text,
  status agent_knowledge_source_status NOT NULL DEFAULT 'active',
  last_embedded_at timestamptz,
  embedding_count integer NOT NULL DEFAULT 0,
  error_message text,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create agent_templates table
CREATE TABLE IF NOT EXISTS agent_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  agent_type ai_agent_type NOT NULL,
  use_case text,
  template_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  times_used integer NOT NULL DEFAULT 0,
  is_public boolean NOT NULL DEFAULT false,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE agent_knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_templates ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_agents_type_org ON ai_agents(agent_type, org_id);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_sources_agent ON agent_knowledge_sources(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_sources_org_status ON agent_knowledge_sources(org_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_templates_org_type ON agent_templates(org_id, agent_type);

-- Create trigger for updated_at timestamps on new tables
DROP TRIGGER IF EXISTS agent_knowledge_sources_updated_at ON agent_knowledge_sources;
CREATE TRIGGER agent_knowledge_sources_updated_at
  BEFORE UPDATE ON agent_knowledge_sources
  FOR EACH ROW EXECUTE FUNCTION update_ai_agent_updated_at();

DROP TRIGGER IF EXISTS agent_templates_updated_at ON agent_templates;
CREATE TRIGGER agent_templates_updated_at
  BEFORE UPDATE ON agent_templates
  FOR EACH ROW EXECUTE FUNCTION update_ai_agent_updated_at();

-- Data migration: Set all existing agents to conversation type
UPDATE ai_agents
SET agent_type = 'conversation'
WHERE agent_type IS NULL;
