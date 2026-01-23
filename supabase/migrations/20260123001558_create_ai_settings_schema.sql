/*
  # AI Agents Settings Module Schema

  This migration creates tables for comprehensive AI agent configuration including
  LLM providers, models, voice synthesis, knowledge bases, and prompt templates.

  1. New Tables
    - `llm_providers` - LLM provider configurations (OpenAI, Anthropic, Google)
      - `id` (uuid, primary key)
      - `org_id` (uuid, FK to organizations)
      - `provider` (text) - Provider name
      - `api_key_encrypted` (text) - Encrypted API key
      - `base_url` (text, nullable) - Custom base URL for proxies
      - `enabled` (boolean) - Whether provider is active
      - `created_at`, `updated_at` (timestamptz)

    - `llm_models` - Model catalog per organization
      - `id` (uuid, primary key)
      - `org_id` (uuid, FK to organizations)
      - `provider_id` (uuid, FK to llm_providers)
      - `model_key` (text) - API model identifier
      - `display_name` (text) - Human-readable name
      - `enabled` (boolean) - Whether model is available
      - `is_default` (boolean) - Organization default model
      - `context_window` (integer, nullable) - Token context window
      - `metadata` (jsonb) - Cost info, capabilities
      - `created_at`, `updated_at` (timestamptz)

    - `elevenlabs_connection` - ElevenLabs API connection per org
      - `id` (uuid, primary key)
      - `org_id` (uuid, FK to organizations, unique)
      - `api_key_encrypted` (text) - Encrypted API key
      - `enabled` (boolean) - Whether voice synthesis is active
      - `last_synced_at` (timestamptz, nullable)
      - `created_at`, `updated_at` (timestamptz)

    - `elevenlabs_voices` - Voice catalog synced from ElevenLabs
      - `id` (uuid, primary key)
      - `org_id` (uuid, FK to organizations)
      - `voice_id` (text) - ElevenLabs voice ID
      - `voice_name` (text) - Display name
      - `enabled` (boolean) - Whether voice is available
      - `is_default` (boolean) - Default voice for org
      - `metadata` (jsonb) - Labels, accent, gender, age
      - `created_at`, `updated_at` (timestamptz)

    - `knowledge_collections` - Global knowledge base collections
      - `id` (uuid, primary key)
      - `org_id` (uuid, FK to organizations)
      - `name` (text) - Collection name
      - `description` (text, nullable)
      - `status` (text) - active/inactive
      - `apply_to_all_agents` (boolean) - Auto-include in all agent runs
      - `created_by` (uuid, FK to users)
      - `created_at`, `updated_at` (timestamptz)

    - `knowledge_versions` - Immutable version history for knowledge
      - `id` (uuid, primary key)
      - `collection_id` (uuid, FK to knowledge_collections)
      - `version_number` (integer) - Sequential version
      - `body_text` (text, nullable) - Knowledge content
      - `drive_file_ids` (jsonb, nullable) - Attached Drive files
      - `created_by` (uuid, FK to users)
      - `created_at` (timestamptz)

    - `knowledge_embeddings` - Vector embeddings for semantic search
      - `id` (uuid, primary key)
      - `collection_id` (uuid, FK to knowledge_collections)
      - `version_id` (uuid, FK to knowledge_versions)
      - `chunk_index` (integer) - Chunk position
      - `chunk_text` (text) - Text chunk content
      - `embedding` (vector(1536)) - OpenAI embedding vector
      - `created_at` (timestamptz)

    - `prompt_templates` - Reusable prompt blocks
      - `id` (uuid, primary key)
      - `org_id` (uuid, FK to organizations)
      - `name` (text) - Template name
      - `category` (text) - Template category
      - `status` (text) - active/inactive
      - `created_by` (uuid, FK to users)
      - `created_at`, `updated_at` (timestamptz)

    - `prompt_template_versions` - Immutable version history for prompts
      - `id` (uuid, primary key)
      - `template_id` (uuid, FK to prompt_templates)
      - `version_number` (integer) - Sequential version
      - `body` (text) - Prompt content with {{variables}}
      - `variables` (jsonb) - Auto-detected variables
      - `created_by` (uuid, FK to users)
      - `created_at` (timestamptz)

    - `agent_knowledge_links` - Junction table for agent-knowledge relationships
      - `agent_id` (uuid, FK to ai_agents)
      - `collection_id` (uuid, FK to knowledge_collections)
      - Primary key: (agent_id, collection_id)

    - `agent_prompt_links` - Junction table for agent-prompt relationships
      - `agent_id` (uuid, FK to ai_agents)
      - `template_id` (uuid, FK to prompt_templates)
      - `sort_order` (integer) - Order of prompt inclusion
      - Primary key: (agent_id, template_id)

    - `ai_agent_settings_defaults` - Organization-wide AI agent defaults
      - `org_id` (uuid, PK, FK to organizations)
      - `default_model_id` (uuid, nullable, FK to llm_models)
      - `default_allowed_tools` (jsonb) - Default tool set
      - `require_human_approval_default` (boolean)
      - `max_outbound_per_run_default` (integer)
      - `created_at`, `updated_at` (timestamptz)

  2. Extensions
    - Enable pgvector for embedding storage and similarity search

  3. AI Agents Table Extensions
    - Add `model_id` column for custom model selection
    - Add `require_human_approval` column for safety control
    - Add `max_outbound_per_run` column for rate limiting
    - Add `enable_memory` column for memory toggle

  4. Indexes
    - Vector index on knowledge_embeddings for similarity search
    - Various lookup indexes for efficient querying

  5. Security
    - RLS enabled on all tables (policies in separate migration)
*/

