/*
  # Vapi Permissions, Integration Registration, and System Tool Seeding

  1. Permissions (8 new)
    - ai_agents.voice.view, .create, .edit, .publish, .call,
      .bind_numbers, .manage_widgets, .tools.manage
  2. Role Assignments
    - SuperAdmin & Admin: all 8
    - Manager: view, call
    - Team Lead & Agent: view only
  3. Integration: registers "vapi" per org
  4. System Tools: 11 built-in tools seeded
*/

DO $$
DECLARE
  perm_record RECORD;
  v_role_id uuid;
  v_org RECORD;
BEGIN
  INSERT INTO permissions (key, description, module_name, created_at)
  VALUES
    ('ai_agents.voice.view', 'View Voice AI assistants and data', 'ai_agents', now()),
    ('ai_agents.voice.create', 'Create new voice assistants', 'ai_agents', now()),
    ('ai_agents.voice.edit', 'Edit voice assistant configuration', 'ai_agents', now()),
    ('ai_agents.voice.publish', 'Publish voice assistants to Vapi runtime', 'ai_agents', now()),
    ('ai_agents.voice.call', 'Initiate outbound calls', 'ai_agents', now()),
    ('ai_agents.voice.bind_numbers', 'Connect and manage phone numbers', 'ai_agents', now()),
    ('ai_agents.voice.manage_widgets', 'Create and manage web widgets', 'ai_agents', now()),
    ('ai_agents.voice.tools.manage', 'Manage voice tool registry', 'ai_agents', now())
  ON CONFLICT (key) DO NOTHING;

  SELECT id INTO v_role_id FROM roles WHERE name = 'SuperAdmin' LIMIT 1;
  IF v_role_id IS NOT NULL THEN
    FOR perm_record IN SELECT id FROM permissions WHERE key LIKE 'ai_agents.voice.%' LOOP
      INSERT INTO role_permissions (role_id, permission_id) VALUES (v_role_id, perm_record.id) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  SELECT id INTO v_role_id FROM roles WHERE name = 'Admin' LIMIT 1;
  IF v_role_id IS NOT NULL THEN
    FOR perm_record IN SELECT id FROM permissions WHERE key LIKE 'ai_agents.voice.%' LOOP
      INSERT INTO role_permissions (role_id, permission_id) VALUES (v_role_id, perm_record.id) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  SELECT id INTO v_role_id FROM roles WHERE name = 'Manager' LIMIT 1;
  IF v_role_id IS NOT NULL THEN
    FOR perm_record IN SELECT id FROM permissions WHERE key IN ('ai_agents.voice.view', 'ai_agents.voice.call') LOOP
      INSERT INTO role_permissions (role_id, permission_id) VALUES (v_role_id, perm_record.id) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  SELECT id INTO v_role_id FROM roles WHERE name = 'Team Lead' LIMIT 1;
  IF v_role_id IS NOT NULL THEN
    FOR perm_record IN SELECT id FROM permissions WHERE key = 'ai_agents.voice.view' LOOP
      INSERT INTO role_permissions (role_id, permission_id) VALUES (v_role_id, perm_record.id) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  SELECT id INTO v_role_id FROM roles WHERE name = 'Agent' LIMIT 1;
  IF v_role_id IS NOT NULL THEN
    FOR perm_record IN SELECT id FROM permissions WHERE key = 'ai_agents.voice.view' LOOP
      INSERT INTO role_permissions (role_id, permission_id) VALUES (v_role_id, perm_record.id) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  FOR v_org IN SELECT id FROM organizations LOOP
    INSERT INTO integrations (
      id, org_id, key, name, description, category, icon_url,
      scope, connection_type, api_key_config, enabled, settings_path,
      docs_url, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_org.id, 'vapi', 'Vapi',
      'Voice AI platform for building voice, SMS, and web chat assistants.',
      'AI_LLM', 'https://vapi.ai/favicon.ico', 'global', 'api_key',
      '{"fields":[{"name":"api_key","label":"Vapi API Key","type":"password","required":true,"placeholder":"Enter your Vapi API key"},{"name":"webhook_secret","label":"Webhook Secret","type":"password","required":false,"placeholder":"Optional webhook signing secret"},{"name":"environment","label":"Environment","type":"select","required":false,"options":["production","development","staging"],"default":"production"},{"name":"public_key","label":"Public Key (Widget)","type":"text","required":false,"placeholder":"Vapi public key for web widgets"},{"name":"callback_base_url","label":"Callback Base URL","type":"text","required":false,"placeholder":"https://YOUR-PROJECT.supabase.co/functions/v1"}]}'::jsonb,
      true, '/settings/integrations', 'https://docs.vapi.ai', now(), now()
    ) ON CONFLICT (org_id, key) DO NOTHING;
  END LOOP;
