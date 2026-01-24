/*
  # Email Campaign Domains and Warm-Up Schema

  This migration creates the infrastructure for managing campaign (marketing) email domains
  separately from transactional domains, with automated warm-up tracking and AI recommendations.

  ## 1. New Tables

  ### email_campaign_domains
  - `id` (uuid, primary key) - Unique identifier
  - `organization_id` (uuid, FK) - Organization this domain belongs to
  - `domain` (text) - The domain name (e.g., mail.example.com)
  - `friendly_label` (text) - User-friendly name for the domain
  - `sendgrid_domain_id` (text) - SendGrid's domain identifier
  - `status` (enum) - Current status of the domain
  - `warmup_progress_percent` (integer) - Progress through warm-up (0-100)
  - `current_daily_limit` (integer) - Current daily send limit during warm-up
  - `target_daily_volume` (integer) - Target daily volume after warm-up
  - `warmup_started_at` (timestamptz) - When warm-up began
  - `warmup_completed_at` (timestamptz) - When warm-up finished
  - `last_synced_at` (timestamptz) - Last time stats were synced from SendGrid
  - `dns_records` (jsonb) - DNS records for domain verification
  - `created_at`, `updated_at` (timestamptz) - Timestamps

  ### email_warmup_config
  - `id` (uuid, primary key) - Unique identifier
  - `campaign_domain_id` (uuid, FK, unique) - One config per domain
  - `start_daily_volume` (integer) - Starting daily volume (default 25)
  - `ramp_duration_days` (integer) - Days to complete warm-up (default 21)
  - `daily_increase_type` (text) - 'linear' or 'smart'
  - `pause_on_bounce_spike` (boolean) - Auto-pause if bounce rate spikes
  - `pause_on_spam_complaints` (boolean) - Auto-pause on spam complaints
  - `auto_throttle_low_engagement` (boolean) - Reduce volume on low engagement
  - `ai_recommendations_enabled` (boolean) - Enable AI-powered recommendations
  - `created_at`, `updated_at` (timestamptz) - Timestamps

  ### email_warmup_daily_stats
  - `id` (uuid, primary key) - Unique identifier
  - `campaign_domain_id` (uuid, FK) - Domain these stats belong to
  - `date` (date) - The date for these statistics
  - `emails_sent` (integer) - Number of emails sent
  - `emails_delivered` (integer) - Number successfully delivered
  - `bounces` (integer) - Number of bounces
  - `spam_complaints` (integer) - Number of spam complaints
  - `opens` (integer) - Number of opens
  - `clicks` (integer) - Number of clicks
  - `synced_at` (timestamptz) - When this data was synced

  ### email_campaign_domain_events
  - `id` (uuid, primary key) - Unique identifier
  - `campaign_domain_id` (uuid, FK) - Domain this event relates to
  - `event_type` (text) - Type of event
  - `actor_type` (text) - 'user', 'system', or 'ai'
  - `actor_id` (uuid) - User ID if actor is user
  - `reason` (text) - Reason for the event
  - `ai_recommendation_text` (text) - AI reasoning if applicable
  - `metadata` (jsonb) - Additional event data
  - `created_at` (timestamptz) - When event occurred

  ### email_warmup_ai_recommendations
  - `id` (uuid, primary key) - Unique identifier
  - `campaign_domain_id` (uuid, FK) - Domain this recommendation is for
  - `recommendation_type` (text) - 'slow_down', 'speed_up', 'pause', 'resume'
  - `reason` (text) - Human-readable explanation
  - `confidence_score` (decimal) - AI confidence (0-1)
  - `acknowledged_at` (timestamptz) - When user acknowledged
  - `applied_at` (timestamptz) - When recommendation was applied
  - `dismissed_at` (timestamptz) - When recommendation was dismissed
  - `created_at` (timestamptz) - When created

  ## 2. Security
  - RLS enabled on all tables
  - Policies restrict access to org members only
  - Management actions require appropriate permissions

  ## 3. Indexes
  - Index on organization_id for filtering
  - Index on status for quick status queries
  - Composite index on domain_id + date for stats lookups
*/

CREATE TYPE email_campaign_domain_status AS ENUM (
  'not_configured',
  'pending_verification',
  'verified',
  'warming_up',
  'warmed',
  'degraded',
  'paused'
);

