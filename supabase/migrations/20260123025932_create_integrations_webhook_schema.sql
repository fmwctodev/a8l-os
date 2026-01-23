/*
  # Create Integrations Module - Webhook Schema

  1. New Tables
    - `outgoing_webhooks` - User-configured webhooks to external systems
      - `id` (uuid, primary key)
      - `org_id` (uuid, references organizations)
      - `name` (text, friendly name)
      - `url` (text, target endpoint)
      - `events` (jsonb array of event types to send)
      - `signing_secret_encrypted` (text)
      - `signing_secret_iv` (text)
      - `headers` (jsonb, custom headers to include)
      - `enabled` (boolean)
      - `retry_count` (int, max retries)
      - `created_at`, `updated_at`
      - `created_by` (uuid, user who created)
    
    - `webhook_deliveries` - Log of webhook delivery attempts
      - `id` (uuid, primary key)
      - `webhook_id` (uuid, references outgoing_webhooks)
      - `org_id` (uuid)
      - `event_type` (text)
      - `event_id` (uuid, reference to source record)
      - `payload` (jsonb)
      - `status` (text - pending, delivered, failed)
      - `response_code` (int)
      - `response_body` (text)
      - `attempts` (int)
      - `next_retry_at` (timestamptz)
      - `created_at` (timestamptz)
      - `delivered_at` (timestamptz)

  2. Supported Event Types
    - contact_created, contact_updated, contact_deleted
    - opportunity_created, opportunity_stage_changed, opportunity_won, opportunity_lost
    - appointment_booked, appointment_cancelled, appointment_completed
    - message_received, message_sent
    - payment_completed, invoice_created
    - form_submitted, survey_submitted
    - score_updated

  3. Security
    - Enable RLS on all tables
    - Admin-only access for webhook management
*/

-- Create outgoing webhooks table
CREATE TABLE IF NOT EXISTS outgoing_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  signing_secret_encrypted text NOT NULL,
  signing_secret_iv text NOT NULL,
  headers jsonb DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  retry_count int NOT NULL DEFAULT 3 CHECK (retry_count >= 0 AND retry_count <= 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL
);

-- Create webhook deliveries table
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES outgoing_webhooks(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_id uuid,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
  response_code int,
  response_body text,
  attempts int NOT NULL DEFAULT 0,
  next_retry_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_outgoing_webhooks_org_id ON outgoing_webhooks(org_id);
CREATE INDEX IF NOT EXISTS idx_outgoing_webhooks_enabled ON outgoing_webhooks(enabled);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_org_id ON webhook_deliveries(org_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_next_retry_at ON webhook_deliveries(next_retry_at);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created_at ON webhook_deliveries(created_at);

-- Enable RLS
ALTER TABLE outgoing_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Create updated_at trigger for outgoing_webhooks
CREATE TRIGGER outgoing_webhooks_updated_at
  BEFORE UPDATE ON outgoing_webhooks
  FOR EACH ROW
  EXECUTE FUNCTION update_integrations_updated_at();

-- Create function to queue webhook delivery
CREATE OR REPLACE FUNCTION queue_webhook_delivery(
  p_org_id uuid,
  p_event_type text,
  p_event_id uuid,
  p_payload jsonb
)
RETURNS void AS $$
DECLARE
  webhook_record RECORD;
BEGIN
  FOR webhook_record IN
    SELECT id, retry_count
    FROM outgoing_webhooks
    WHERE org_id = p_org_id
      AND enabled = true
      AND events @> jsonb_build_array(p_event_type)
  LOOP
    INSERT INTO webhook_deliveries (
      webhook_id,
      org_id,
      event_type,
      event_id,
      payload,
      status,
      attempts,
      next_retry_at
    ) VALUES (
      webhook_record.id,
      p_org_id,
      p_event_type,
      p_event_id,
      p_payload,
      'pending',
      0,
      now()
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get webhook health metrics
CREATE OR REPLACE FUNCTION get_webhook_health(p_webhook_id uuid)
RETURNS TABLE (
  total_deliveries bigint,
  successful_deliveries bigint,
  failed_deliveries bigint,
  pending_deliveries bigint,
  success_rate numeric,
  last_success timestamptz,
  last_failure timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::bigint AS total_deliveries,
    COUNT(*) FILTER (WHERE wd.status = 'delivered')::bigint AS successful_deliveries,
    COUNT(*) FILTER (WHERE wd.status = 'failed')::bigint AS failed_deliveries,
    COUNT(*) FILTER (WHERE wd.status = 'pending')::bigint AS pending_deliveries,
    CASE 
      WHEN COUNT(*) FILTER (WHERE wd.status != 'pending') > 0 
      THEN ROUND(
        (COUNT(*) FILTER (WHERE wd.status = 'delivered')::numeric / 
         COUNT(*) FILTER (WHERE wd.status != 'pending')::numeric) * 100, 
        2
      )
      ELSE 0
    END AS success_rate,
    MAX(wd.delivered_at) FILTER (WHERE wd.status = 'delivered') AS last_success,
    MAX(wd.created_at) FILTER (WHERE wd.status = 'failed') AS last_failure
  FROM webhook_deliveries wd
  WHERE wd.webhook_id = p_webhook_id
    AND wd.created_at > now() - interval '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
