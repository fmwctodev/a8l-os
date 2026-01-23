/*
  # Lead Scoring Module - Core Schema

  1. New Tables
    - `scoring_models` - Defines scoring models (lead score, engagement score, etc.)
      - `id` (uuid, primary key)
      - `org_id` (uuid, references organizations)
      - `name` (text) - Display name
      - `scope` (text) - 'contact' or 'opportunity'
      - `starting_score` (integer) - Initial score for new entities
      - `max_score` (integer, nullable) - Optional cap
      - `is_primary` (boolean) - Primary model for scope
      - `active` (boolean) - Whether model is enabled
      - `created_at`, `updated_at` (timestamptz)

    - `scoring_model_decay_config` - Decay settings per model
      - `id` (uuid, primary key)
      - `model_id` (uuid, references scoring_models)
      - `enabled` (boolean) - Whether decay is active
      - `decay_type` (text) - 'linear' or 'step'
      - `decay_amount` (integer) - Points to subtract
      - `interval_days` (integer) - Days between decay
      - `min_score_floor` (integer) - Minimum score after decay
      - `notification_threshold` (integer) - Score threshold for alerts
      - `notify_in_app` (boolean) - Send in-app notification
      - `notify_email` (boolean) - Send email notification
      - `notify_sms` (boolean) - Send SMS notification

    - `scoring_rules` - Rules that trigger score changes
      - `id` (uuid, primary key)
      - `model_id` (uuid, references scoring_models)
      - `name` (text) - Rule name
      - `trigger_type` (text) - Event type that triggers rule
      - `trigger_config` (jsonb) - Conditions for trigger
      - `points` (integer) - Points to add/subtract (can be negative)
      - `frequency_type` (text) - 'once', 'interval', 'unlimited'
      - `cooldown_interval` (integer, nullable) - Cooldown period
      - `cooldown_unit` (text, nullable) - 'minutes', 'hours', 'days'
      - `active` (boolean) - Whether rule is enabled

    - `entity_scores` - Current scores for contacts/opportunities
      - `id` (uuid, primary key)
      - `org_id` (uuid, references organizations)
      - `model_id` (uuid, references scoring_models)
      - `entity_type` (text) - 'contact' or 'opportunity'
      - `entity_id` (uuid) - ID of the scored entity
      - `current_score` (integer) - Current score value
      - `last_decay_at` (timestamptz, nullable) - Last decay application
      - `last_updated_at` (timestamptz) - Last score change

    - `score_events` - Audit log of all score changes
      - `id` (uuid, primary key)
      - `org_id` (uuid, references organizations)
      - `model_id` (uuid, references scoring_models)
      - `entity_type` (text)
      - `entity_id` (uuid)
      - `rule_id` (uuid, nullable) - Rule that triggered change
      - `points_delta` (integer) - Points added/subtracted
      - `previous_score` (integer) - Score before change
      - `new_score` (integer) - Score after change
      - `reason` (text) - Description of why score changed
      - `source` (text) - 'rule', 'manual', 'decay'
      - `created_by` (uuid, nullable) - User who made manual adjustment
      - `created_at` (timestamptz)

    - `scoring_rule_executions` - Tracks rule execution for cooldowns
      - `id` (uuid, primary key)
      - `rule_id` (uuid, references scoring_rules)
      - `entity_id` (uuid)
      - `executed_at` (timestamptz)

    - `scoring_adjustment_limits` - Org-level limits on manual adjustments
      - `id` (uuid, primary key)
      - `org_id` (uuid, references organizations, unique)
      - `max_positive_adjustment` (integer) - Max points to add
      - `max_negative_adjustment` (integer) - Max points to subtract
      - `require_reason` (boolean) - Whether reason is required

  2. Indexes
    - Composite indexes for efficient lookups on entity_scores
    - Indexes on score_events for history queries
    - Indexes on rule_executions for cooldown checks
*/

-- Scoring Models
CREATE TABLE IF NOT EXISTS scoring_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('contact', 'opportunity')),
  starting_score integer NOT NULL DEFAULT 0,
  max_score integer,
  is_primary boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scoring_models_org ON scoring_models(org_id);
