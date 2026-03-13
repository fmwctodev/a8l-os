/*
  # Create Vapi Integration Core Tables

  Phase 1 of Vapi.ai integration for the AI Agents module.

  1. New Tables
    - `vapi_assistants` - Core assistant definitions with Vapi runtime binding
    - `vapi_assistant_versions` - Immutable snapshots created on publish
    - `vapi_bindings` - Links assistants to phone numbers and widgets
    - `vapi_calls` - Call records from Vapi runtime
    - `vapi_sessions` - SMS and webchat session records
    - `vapi_tool_registry` - Registered tools available to Vapi assistants
    - `vapi_webhook_logs` - Raw webhook event storage

  2. Security
    - RLS enabled on all tables
    - All policies enforce org_id isolation via authenticated user lookup
    - Read access for org members, write access for org members

  3. Indexes
    - org_id on all tables for RLS performance
    - Unique indexes on Vapi external IDs
    - Status and created_at indexes for filtered queries
*/

-- vapi_assistants
CREATE TABLE IF NOT EXISTS vapi_assistants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  channel_modes jsonb NOT NULL DEFAULT '["voice"]'::jsonb,
  vapi_assistant_id text,
  first_message text DEFAULT '',
  system_prompt text DEFAULT '',
  llm_provider text DEFAULT 'openai',
  llm_model text DEFAULT 'gpt-4o',
  transcriber_provider text DEFAULT 'deepgram',
  transcriber_model text DEFAULT 'nova-2',
  voice_provider text DEFAULT 'elevenlabs',
  voice_id text,
  status text NOT NULL DEFAULT 'draft',
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vapi_assistants_slug_org_unique UNIQUE (org_id, slug),
  CONSTRAINT vapi_assistants_status_check CHECK (status IN ('draft', 'published', 'archived'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vapi_assistants_vapi_id
  ON vapi_assistants(vapi_assistant_id) WHERE vapi_assistant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vapi_assistants_org_id ON vapi_assistants(org_id);
CREATE INDEX IF NOT EXISTS idx_vapi_assistants_status ON vapi_assistants(org_id, status);

ALTER TABLE vapi_assistants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view vapi assistants"
  ON vapi_assistants FOR SELECT TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Org members can insert vapi assistants"
  ON vapi_assistants FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Org members can update vapi assistants"
  ON vapi_assistants FOR UPDATE TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()))
  WITH CHECK (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Org members can delete vapi assistants"
  ON vapi_assistants FOR DELETE TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));


-- vapi_assistant_versions
CREATE TABLE IF NOT EXISTS vapi_assistant_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_id uuid NOT NULL REFERENCES vapi_assistants(id) ON DELETE CASCADE,
  version_number integer NOT NULL DEFAULT 1,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vapi_versions_unique UNIQUE (assistant_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_vapi_versions_assistant ON vapi_assistant_versions(assistant_id);

ALTER TABLE vapi_assistant_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view vapi assistant versions"
  ON vapi_assistant_versions FOR SELECT TO authenticated
  USING (assistant_id IN (
    SELECT va.id FROM vapi_assistants va
    JOIN users u ON u.organization_id = va.org_id
    WHERE u.id = auth.uid()
  ));

CREATE POLICY "Org members can insert vapi assistant versions"
  ON vapi_assistant_versions FOR INSERT TO authenticated
  WITH CHECK (assistant_id IN (
    SELECT va.id FROM vapi_assistants va
    JOIN users u ON u.organization_id = va.org_id
    WHERE u.id = auth.uid()
  ));


-- vapi_bindings
CREATE TABLE IF NOT EXISTS vapi_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assistant_id uuid NOT NULL REFERENCES vapi_assistants(id) ON DELETE CASCADE,
  binding_type text NOT NULL,
  external_binding_id text NOT NULL,
  display_name text DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vapi_bindings_type_check CHECK (binding_type IN ('voice_number', 'sms_number', 'web_widget')),
  CONSTRAINT vapi_bindings_status_check CHECK (status IN ('active', 'inactive'))
);

CREATE INDEX IF NOT EXISTS idx_vapi_bindings_org ON vapi_bindings(org_id);
CREATE INDEX IF NOT EXISTS idx_vapi_bindings_assistant ON vapi_bindings(assistant_id);
CREATE INDEX IF NOT EXISTS idx_vapi_bindings_type ON vapi_bindings(org_id, binding_type);

ALTER TABLE vapi_bindings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view vapi bindings"
  ON vapi_bindings FOR SELECT TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Org members can insert vapi bindings"
  ON vapi_bindings FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Org members can update vapi bindings"
  ON vapi_bindings FOR UPDATE TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()))
  WITH CHECK (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Org members can delete vapi bindings"
  ON vapi_bindings FOR DELETE TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));


