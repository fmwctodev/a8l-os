/*
  # Twilio Connection Health Check Cron Job

  1. Changes
    - Adds `last_health_check_at` column to `twilio_connection` table to track when
      the connection was last verified against the Twilio API
    - Schedules a pg_cron job to run every 30 minutes that calls the
      `twilio-connection-health` edge function to verify all Twilio connections
      are still valid and updates their status accordingly

  2. Purpose
    - Keeps Twilio connection status accurate and up-to-date
    - Automatically detects if credentials become invalid (rotated, revoked, etc.)
    - Prevents the UI from showing stale "connected" status when credentials expire
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'twilio_connection' AND column_name = 'last_health_check_at'
  ) THEN
    ALTER TABLE twilio_connection ADD COLUMN last_health_check_at timestamptz;
  END IF;
END $$;

SELECT cron.schedule(
  'twilio-connection-health-check',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/twilio-connection-health',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  )
  $$
);
