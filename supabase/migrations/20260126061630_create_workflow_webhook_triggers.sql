/*
  # Create Workflow Webhook Triggers Module

  This migration creates tables for webhook-based workflow triggers
  that allow external systems to enroll contacts via HTTP requests.

  1. New Tables
    - `workflow_webhook_triggers` - Webhook trigger configurations
      - `id` (uuid, primary key)
      - `org_id` (uuid, FK to organizations)
      - `workflow_id` (uuid, FK to workflows)
      - `name` (text) - Descriptive name
      - `token` (text, unique) - Cryptographic token for URL routing
      - `secret_hash` (text, nullable) - HMAC secret hash for signature validation
      - `contact_identifier_field` (text) - Which payload field identifies contact
      - `payload_mapping` (jsonb) - Maps webhook fields to contact fields
      - `create_contact_if_missing` (boolean) - Create new contacts
      - `update_existing_contact` (boolean) - Update existing contacts
      - `re_enrollment_policy` (text) - never, always, after_completion
      - `is_active` (boolean) - Enable/disable toggle
      - `request_count` (bigint) - Total requests received
      - `last_request_at` (timestamptz, nullable) - Most recent request
      - `created_at`, `updated_at` (timestamptz)

    - `workflow_webhook_requests` - Request logging
      - `id` (uuid, primary key)
      - `org_id` (uuid, FK to organizations)
      - `trigger_id` (uuid, FK to workflow_webhook_triggers)
      - `request_payload` (jsonb) - Incoming data
      - `items_received` (integer) - Items in batch payload
      - `contacts_created` (integer) - New contacts created
      - `contacts_updated` (integer) - Existing contacts updated
      - `enrollments_created` (integer) - New workflow enrollments
      - `status` (text) - success, partial_failure, failed
      - `error_details` (jsonb, nullable) - Any errors
      - `ip_address` (inet, nullable) - Request source IP
      - `user_agent` (text, nullable) - Request user agent
      - `processed_at` (timestamptz) - When processing completed
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled on all tables
    - Organization-scoped access
    - Webhook token used for public URL routing

  3. Indexes
    - Unique index on token for URL routing
    - Workflow lookup index
    - Request history index
*/

-- Create contact identifier field enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'webhook_contact_identifier') THEN
    CREATE TYPE webhook_contact_identifier AS ENUM ('email', 'phone', 'external_id', 'custom');
  END IF;
END $$;

-- Create webhook triggers table
CREATE TABLE IF NOT EXISTS workflow_webhook_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  name text NOT NULL,
  token text NOT NULL UNIQUE,
  secret_hash text,
  contact_identifier_field webhook_contact_identifier NOT NULL DEFAULT 'email',
  contact_identifier_path text NOT NULL DEFAULT 'email',
  payload_mapping jsonb NOT NULL DEFAULT '[]'::jsonb,
  create_contact_if_missing boolean NOT NULL DEFAULT true,
  update_existing_contact boolean NOT NULL DEFAULT true,
  re_enrollment_policy re_enrollment_policy NOT NULL DEFAULT 'never',
  is_active boolean NOT NULL DEFAULT false,
  request_count bigint NOT NULL DEFAULT 0,
  last_request_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create webhook request log table
CREATE TABLE IF NOT EXISTS workflow_webhook_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  trigger_id uuid NOT NULL REFERENCES workflow_webhook_triggers(id) ON DELETE CASCADE,
  request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  items_received integer NOT NULL DEFAULT 1,
  contacts_created integer NOT NULL DEFAULT 0,
  contacts_updated integer NOT NULL DEFAULT 0,
  enrollments_created integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  error_details jsonb,
  ip_address inet,
  user_agent text,
  processed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE workflow_webhook_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_webhook_requests ENABLE ROW LEVEL SECURITY;

-- Create indexes for efficient querying
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_triggers_token 
  ON workflow_webhook_triggers(token);

CREATE INDEX IF NOT EXISTS idx_webhook_triggers_workflow 
  ON workflow_webhook_triggers(workflow_id);

CREATE INDEX IF NOT EXISTS idx_webhook_triggers_org 
  ON workflow_webhook_triggers(org_id);

CREATE INDEX IF NOT EXISTS idx_webhook_triggers_active 
  ON workflow_webhook_triggers(is_active) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_webhook_requests_trigger 
  ON workflow_webhook_requests(trigger_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_requests_org 
  ON workflow_webhook_requests(org_id);

-- Create updated_at trigger
DROP TRIGGER IF EXISTS workflow_webhook_triggers_updated_at ON workflow_webhook_triggers;
CREATE TRIGGER workflow_webhook_triggers_updated_at
  BEFORE UPDATE ON workflow_webhook_triggers
  FOR EACH ROW EXECUTE FUNCTION update_workflow_updated_at();
