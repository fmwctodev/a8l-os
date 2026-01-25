/*
  # Seed Integrations for All Organizations

  1. Overview
    This migration ensures all organizations have access to the full integration catalog,
    not just the "Default Organization". It also adds the "Channels" category to the
    category constraint.

  2. Changes
    - Adds "Channels" to the integrations category check constraint
    - Creates a reusable function `seed_integrations_for_org(org_id uuid)` that can be
      called to populate default integrations for any organization
    - Seeds integrations for ALL existing organizations
    - Creates a trigger to automatically seed integrations when new organizations are created

  3. Integrations Seeded
    - Gmail (Channels) - OAuth
    - Webchat (Channels) - Built-in
    - Twilio (Channels) - API Key
    - SendGrid (Email) - API Key
    - Google Workspace (Storage) - OAuth
    - Google Calendar (Calendars) - OAuth, user-scoped
    - QuickBooks Online (Payments) - OAuth
    - OpenAI (AI_LLM) - API Key
    - Anthropic (AI_LLM) - API Key
    - ElevenLabs (AI_LLM) - API Key
    - Meta Ads (Advertising) - OAuth
    - Google Ads (Advertising) - OAuth
    - Zapier (CRM_Data) - OAuth
    - Slack (CRM_Data) - OAuth

  4. Security
    - Function runs with SECURITY DEFINER to allow inserting for any org
    - Trigger ensures new orgs automatically get seeded
*/

-- Step 1: Update the category constraint to include 'Channels'
ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_category_check;
ALTER TABLE integrations ADD CONSTRAINT integrations_category_check 
  CHECK (category IN ('Advertising', 'CRM_Data', 'Calendars', 'Channels', 'Email', 'Phone', 'Payments', 'Storage', 'AI_LLM', 'Other'));