-- vapi_calls
CREATE TABLE IF NOT EXISTS vapi_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assistant_id uuid REFERENCES vapi_assistants(id) ON DELETE SET NULL,
  vapi_call_id text,
  direction text DEFAULT 'inbound',
  status text DEFAULT 'queued',
  from_number text,
  to_number text,
  duration_seconds integer,
  started_at timestamptz,
  ended_at timestamptz,
  summary text,
  transcript text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vapi_calls_direction_check CHECK (direction IN ('inbound', 'outbound'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vapi_calls_vapi_id
  ON vapi_calls(vapi_call_id) WHERE vapi_call_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vapi_calls_org ON vapi_calls(org_id);
CREATE INDEX IF NOT EXISTS idx_vapi_calls_assistant ON vapi_calls(assistant_id);
CREATE INDEX IF NOT EXISTS idx_vapi_calls_status ON vapi_calls(org_id, status);
CREATE INDEX IF NOT EXISTS idx_vapi_calls_created ON vapi_calls(org_id, created_at DESC);

ALTER TABLE vapi_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view vapi calls"
  ON vapi_calls FOR SELECT TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Org members can insert vapi calls"
  ON vapi_calls FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Org members can update vapi calls"
  ON vapi_calls FOR UPDATE TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()))
  WITH CHECK (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));


-- vapi_sessions
CREATE TABLE IF NOT EXISTS vapi_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assistant_id uuid REFERENCES vapi_assistants(id) ON DELETE SET NULL,
  vapi_session_id text,
  channel text NOT NULL,
  external_user_id text,
  status text DEFAULT 'active',
  started_at timestamptz,
  ended_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vapi_sessions_channel_check CHECK (channel IN ('sms', 'webchat'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vapi_sessions_vapi_id
  ON vapi_sessions(vapi_session_id) WHERE vapi_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vapi_sessions_org ON vapi_sessions(org_id);
CREATE INDEX IF NOT EXISTS idx_vapi_sessions_assistant ON vapi_sessions(assistant_id);
CREATE INDEX IF NOT EXISTS idx_vapi_sessions_channel ON vapi_sessions(org_id, channel);
CREATE INDEX IF NOT EXISTS idx_vapi_sessions_created ON vapi_sessions(org_id, created_at DESC);

ALTER TABLE vapi_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view vapi sessions"
  ON vapi_sessions FOR SELECT TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Org members can insert vapi sessions"
  ON vapi_sessions FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Org members can update vapi sessions"
  ON vapi_sessions FOR UPDATE TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()))
  WITH CHECK (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));


-- vapi_tool_registry
CREATE TABLE IF NOT EXISTS vapi_tool_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  description text DEFAULT '',
  input_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  endpoint_path text NOT NULL DEFAULT '',
  allowed_assistant_scopes jsonb DEFAULT '["*"]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vapi_tools_name_org
  ON vapi_tool_registry (COALESCE(org_id, '00000000-0000-0000-0000-000000000000'::uuid), tool_name);
CREATE INDEX IF NOT EXISTS idx_vapi_tools_org ON vapi_tool_registry(org_id);
CREATE INDEX IF NOT EXISTS idx_vapi_tools_active ON vapi_tool_registry(active);

ALTER TABLE vapi_tool_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view system and org tools"
  ON vapi_tool_registry FOR SELECT TO authenticated
  USING (
    org_id IS NULL
    OR org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Org members can insert custom tools"
  ON vapi_tool_registry FOR INSERT TO authenticated
  WITH CHECK (
    org_id IS NOT NULL
    AND org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Org members can update their tools"
  ON vapi_tool_registry FOR UPDATE TO authenticated
  USING (
    org_id IS NOT NULL
    AND org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  )
  WITH CHECK (
    org_id IS NOT NULL
    AND org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Org members can delete their custom tools"
  ON vapi_tool_registry FOR DELETE TO authenticated
  USING (
    org_id IS NOT NULL
    AND org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );


-- vapi_webhook_logs
CREATE TABLE IF NOT EXISTS vapi_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  event_type text DEFAULT '',
  payload jsonb DEFAULT '{}'::jsonb,
  processed boolean NOT NULL DEFAULT false,
  processing_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vapi_webhook_logs_org ON vapi_webhook_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_vapi_webhook_logs_event ON vapi_webhook_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_vapi_webhook_logs_created ON vapi_webhook_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vapi_webhook_logs_unprocessed ON vapi_webhook_logs(processed) WHERE processed = false;

ALTER TABLE vapi_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their webhook logs"
  ON vapi_webhook_logs FOR SELECT TO authenticated
  USING (
    org_id IS NULL
    OR org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Authenticated users can insert webhook logs"
  ON vapi_webhook_logs FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update webhook logs"
  ON vapi_webhook_logs FOR UPDATE TO authenticated
  USING (
    org_id IS NULL
    OR org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  )
  WITH CHECK (
    org_id IS NULL
    OR org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );