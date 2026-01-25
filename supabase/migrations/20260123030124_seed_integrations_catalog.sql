/*
  # Seed Integration Catalog

  1. Overview
    Seeds the integration catalog with supported third-party integrations.
    Each integration is linked to the default organization.

  2. Integrations Added
    - Google Workspace (Storage) - OAuth
    - Google Calendar (Calendars) - OAuth, user-scoped
    - Twilio (Phone) - API Key
    - SendGrid (Email) - API Key
    - QuickBooks Online (Payments) - OAuth
    - OpenAI (AI_LLM) - API Key
    - ElevenLabs (AI_LLM) - API Key
    - Meta Ads (Advertising) - OAuth
    - Google Ads (Advertising) - OAuth
    - Zapier (CRM_Data) - OAuth
    - Generic Webhooks (CRM_Data) - Webhook

  3. Module Requirements
    Seeds the module_integration_requirements table to show which
    modules depend on which integrations.
*/

-- Seed integrations for the default organization
INSERT INTO integrations (org_id, key, name, description, category, scope, connection_type, oauth_config, api_key_config, docs_url, settings_path)
SELECT 
  o.id,
  int.key,
  int.name,
  int.description,
  int.category,
  int.scope,
  int.connection_type,
  int.oauth_config::jsonb,
  int.api_key_config::jsonb,
  int.docs_url,
  int.settings_path