-- Enable pgvector extension for embedding storage
CREATE EXTENSION IF NOT EXISTS vector;

-- Create knowledge status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'knowledge_status') THEN
    CREATE TYPE knowledge_status AS ENUM ('active', 'inactive');
  END IF;
END $$;

-- Create prompt status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'prompt_status') THEN
    CREATE TYPE prompt_status AS ENUM ('active', 'inactive');
  END IF;
END $$;

-- Create prompt category enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'prompt_category') THEN
    CREATE TYPE prompt_category AS ENUM (
      'lead_qualification',
      'appointment_booking',
      'follow_up',
      'objection_handling',
      'internal_ops',
      'custom'
    );
  END IF;
END $$;

-- LLM Providers table
CREATE TABLE IF NOT EXISTS llm_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  api_key_encrypted text NOT NULL,
  base_url text,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, provider)
);

-- LLM Models table
CREATE TABLE IF NOT EXISTS llm_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES llm_providers(id) ON DELETE CASCADE,
  model_key text NOT NULL,
  display_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  context_window integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, model_key)
);

-- ElevenLabs Connection table
CREATE TABLE IF NOT EXISTS elevenlabs_connection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  api_key_encrypted text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  last_synced_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ElevenLabs Voices table
CREATE TABLE IF NOT EXISTS elevenlabs_voices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  voice_id text NOT NULL,
  voice_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, voice_id)
);

-- Knowledge Collections table
CREATE TABLE IF NOT EXISTS knowledge_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  status knowledge_status NOT NULL DEFAULT 'active',
  apply_to_all_agents boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Knowledge Versions table (immutable)
CREATE TABLE IF NOT EXISTS knowledge_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES knowledge_collections(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  body_text text,
  drive_file_ids jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(collection_id, version_number)
);