-- Step 2: Create the reusable seeding function
CREATE OR REPLACE FUNCTION seed_integrations_for_org(target_org_id uuid)
RETURNS void AS $$
BEGIN
  -- Insert all integrations for the target organization
  INSERT INTO integrations (org_id, key, name, description, category, scope, connection_type, oauth_config, api_key_config, docs_url, settings_path)
  VALUES
    -- Gmail (Channels)
    (
      target_org_id,
      'gmail',
      'Gmail',
      'Email sync for conversations using organization-level OAuth credentials.',
      'Channels',
      'global',
      'oauth',
      '{"scopes": ["https://www.googleapis.com/auth/gmail.send", "https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.modify", "https://www.googleapis.com/auth/userinfo.email"], "auth_url": "https://accounts.google.com/o/oauth2/v2/auth", "token_url": "https://oauth2.googleapis.com/token"}'::jsonb,
      NULL,
      'https://developers.google.com/gmail/api',
      '/settings/integrations?tab=connected'
    ),
    -- Webchat (Channels)
    (
      target_org_id,
      'webchat',
      'Webchat',
      'Embeddable chat widget for website visitor conversations. No external service required.',
      'Channels',
      'global',
      'webhook',
      NULL,
      NULL,
      NULL,
      '/settings/integrations?tab=connected'
    ),
    -- Twilio (Channels)
    (
      target_org_id,
      'twilio',
      'Twilio',
      'Voice calling, SMS messaging, and phone number management for communications.',
      'Channels',
      'global',
      'api_key',
      NULL,
      '{"fields": [{"name": "account_sid", "label": "Account SID", "required": true}, {"name": "auth_token", "label": "Auth Token", "required": true, "secret": true}]}'::jsonb,
      'https://www.twilio.com/docs',
      '/settings/phone-system'
    ),
    -- SendGrid (Email)
    (
      target_org_id,
      'sendgrid',
      'SendGrid',
      'Email delivery service for transactional and marketing emails.',
      'Email',
      'global',
      'api_key',
      NULL,
      '{"fields": [{"name": "api_key", "label": "API Key", "required": true, "secret": true}]}'::jsonb,
      'https://docs.sendgrid.com',
      '/settings/email-services'
    ),
    -- Google Workspace (Storage)
    (
      target_org_id,
      'google_workspace',
      'Google Workspace',
      'Connect Google Drive for file storage, document management, and team collaboration.',
      'Storage',
      'global',
      'oauth',
      '{"scopes": ["https://www.googleapis.com/auth/drive"], "auth_url": "https://accounts.google.com/o/oauth2/v2/auth", "token_url": "https://oauth2.googleapis.com/token"}'::jsonb,
      NULL,
      'https://developers.google.com/workspace',
      NULL
    ),
    -- Google Calendar (Calendars)
    (
      target_org_id,
      'google_calendar',
      'Google Calendar',
      'Sync personal calendar for appointment scheduling and availability management.',
      'Calendars',
      'user',
      'oauth',
      '{"scopes": ["https://www.googleapis.com/auth/calendar"], "auth_url": "https://accounts.google.com/o/oauth2/v2/auth", "token_url": "https://oauth2.googleapis.com/token"}'::jsonb,
      NULL,
      'https://developers.google.com/calendar',
      '/settings/calendars'
    ),
    -- QuickBooks Online (Payments)
    (
      target_org_id,
      'quickbooks_online',
      'QuickBooks Online',
      'Accounting integration for invoicing, payments, and financial data sync.',
      'Payments',
      'global',
      'oauth',
      '{"scopes": ["com.intuit.quickbooks.accounting"], "auth_url": "https://appcenter.intuit.com/connect/oauth2", "token_url": "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"}'::jsonb,
      NULL,
      'https://developer.intuit.com/app/developer/qbo/docs',
      NULL
    ),
    -- OpenAI (AI_LLM)
    (
      target_org_id,
      'openai',
      'OpenAI',
      'AI language models for chat, content generation, and intelligent automation.',
      'AI_LLM',
      'global',
      'api_key',
      NULL,
      '{"fields": [{"name": "api_key", "label": "API Key", "required": true, "secret": true}]}'::jsonb,
      'https://platform.openai.com/docs',
      '/settings/ai-agents'
    ),
    -- Anthropic (AI_LLM)
    (
      target_org_id,
      'anthropic',
      'Anthropic',
      'Claude AI models for advanced reasoning and content generation.',
      'AI_LLM',
      'global',
      'api_key',
      NULL,
      '{"fields": [{"name": "api_key", "label": "API Key", "required": true, "secret": true}]}'::jsonb,
      'https://docs.anthropic.com',
      '/settings/ai-agents'
    ),
    -- ElevenLabs (AI_LLM)
    (
      target_org_id,
      'elevenlabs',
      'ElevenLabs',
      'AI voice synthesis for realistic text-to-speech and voice cloning.',
      'AI_LLM',
      'global',
      'api_key',
      NULL,
      '{"fields": [{"name": "api_key", "label": "API Key", "required": true, "secret": true}]}'::jsonb,
      'https://docs.elevenlabs.io',
      '/settings/ai-agents'
    ),
    -- Meta Ads (Advertising)
    (
      target_org_id,
      'meta_ads',
      'Meta Ads',
      'Facebook and Instagram advertising platform for campaign management.',
      'Advertising',
      'global',
      'oauth',
      '{"scopes": ["ads_management", "ads_read"], "auth_url": "https://www.facebook.com/v18.0/dialog/oauth", "token_url": "https://graph.facebook.com/v18.0/oauth/access_token"}'::jsonb,
      NULL,
      'https://developers.facebook.com/docs/marketing-apis',
      NULL
    ),
    -- Google Ads (Advertising)
    (
      target_org_id,
      'google_ads',
      'Google Ads',
      'Google advertising platform for search, display, and video campaigns.',
      'Advertising',
      'global',
      'oauth',
      '{"scopes": ["https://www.googleapis.com/auth/adwords"], "auth_url": "https://accounts.google.com/o/oauth2/v2/auth", "token_url": "https://oauth2.googleapis.com/token"}'::jsonb,
      NULL,
      'https://developers.google.com/google-ads/api/docs',
      NULL
    ),
    -- Zapier (CRM_Data)
    (
      target_org_id,
      'zapier',
      'Zapier',
      'Automation platform to connect with thousands of apps and services.',
      'CRM_Data',
      'global',
      'oauth',
      '{"scopes": [], "auth_url": "https://zapier.com/oauth/authorize", "token_url": "https://zapier.com/oauth/token"}'::jsonb,
      NULL,
      'https://zapier.com/platform',
      NULL
    ),
    -- Slack (CRM_Data)
    (
      target_org_id,
      'slack',
      'Slack',
      'Team communication platform for notifications and workflow alerts.',
      'CRM_Data',
      'global',
      'oauth',
      '{"scopes": ["chat:write", "channels:read"], "auth_url": "https://slack.com/oauth/v2/authorize", "token_url": "https://slack.com/api/oauth.v2.access"}'::jsonb,
      NULL,
      'https://api.slack.com/docs',
      NULL
    )
  ON CONFLICT (org_id, key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    scope = EXCLUDED.scope,
    connection_type = EXCLUDED.connection_type,
    oauth_config = EXCLUDED.oauth_config,
    api_key_config = EXCLUDED.api_key_config,
    docs_url = EXCLUDED.docs_url,
    settings_path = EXCLUDED.settings_path;

  -- Seed module integration requirements
  INSERT INTO module_integration_requirements (org_id, module_key, integration_key, is_required, feature_description)
  VALUES
    (target_org_id, 'phone_system', 'twilio', true, 'Voice calling and SMS messaging'),
    (target_org_id, 'email_services', 'sendgrid', true, 'Email delivery and domain verification'),
    (target_org_id, 'ai_agents', 'openai', false, 'GPT models for AI conversations'),
    (target_org_id, 'ai_agents', 'anthropic', false, 'Claude models for AI conversations'),
    (target_org_id, 'ai_agents', 'elevenlabs', false, 'Voice synthesis for AI agents'),
    (target_org_id, 'calendars', 'google_calendar', false, 'Calendar sync and availability'),
    (target_org_id, 'media_storage', 'google_workspace', false, 'Google Drive file storage'),
    (target_org_id, 'payments', 'quickbooks_online', false, 'QuickBooks invoice sync'),
    (target_org_id, 'automation', 'zapier', false, 'Third-party app automation'),
    (target_org_id, 'automation', 'slack', false, 'Slack notifications'),
    (target_org_id, 'marketing', 'meta_ads', false, 'Facebook/Instagram ad management'),
    (target_org_id, 'marketing', 'google_ads', false, 'Google ad management'),
    (target_org_id, 'conversations', 'gmail', false, 'Gmail email sync for unified inbox')
  ON CONFLICT (org_id, module_key, integration_key) DO UPDATE SET
    is_required = EXCLUDED.is_required,
    feature_description = EXCLUDED.feature_description;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Seed integrations for ALL existing organizations
DO $$
DECLARE
  org_record RECORD;
BEGIN
  FOR org_record IN SELECT id FROM organizations LOOP
    PERFORM seed_integrations_for_org(org_record.id);
  END LOOP;
END $$;

-- Step 4: Create trigger to auto-seed integrations for new organizations
CREATE OR REPLACE FUNCTION trigger_seed_integrations_for_new_org()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM seed_integrations_for_org(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS seed_integrations_on_org_create ON organizations;
CREATE TRIGGER seed_integrations_on_org_create
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION trigger_seed_integrations_for_new_org();
