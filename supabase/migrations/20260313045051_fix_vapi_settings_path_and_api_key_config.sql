/*
  # Fix Vapi integration settings path and API key config

  1. Changes
    - Clear `settings_path` for Vapi integration so clicking it opens the connection detail panel
      instead of redirecting back to the integrations page
    - Update `api_key_config` field definitions to include `secret` boolean flag for proper
      password masking in the UI

  2. Affected Tables
    - `integrations` (update row where key = 'vapi')
*/

UPDATE integrations
SET
  settings_path = NULL,
  api_key_config = jsonb_build_object(
    'fields', jsonb_build_array(
      jsonb_build_object(
        'name', 'api_key',
        'label', 'Vapi API Key',
        'type', 'password',
        'required', true,
        'secret', true,
        'placeholder', 'Enter your Vapi private API key'
      ),
      jsonb_build_object(
        'name', 'public_key',
        'label', 'Public Key (Widget)',
        'type', 'text',
        'required', false,
        'secret', false,
        'placeholder', 'Vapi public key for web widgets'
      ),
      jsonb_build_object(
        'name', 'webhook_secret',
        'label', 'Webhook Secret',
        'type', 'password',
        'required', false,
        'secret', true,
        'placeholder', 'Optional webhook signing secret'
      ),
      jsonb_build_object(
        'name', 'environment',
        'label', 'Environment',
        'type', 'select',
        'required', false,
        'secret', false,
        'default', 'production',
        'options', '["production","development","staging"]'::jsonb
      )
    )
  )
WHERE key = 'vapi';