CREATE TABLE IF NOT EXISTS email_campaign_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  domain text NOT NULL,
  friendly_label text,
  sendgrid_domain_id text,
  status email_campaign_domain_status NOT NULL DEFAULT 'not_configured',
  warmup_progress_percent integer NOT NULL DEFAULT 0 CHECK (warmup_progress_percent >= 0 AND warmup_progress_percent <= 100),
  current_daily_limit integer NOT NULL DEFAULT 0,
  target_daily_volume integer NOT NULL DEFAULT 10000,
  warmup_started_at timestamptz,
  warmup_completed_at timestamptz,
  last_synced_at timestamptz,
  dns_records jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, domain)
);

CREATE TABLE IF NOT EXISTS email_warmup_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_domain_id uuid NOT NULL REFERENCES email_campaign_domains(id) ON DELETE CASCADE UNIQUE,
  start_daily_volume integer NOT NULL DEFAULT 25 CHECK (start_daily_volume > 0),
  ramp_duration_days integer NOT NULL DEFAULT 21 CHECK (ramp_duration_days > 0),
  daily_increase_type text NOT NULL DEFAULT 'linear' CHECK (daily_increase_type IN ('linear', 'smart')),
  pause_on_bounce_spike boolean NOT NULL DEFAULT true,
  pause_on_spam_complaints boolean NOT NULL DEFAULT true,
  auto_throttle_low_engagement boolean NOT NULL DEFAULT false,
  ai_recommendations_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_warmup_daily_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_domain_id uuid NOT NULL REFERENCES email_campaign_domains(id) ON DELETE CASCADE,
  date date NOT NULL,
  emails_sent integer NOT NULL DEFAULT 0,
  emails_delivered integer NOT NULL DEFAULT 0,
  bounces integer NOT NULL DEFAULT 0,
  spam_complaints integer NOT NULL DEFAULT 0,
  opens integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_domain_id, date)
);

CREATE TABLE IF NOT EXISTS email_campaign_domain_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_domain_id uuid NOT NULL REFERENCES email_campaign_domains(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'created', 'dns_verified', 'warmup_started', 'warmup_paused', 
    'warmup_resumed', 'warmup_completed', 'status_changed', 
    'auto_paused', 'ai_recommendation_applied', 'deleted'
  )),
  actor_type text NOT NULL CHECK (actor_type IN ('user', 'system', 'ai')),
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  reason text,
  ai_recommendation_text text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_warmup_ai_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_domain_id uuid NOT NULL REFERENCES email_campaign_domains(id) ON DELETE CASCADE,
  recommendation_type text NOT NULL CHECK (recommendation_type IN ('slow_down', 'speed_up', 'pause', 'resume')),
  reason text NOT NULL,
  confidence_score decimal(3,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  acknowledged_at timestamptz,
  applied_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_campaign_domains_org_id 
  ON email_campaign_domains(organization_id);

CREATE INDEX IF NOT EXISTS idx_email_campaign_domains_status 
  ON email_campaign_domains(status);

CREATE INDEX IF NOT EXISTS idx_email_warmup_daily_stats_domain_date 
  ON email_warmup_daily_stats(campaign_domain_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_email_campaign_domain_events_domain_id 
  ON email_campaign_domain_events(campaign_domain_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_warmup_ai_recommendations_domain_pending 
  ON email_warmup_ai_recommendations(campaign_domain_id) 
  WHERE applied_at IS NULL AND dismissed_at IS NULL;

ALTER TABLE email_campaign_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_warmup_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_warmup_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaign_domain_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_warmup_ai_recommendations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION user_belongs_to_org(org_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND organization_id = org_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "Users can view campaign domains in their org"
  ON email_campaign_domains FOR SELECT
  TO authenticated
  USING (user_belongs_to_org(organization_id));

CREATE POLICY "Users with email.settings.manage can insert campaign domains"
  ON email_campaign_domains FOR INSERT
  TO authenticated
  WITH CHECK (
    user_belongs_to_org(organization_id) AND
    EXISTS (
      SELECT 1 FROM users u
      JOIN role_permissions rp ON rp.role_id = u.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE u.id = auth.uid() AND p.key = 'email.settings.manage'
    )
  );

CREATE POLICY "Users with email.settings.manage can update campaign domains"
  ON email_campaign_domains FOR UPDATE
  TO authenticated
  USING (
    user_belongs_to_org(organization_id) AND
    EXISTS (
      SELECT 1 FROM users u
      JOIN role_permissions rp ON rp.role_id = u.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE u.id = auth.uid() AND p.key = 'email.settings.manage'
    )
  )
  WITH CHECK (
    user_belongs_to_org(organization_id) AND
    EXISTS (
      SELECT 1 FROM users u
      JOIN role_permissions rp ON rp.role_id = u.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE u.id = auth.uid() AND p.key = 'email.settings.manage'
    )
  );

CREATE POLICY "Users with email.settings.manage can delete campaign domains"
  ON email_campaign_domains FOR DELETE
  TO authenticated
  USING (
    user_belongs_to_org(organization_id) AND
    EXISTS (
      SELECT 1 FROM users u
      JOIN role_permissions rp ON rp.role_id = u.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE u.id = auth.uid() AND p.key = 'email.settings.manage'
    )
  );

CREATE POLICY "Users can view warmup config for domains in their org"
  ON email_warmup_config FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM email_campaign_domains d
      WHERE d.id = campaign_domain_id
      AND user_belongs_to_org(d.organization_id)
    )
  );

CREATE POLICY "Users with email.settings.manage can manage warmup config"
  ON email_warmup_config FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM email_campaign_domains d
      JOIN users u ON u.organization_id = d.organization_id
      JOIN role_permissions rp ON rp.role_id = u.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE d.id = campaign_domain_id
      AND u.id = auth.uid()
      AND p.key = 'email.settings.manage'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM email_campaign_domains d
      JOIN users u ON u.organization_id = d.organization_id
      JOIN role_permissions rp ON rp.role_id = u.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE d.id = campaign_domain_id
      AND u.id = auth.uid()
      AND p.key = 'email.settings.manage'
    )
  );

