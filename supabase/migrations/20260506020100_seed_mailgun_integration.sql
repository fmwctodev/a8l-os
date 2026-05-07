/*
  # Seed Mailgun integration in the catalog

  Part of the Mailgun migration. Adds Mailgun as an `integrations` row for every
  existing organization, points the `email_services` module requirement at
  Mailgun (was SendGrid), and updates the `seed_integrations_for_org` helper so
  newly-created organizations get Mailgun by default.

  ## What this migration does

  1. Inserts a `mailgun` integration row for every existing organization.
     Schema fields: api_key, domain, webhook_signing_key, region (default 'us').
  2. Repoints `module_integration_requirements` for `email_services` from
     `sendgrid` to `mailgun`.
  3. Replaces the body of `seed_integrations_for_org(org_id)` so the trigger
     that fires on new-org creation seeds Mailgun (not SendGrid).

  The legacy `sendgrid` integration rows are left in place — orgs may still
  have historical `integration_connections` referencing them. Those rows are
  effectively orphaned and can be cleaned up in a later migration once the
  cutover is verified.
*/

-- 1. Insert mailgun integration for every organization
INSERT INTO integrations (
  org_id, key, name, description, category, scope, connection_type,
  oauth_config, api_key_config, docs_url, settings_path
)
SELECT
  o.id,
  'mailgun',
  'Mailgun',
  'Email delivery service for transactional and marketing emails.',
  'Email',
  'global',
  'api_key',
  NULL,
  '{"fields": [
    {"name": "api_key", "label": "API Key", "required": true, "secret": true},
    {"name": "domain", "label": "Sending Domain", "required": true, "secret": false},
    {"name": "webhook_signing_key", "label": "Webhook Signing Key", "required": false, "secret": true},
    {"name": "region", "label": "Region", "required": false, "secret": false, "default": "us"}
  ]}'::jsonb,
  'https://documentation.mailgun.com/',
  '/settings/email-services'
FROM organizations o
ON CONFLICT (org_id, key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  scope = EXCLUDED.scope,
  connection_type = EXCLUDED.connection_type,
  api_key_config = EXCLUDED.api_key_config,
  docs_url = EXCLUDED.docs_url,
  settings_path = EXCLUDED.settings_path;

-- 2. Repoint module_integration_requirements: email_services -> mailgun
-- Delete the sendgrid requirement (UNIQUE prevents direct UPDATE if mailgun row already exists)
UPDATE module_integration_requirements
SET integration_key = 'mailgun',
    feature_description = 'Email delivery and domain verification (Mailgun)'
WHERE module_key = 'email_services'
  AND integration_key = 'sendgrid'
  AND NOT EXISTS (
    SELECT 1 FROM module_integration_requirements m2
    WHERE m2.org_id = module_integration_requirements.org_id
      AND m2.module_key = 'email_services'
      AND m2.integration_key = 'mailgun'
  );

-- For any orgs where a mailgun row already exists alongside sendgrid (e.g. partial re-runs), drop the sendgrid row.
DELETE FROM module_integration_requirements mir
WHERE mir.module_key = 'email_services'
  AND mir.integration_key = 'sendgrid'
  AND EXISTS (
    SELECT 1 FROM module_integration_requirements m2
    WHERE m2.org_id = mir.org_id
      AND m2.module_key = 'email_services'
      AND m2.integration_key = 'mailgun'
  );

-- 3. Replace seed_integrations_for_org so new orgs get Mailgun (not SendGrid)
CREATE OR REPLACE FUNCTION seed_integrations_for_org(target_org_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO integrations (org_id, key, name, description, category, scope, connection_type, oauth_config, api_key_config, docs_url, settings_path)
  VALUES
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
    (
      target_org_id,
      'mailgun',
      'Mailgun',
      'Email delivery service for transactional and marketing emails.',
      'Email',
      'global',
      'api_key',
      NULL,
      '{"fields": [{"name": "api_key", "label": "API Key", "required": true, "secret": true}, {"name": "domain", "label": "Sending Domain", "required": true, "secret": false}, {"name": "webhook_signing_key", "label": "Webhook Signing Key", "required": false, "secret": true}, {"name": "region", "label": "Region", "required": false, "secret": false, "default": "us"}]}'::jsonb,
      'https://documentation.mailgun.com/',
      '/settings/email-services'
    ),
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

  INSERT INTO module_integration_requirements (org_id, module_key, integration_key, is_required, feature_description)
  VALUES
    (target_org_id, 'phone_system', 'twilio', true, 'Voice calling and SMS messaging'),
    (target_org_id, 'email_services', 'mailgun', true, 'Email delivery and domain verification (Mailgun)'),
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