-- Knowledge Embeddings table for vector search
CREATE TABLE IF NOT EXISTS knowledge_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES knowledge_collections(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES knowledge_versions(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  chunk_text text NOT NULL,
  embedding vector(1536),
  created_at timestamptz DEFAULT now()
);

-- Prompt Templates table
CREATE TABLE IF NOT EXISTS prompt_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  category prompt_category NOT NULL DEFAULT 'custom',
  status prompt_status NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Prompt Template Versions table (immutable)
CREATE TABLE IF NOT EXISTS prompt_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES prompt_templates(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  body text NOT NULL,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(template_id, version_number)
);

-- Agent-Knowledge junction table
CREATE TABLE IF NOT EXISTS agent_knowledge_links (
  agent_id uuid NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES knowledge_collections(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (agent_id, collection_id)
);

-- Agent-Prompt junction table
CREATE TABLE IF NOT EXISTS agent_prompt_links (
  agent_id uuid NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES prompt_templates(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (agent_id, template_id)
);

-- AI Agent Settings Defaults table
CREATE TABLE IF NOT EXISTS ai_agent_settings_defaults (
  org_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  default_model_id uuid REFERENCES llm_models(id) ON DELETE SET NULL,
  default_allowed_tools jsonb NOT NULL DEFAULT '["get_contact", "get_timeline", "get_conversation_history"]'::jsonb,
  require_human_approval_default boolean NOT NULL DEFAULT true,
  max_outbound_per_run_default integer NOT NULL DEFAULT 5,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Extend ai_agents table with new columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_agents' AND column_name = 'model_id'
  ) THEN
    ALTER TABLE ai_agents ADD COLUMN model_id uuid REFERENCES llm_models(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_agents' AND column_name = 'require_human_approval'
  ) THEN
    ALTER TABLE ai_agents ADD COLUMN require_human_approval boolean NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_agents' AND column_name = 'max_outbound_per_run'
  ) THEN
    ALTER TABLE ai_agents ADD COLUMN max_outbound_per_run integer NOT NULL DEFAULT 5;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_agents' AND column_name = 'enable_memory'
  ) THEN
    ALTER TABLE ai_agents ADD COLUMN enable_memory boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- Enable RLS on all tables
ALTER TABLE llm_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE elevenlabs_connection ENABLE ROW LEVEL SECURITY;
ALTER TABLE elevenlabs_voices ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_knowledge_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_prompt_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_settings_defaults ENABLE ROW LEVEL SECURITY;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_llm_providers_org ON llm_providers(org_id);
CREATE INDEX IF NOT EXISTS idx_llm_models_org_enabled ON llm_models(org_id, enabled);
CREATE INDEX IF NOT EXISTS idx_llm_models_provider ON llm_models(provider_id);
CREATE INDEX IF NOT EXISTS idx_elevenlabs_voices_org ON elevenlabs_voices(org_id, enabled);
CREATE INDEX IF NOT EXISTS idx_knowledge_collections_org ON knowledge_collections(org_id, status);
CREATE INDEX IF NOT EXISTS idx_knowledge_versions_collection ON knowledge_versions(collection_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_org ON prompt_templates(org_id, status);
CREATE INDEX IF NOT EXISTS idx_prompt_template_versions_template ON prompt_template_versions(template_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_links_agent ON agent_knowledge_links(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_links_collection ON agent_knowledge_links(collection_id);
CREATE INDEX IF NOT EXISTS idx_agent_prompt_links_agent ON agent_prompt_links(agent_id);

-- Create vector index for similarity search using ivfflat
CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_vector ON knowledge_embeddings 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_collection ON knowledge_embeddings(collection_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_version ON knowledge_embeddings(version_id);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_ai_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS llm_providers_updated_at ON llm_providers;
CREATE TRIGGER llm_providers_updated_at
  BEFORE UPDATE ON llm_providers
  FOR EACH ROW EXECUTE FUNCTION update_ai_settings_updated_at();

DROP TRIGGER IF EXISTS llm_models_updated_at ON llm_models;
CREATE TRIGGER llm_models_updated_at
  BEFORE UPDATE ON llm_models
  FOR EACH ROW EXECUTE FUNCTION update_ai_settings_updated_at();

DROP TRIGGER IF EXISTS elevenlabs_connection_updated_at ON elevenlabs_connection;
CREATE TRIGGER elevenlabs_connection_updated_at
  BEFORE UPDATE ON elevenlabs_connection
  FOR EACH ROW EXECUTE FUNCTION update_ai_settings_updated_at();

DROP TRIGGER IF EXISTS elevenlabs_voices_updated_at ON elevenlabs_voices;
CREATE TRIGGER elevenlabs_voices_updated_at
  BEFORE UPDATE ON elevenlabs_voices
  FOR EACH ROW EXECUTE FUNCTION update_ai_settings_updated_at();

DROP TRIGGER IF EXISTS knowledge_collections_updated_at ON knowledge_collections;
CREATE TRIGGER knowledge_collections_updated_at
  BEFORE UPDATE ON knowledge_collections
  FOR EACH ROW EXECUTE FUNCTION update_ai_settings_updated_at();

DROP TRIGGER IF EXISTS prompt_templates_updated_at ON prompt_templates;
CREATE TRIGGER prompt_templates_updated_at
  BEFORE UPDATE ON prompt_templates
  FOR EACH ROW EXECUTE FUNCTION update_ai_settings_updated_at();

DROP TRIGGER IF EXISTS ai_agent_settings_defaults_updated_at ON ai_agent_settings_defaults;
CREATE TRIGGER ai_agent_settings_defaults_updated_at
  BEFORE UPDATE ON ai_agent_settings_defaults
  FOR EACH ROW EXECUTE FUNCTION update_ai_settings_updated_at();

-- Function to search knowledge embeddings by similarity
CREATE OR REPLACE FUNCTION search_knowledge_embeddings(
  p_org_id uuid,
  p_query_embedding vector(1536),
  p_collection_ids uuid[] DEFAULT NULL,
  p_limit integer DEFAULT 5
)
RETURNS TABLE (
  collection_id uuid,
  collection_name text,
  chunk_text text,
  similarity float
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    kc.id as collection_id,
    kc.name as collection_name,
    ke.chunk_text,
    1 - (ke.embedding <=> p_query_embedding) as similarity
  FROM knowledge_embeddings ke
  JOIN knowledge_collections kc ON kc.id = ke.collection_id
  JOIN knowledge_versions kv ON kv.id = ke.version_id
  WHERE kc.org_id = p_org_id
    AND kc.status = 'active'
    AND (p_collection_ids IS NULL OR kc.id = ANY(p_collection_ids))
    AND kv.version_number = (
      SELECT MAX(version_number) 
      FROM knowledge_versions 
      WHERE collection_id = kc.id
    )
  ORDER BY ke.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get next version number for knowledge collection
CREATE OR REPLACE FUNCTION get_next_knowledge_version(p_collection_id uuid)
RETURNS integer AS $$
DECLARE
  v_next integer;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next
  FROM knowledge_versions
  WHERE collection_id = p_collection_id;
  RETURN v_next;
END;
$$ LANGUAGE plpgsql;

-- Function to get next version number for prompt template
CREATE OR REPLACE FUNCTION get_next_prompt_version(p_template_id uuid)
RETURNS integer AS $$
DECLARE
  v_next integer;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next
  FROM prompt_template_versions
  WHERE template_id = p_template_id;
  RETURN v_next;
END;
$$ LANGUAGE plpgsql;

-- Function to parse variables from prompt body
CREATE OR REPLACE FUNCTION parse_prompt_variables(p_body text)
RETURNS jsonb AS $$
DECLARE
  v_matches text[];
  v_result jsonb := '[]'::jsonb;
  v_match text;
BEGIN
  SELECT ARRAY(
    SELECT DISTINCT (regexp_matches(p_body, '\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}', 'g'))[1]
  ) INTO v_matches;
  
  FOREACH v_match IN ARRAY v_matches
  LOOP
    v_result := v_result || to_jsonb(v_match);
  END LOOP;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to auto-parse variables when inserting prompt versions
CREATE OR REPLACE FUNCTION auto_parse_prompt_variables()
RETURNS TRIGGER AS $$
BEGIN
  NEW.variables := parse_prompt_variables(NEW.body);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prompt_template_versions_parse_variables ON prompt_template_versions;
CREATE TRIGGER prompt_template_versions_parse_variables
  BEFORE INSERT ON prompt_template_versions
  FOR EACH ROW EXECUTE FUNCTION auto_parse_prompt_variables();