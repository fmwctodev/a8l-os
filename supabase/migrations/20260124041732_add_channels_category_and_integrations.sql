/*
  # Add Communication Channels Category and Integrations

  1. Overview
    This migration adds the Communication Channels category and populates it with:
    - Gmail (organization-level OAuth for email sync)
    - Webchat (built-in chat widget)
    - Moves Twilio from Phone to Channels category

  2. New Integrations Added
    - Gmail (Channels) - OAuth, organization-scoped
      Purpose: Email sync for conversations using organization-level OAuth credentials
    - Webchat (Channels) - Built-in, organization-scoped
      Purpose: Embeddable chat widget for website visitor conversations

  3. Modified Integrations
    - Twilio: Category changed from 'Phone' to 'Channels'

  4. Module Integration Requirements
    - Gmail linked to conversations module for email sync functionality
*/

-- Add Gmail integration to the catalog
INSERT INTO integrations (org_id, key, name, description, category, scope, connection_type, oauth_config, api_key_config, docs_url, settings_path)
SELECT 
  o.id,
  'gmail',
  'Gmail',
  'Email sync for conversations using organization-level OAuth credentials.',
  'Channels',
  'global',
  'oauth',
  '{"scopes": ["https://www.googleapis.com/auth/gmail.send", "https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.modify", "https://www.googleapis.com/auth/userinfo.email"], "auth_url": "https://accounts.google.com/o/oauth2/v2/auth", "token_url": "https://oauth2.googleapis.com/token"}'::jsonb,
  NULL,
  'https://developers.google.com/gmail/api',
  '/settings/integrations?tab=channels'
FROM organizations o
WHERE o.name = 'Default Organization'
ON CONFLICT (org_id, key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  scope = EXCLUDED.scope,
  connection_type = EXCLUDED.connection_type,
  oauth_config = EXCLUDED.oauth_config,
  docs_url = EXCLUDED.docs_url,
  settings_path = EXCLUDED.settings_path;

-- Add Webchat integration to the catalog
INSERT INTO integrations (org_id, key, name, description, category, scope, connection_type, oauth_config, api_key_config, docs_url, settings_path)
SELECT 
  o.id,
  'webchat',
  'Webchat',
  'Embeddable chat widget for website visitor conversations. No external service required.',
  'Channels',
  'global',
  'webhook',
  NULL,
  NULL,
  NULL,
  '/settings/integrations?tab=channels'
FROM organizations o
WHERE o.name = 'Default Organization'
ON CONFLICT (org_id, key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  scope = EXCLUDED.scope,
  connection_type = EXCLUDED.connection_type,
  docs_url = EXCLUDED.docs_url,
  settings_path = EXCLUDED.settings_path;

-- Update Twilio to Channels category
UPDATE integrations 
SET category = 'Channels'
WHERE key = 'twilio';

-- Add module integration requirement for Gmail -> Conversations
INSERT INTO module_integration_requirements (org_id, module_key, integration_key, is_required, feature_description)
SELECT 
  o.id,
  'conversations',
  'gmail',
  false,
  'Gmail email sync for unified inbox'
FROM organizations o
WHERE o.name = 'Default Organization'
ON CONFLICT (org_id, module_key, integration_key) DO UPDATE SET
  is_required = EXCLUDED.is_required,
  feature_description = EXCLUDED.feature_description;