FROM organizations o
CROSS JOIN (
  VALUES 
    (
      'google_workspace',
      'Google Workspace',
      'Connect Google Drive for file storage, document management, and team collaboration.',
      'Storage',
      'global',
      'oauth',
      '{"scopes": ["https://www.googleapis.com/auth/drive"], "auth_url": "https://accounts.google.com/o/oauth2/v2/auth", "token_url": "https://oauth2.googleapis.com/token"}',
      NULL,
      'https://developers.google.com/workspace',
      NULL
    ),
    (
      'google_calendar',
      'Google Calendar',
      'Sync personal calendar for appointment scheduling and availability management.',
      'Calendars',
      'user',
      'oauth',
      '{"scopes": ["https://www.googleapis.com/auth/calendar"], "auth_url": "https://accounts.google.com/o/oauth2/v2/auth", "token_url": "https://oauth2.googleapis.com/token"}',
      NULL,
      'https://developers.google.com/calendar',
      '/settings/calendars'
    ),
    (
      'twilio',
      'Twilio',
      'Voice calling, SMS messaging, and phone number management for communications.',
      'Phone',
      'global',
      'api_key',
      NULL,
      '{"fields": [{"name": "account_sid", "label": "Account SID", "required": true}, {"name": "auth_token", "label": "Auth Token", "required": true, "secret": true}]}',
      'https://www.twilio.com/docs',
      '/settings/phone-system'
    ),
    (
      'sendgrid',
      'SendGrid',
      'Email delivery service for transactional and marketing emails.',
      'Email',
      'global',
      'api_key',
      NULL,
      '{"fields": [{"name": "api_key", "label": "API Key", "required": true, "secret": true}]}',
      'https://docs.sendgrid.com',
      '/settings/email-services'
    ),
    (
      'quickbooks_online',
      'QuickBooks Online',
      'Accounting integration for invoicing, payments, and financial data sync.',
      'Payments',
      'global',
      'oauth',
      '{"scopes": ["com.intuit.quickbooks.accounting"], "auth_url": "https://appcenter.intuit.com/connect/oauth2", "token_url": "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"}',
      NULL,
      'https://developer.intuit.com/app/developer/qbo/docs',
      NULL
    ),
    (
      'openai',
      'OpenAI',
      'AI language models for chat, content generation, and intelligent automation.',
      'AI_LLM',
      'global',
      'api_key',
      NULL,
      '{"fields": [{"name": "api_key", "label": "API Key", "required": true, "secret": true}]}',
      'https://platform.openai.com/docs',
      '/settings/ai-agents'
    ),
    (
      'anthropic',
      'Anthropic',
      'Claude AI models for advanced reasoning and content generation.',
      'AI_LLM',
      'global',
      'api_key',
      NULL,
      '{"fields": [{"name": "api_key", "label": "API Key", "required": true, "secret": true}]}',
      'https://docs.anthropic.com',
      '/settings/ai-agents'
    ),
    (
      'elevenlabs',
      'ElevenLabs',
      'AI voice synthesis for realistic text-to-speech and voice cloning.',
      'AI_LLM',
      'global',
      'api_key',
      NULL,
      '{"fields": [{"name": "api_key", "label": "API Key", "required": true, "secret": true}]}',
      'https://docs.elevenlabs.io',
      '/settings/ai-agents'
    ),
    (
      'meta_ads',
      'Meta Ads',
      'Facebook and Instagram advertising platform for campaign management.',
      'Advertising',
      'global',
      'oauth',
      '{"scopes": ["ads_management", "ads_read"], "auth_url": "https://www.facebook.com/v18.0/dialog/oauth", "token_url": "https://graph.facebook.com/v18.0/oauth/access_token"}',
      NULL,
      'https://developers.facebook.com/docs/marketing-apis',
      NULL
    ),
    (
      'google_ads',
      'Google Ads',
      'Google advertising platform for search, display, and video campaigns.',
      'Advertising',
      'global',
      'oauth',
      '{"scopes": ["https://www.googleapis.com/auth/adwords"], "auth_url": "https://accounts.google.com/o/oauth2/v2/auth", "token_url": "https://oauth2.googleapis.com/token"}',
      NULL,
      'https://developers.google.com/google-ads/api/docs',
      NULL
    ),
    (
      'zapier',
      'Zapier',
      'Automation platform to connect with thousands of apps and services.',
      'CRM_Data',
      'global',
      'oauth',
      '{"scopes": [], "auth_url": "https://zapier.com/oauth/authorize", "token_url": "https://zapier.com/oauth/token"}',
      NULL,
      'https://zapier.com/platform',
      NULL
    ),
    (
      'slack',
      'Slack',
      'Team communication platform for notifications and workflow alerts.',
      'CRM_Data',
      'global',
      'oauth',
      '{"scopes": ["chat:write", "channels:read"], "auth_url": "https://slack.com/oauth/v2/authorize", "token_url": "https://slack.com/api/oauth.v2.access"}',
      NULL,
      'https://api.slack.com/docs',
      NULL
    )
) AS int(key, name, description, category, scope, connection_type, oauth_config, api_key_config, docs_url, settings_path)
WHERE o.name = 'Default Organization'
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
SELECT 
  o.id,
  req.module_key,
  req.integration_key,
  req.is_required,
  req.feature_description
FROM organizations o
CROSS JOIN (
  VALUES 
    ('phone_system', 'twilio', true, 'Voice calling and SMS messaging'),
    ('email_services', 'sendgrid', true, 'Email delivery and domain verification'),
    ('ai_agents', 'openai', false, 'GPT models for AI conversations'),
    ('ai_agents', 'anthropic', false, 'Claude models for AI conversations'),
    ('ai_agents', 'elevenlabs', false, 'Voice synthesis for AI agents'),
    ('calendars', 'google_calendar', false, 'Calendar sync and availability'),
    ('media_storage', 'google_workspace', false, 'Google Drive file storage'),
    ('payments', 'quickbooks_online', false, 'QuickBooks invoice sync'),
    ('automation', 'zapier', false, 'Third-party app automation'),
    ('automation', 'slack', false, 'Slack notifications'),
    ('marketing', 'meta_ads', false, 'Facebook/Instagram ad management'),
    ('marketing', 'google_ads', false, 'Google ad management')
) AS req(module_key, integration_key, is_required, feature_description)
WHERE o.name = 'Default Organization'
ON CONFLICT (org_id, module_key, integration_key) DO UPDATE SET
  is_required = EXCLUDED.is_required,
  feature_description = EXCLUDED.feature_description;