CREATE POLICY "Users can view warmup stats for domains in their org"
  ON email_warmup_daily_stats FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM email_campaign_domains d
      WHERE d.id = campaign_domain_id
      AND user_belongs_to_org(d.organization_id)
    )
  );

CREATE POLICY "Users with email.settings.manage can manage warmup stats"
  ON email_warmup_daily_stats FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM email_campaign_domains d
      JOIN users u ON u.organization_id = d.organization_id
      JOIN role_permissions rp ON rp.role_id = u.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE d.id = campaign_domain_id
      AND u.id = auth.uid()
      AND p.key = 'email.settings.manage'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM email_campaign_domains d
      JOIN users u ON u.organization_id = d.organization_id
      JOIN role_permissions rp ON rp.role_id = u.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE d.id = campaign_domain_id
      AND u.id = auth.uid()
      AND p.key = 'email.settings.manage'
    )
  );

CREATE POLICY "Users can view domain events for domains in their org"
  ON email_campaign_domain_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM email_campaign_domains d
      WHERE d.id = campaign_domain_id
      AND user_belongs_to_org(d.organization_id)
    )
  );

CREATE POLICY "Users with email.settings.manage can insert domain events"
  ON email_campaign_domain_events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM email_campaign_domains d
      JOIN users u ON u.organization_id = d.organization_id
      JOIN role_permissions rp ON rp.role_id = u.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE d.id = campaign_domain_id
      AND u.id = auth.uid()
      AND p.key = 'email.settings.manage'
    )
  );

CREATE POLICY "Users can view AI recommendations for domains in their org"
  ON email_warmup_ai_recommendations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM email_campaign_domains d
      WHERE d.id = campaign_domain_id
      AND user_belongs_to_org(d.organization_id)
    )
  );

CREATE POLICY "Users with email.settings.manage can manage AI recommendations"
  ON email_warmup_ai_recommendations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM email_campaign_domains d
      JOIN users u ON u.organization_id = d.organization_id
      JOIN role_permissions rp ON rp.role_id = u.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE d.id = campaign_domain_id
      AND u.id = auth.uid()
      AND p.key = 'email.settings.manage'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM email_campaign_domains d
      JOIN users u ON u.organization_id = d.organization_id
      JOIN role_permissions rp ON rp.role_id = u.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE d.id = campaign_domain_id
      AND u.id = auth.uid()
      AND p.key = 'email.settings.manage'
    )
  );

INSERT INTO permissions (key, description, module_name)
VALUES 
  ('email.campaign_domains.view', 'View campaign domains and warmup status', 'email'),
  ('email.campaign_domains.manage', 'Manage campaign domains and warmup settings', 'email')
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'SuperAdmin'
AND p.key IN ('email.campaign_domains.view', 'email.campaign_domains.manage')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Admin'
AND p.key IN ('email.campaign_domains.view', 'email.campaign_domains.manage')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Manager'
AND p.key = 'email.campaign_domains.view'
ON CONFLICT DO NOTHING;