END $$;

INSERT INTO vapi_tool_registry (id, org_id, tool_name, description, input_schema, endpoint_path, active)
VALUES
  (gen_random_uuid(), NULL, 'find_contact', 'Search for a contact by name, email, or phone number',
   '{"type":"object","properties":{"query":{"type":"string","description":"Name, email, or phone to search"},"search_type":{"type":"string","enum":["name","email","phone"],"description":"Field to search"}},"required":["query"]}'::jsonb,
   '/vapi-tool-gateway', true),
  (gen_random_uuid(), NULL, 'create_contact', 'Create a new contact record',
   '{"type":"object","properties":{"first_name":{"type":"string"},"last_name":{"type":"string"},"email":{"type":"string"},"phone":{"type":"string"},"company":{"type":"string"}},"required":["first_name"]}'::jsonb,
   '/vapi-tool-gateway', true),
  (gen_random_uuid(), NULL, 'create_opportunity', 'Create a new sales opportunity',
   '{"type":"object","properties":{"name":{"type":"string","description":"Opportunity name"},"contact_id":{"type":"string","description":"Contact UUID"},"value":{"type":"number","description":"Deal value"},"notes":{"type":"string"}},"required":["name"]}'::jsonb,
   '/vapi-tool-gateway', true),
  (gen_random_uuid(), NULL, 'get_open_slots', 'Check available appointment slots',
   '{"type":"object","properties":{"date":{"type":"string","description":"Date in YYYY-MM-DD format"},"calendar_id":{"type":"string","description":"Calendar UUID"},"duration_minutes":{"type":"integer","default":30}},"required":["date"]}'::jsonb,
   '/vapi-tool-gateway', true),
  (gen_random_uuid(), NULL, 'book_appointment', 'Book an appointment on a calendar',
   '{"type":"object","properties":{"calendar_id":{"type":"string"},"contact_id":{"type":"string"},"start_time":{"type":"string","description":"ISO 8601 datetime"},"duration_minutes":{"type":"integer","default":30},"title":{"type":"string"},"notes":{"type":"string"}},"required":["start_time","title"]}'::jsonb,
   '/vapi-tool-gateway', true),
  (gen_random_uuid(), NULL, 'create_task', 'Create a task or to-do item',
   '{"type":"object","properties":{"title":{"type":"string"},"description":{"type":"string"},"due_date":{"type":"string","description":"ISO 8601 date"},"priority":{"type":"string","enum":["low","medium","high"],"default":"medium"},"assigned_to":{"type":"string"}},"required":["title"]}'::jsonb,
   '/vapi-tool-gateway', true),
  (gen_random_uuid(), NULL, 'send_followup_sms', 'Send a follow-up SMS message to a contact',
   '{"type":"object","properties":{"contact_id":{"type":"string","description":"Contact UUID"},"phone":{"type":"string","description":"Phone number if no contact_id"},"message":{"type":"string","description":"SMS message text"}},"required":["message"]}'::jsonb,
   '/vapi-tool-gateway', true),
  (gen_random_uuid(), NULL, 'send_followup_email', 'Send a follow-up email to a contact',
   '{"type":"object","properties":{"contact_id":{"type":"string","description":"Contact UUID"},"email":{"type":"string","description":"Email address if no contact_id"},"subject":{"type":"string"},"body":{"type":"string"}},"required":["subject","body"]}'::jsonb,
   '/vapi-tool-gateway', true),
  (gen_random_uuid(), NULL, 'transfer_to_human', 'Transfer the current call or session to a human agent',
   '{"type":"object","properties":{"reason":{"type":"string","description":"Reason for transfer"},"department":{"type":"string","description":"Target department"},"urgency":{"type":"string","enum":["low","normal","high"],"default":"normal"}},"required":["reason"]}'::jsonb,
   '/vapi-tool-gateway', true),
  (gen_random_uuid(), NULL, 'lookup_project_status', 'Look up the status of a project',
   '{"type":"object","properties":{"project_id":{"type":"string","description":"Project UUID"},"project_name":{"type":"string","description":"Project name to search"}}}'::jsonb,
   '/vapi-tool-gateway', true),
  (gen_random_uuid(), NULL, 'fetch_invoice_status', 'Check the status of an invoice or payment',
   '{"type":"object","properties":{"invoice_id":{"type":"string","description":"Invoice UUID"},"invoice_number":{"type":"string","description":"Invoice number to search"},"contact_id":{"type":"string","description":"Contact UUID to find invoices for"}}}'::jsonb,
   '/vapi-tool-gateway', true)
ON CONFLICT DO NOTHING;