CREATE INDEX IF NOT EXISTS idx_scoring_models_scope ON scoring_models(org_id, scope);
CREATE INDEX IF NOT EXISTS idx_scoring_models_primary ON scoring_models(org_id, scope, is_primary) WHERE is_primary = true;

-- Scoring Model Decay Configuration
CREATE TABLE IF NOT EXISTS scoring_model_decay_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES scoring_models(id) ON DELETE CASCADE UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  decay_type text NOT NULL DEFAULT 'linear' CHECK (decay_type IN ('linear', 'step')),
  decay_amount integer NOT NULL DEFAULT 5,
  interval_days integer NOT NULL DEFAULT 30,
  min_score_floor integer NOT NULL DEFAULT 0,
  notification_threshold integer,
  notify_in_app boolean NOT NULL DEFAULT true,
  notify_email boolean NOT NULL DEFAULT false,
  notify_sms boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Scoring Rules
CREATE TABLE IF NOT EXISTS scoring_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES scoring_models(id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger_type text NOT NULL,
  trigger_config jsonb NOT NULL DEFAULT '{}',
  points integer NOT NULL,
  frequency_type text NOT NULL DEFAULT 'unlimited' CHECK (frequency_type IN ('once', 'interval', 'unlimited')),
  cooldown_interval integer,
  cooldown_unit text CHECK (cooldown_unit IN ('minutes', 'hours', 'days')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scoring_rules_model ON scoring_rules(model_id);
CREATE INDEX IF NOT EXISTS idx_scoring_rules_trigger ON scoring_rules(model_id, trigger_type) WHERE active = true;

-- Entity Scores
CREATE TABLE IF NOT EXISTS entity_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  model_id uuid NOT NULL REFERENCES scoring_models(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('contact', 'opportunity')),
  entity_id uuid NOT NULL,
  current_score integer NOT NULL DEFAULT 0,
  last_decay_at timestamptz,
  last_updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (model_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_scores_org ON entity_scores(org_id);
CREATE INDEX IF NOT EXISTS idx_entity_scores_entity ON entity_scores(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_scores_model ON entity_scores(model_id);
CREATE INDEX IF NOT EXISTS idx_entity_scores_decay ON entity_scores(model_id, last_decay_at) WHERE last_decay_at IS NOT NULL;

-- Score Events (Audit Log)
CREATE TABLE IF NOT EXISTS score_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  model_id uuid NOT NULL REFERENCES scoring_models(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  rule_id uuid REFERENCES scoring_rules(id) ON DELETE SET NULL,
  points_delta integer NOT NULL,
  previous_score integer NOT NULL,
  new_score integer NOT NULL,
  reason text NOT NULL,
  source text NOT NULL CHECK (source IN ('rule', 'manual', 'decay')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_score_events_entity ON score_events(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_score_events_model ON score_events(model_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_score_events_org ON score_events(org_id, created_at DESC);

-- Scoring Rule Executions (for cooldown tracking)
CREATE TABLE IF NOT EXISTS scoring_rule_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES scoring_rules(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL,
  executed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rule_executions_lookup ON scoring_rule_executions(rule_id, entity_id, executed_at DESC);

-- Scoring Adjustment Limits
CREATE TABLE IF NOT EXISTS scoring_adjustment_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  max_positive_adjustment integer NOT NULL DEFAULT 100,
  max_negative_adjustment integer NOT NULL DEFAULT 100,
  require_reason boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE scoring_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_model_decay_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_rule_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_adjustment_limits ENABLE ROW LEVEL SECURITY;

-- Add updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS set_scoring_models_updated_at ON scoring_models;
CREATE TRIGGER set_scoring_models_updated_at
  BEFORE UPDATE ON scoring_models
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_scoring_model_decay_config_updated_at ON scoring_model_decay_config;
CREATE TRIGGER set_scoring_model_decay_config_updated_at
  BEFORE UPDATE ON scoring_model_decay_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_scoring_rules_updated_at ON scoring_rules;
CREATE TRIGGER set_scoring_rules_updated_at
  BEFORE UPDATE ON scoring_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_scoring_adjustment_limits_updated_at ON scoring_adjustment_limits;
CREATE TRIGGER set_scoring_adjustment_limits_updated_at
  BEFORE UPDATE ON scoring_adjustment_limits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
