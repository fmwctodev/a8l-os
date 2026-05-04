/*
  # Drop the legacy twilio-connection-health pg_cron job

  Twilio is gone (see 20260503010000_replace_twilio_with_plivo.sql).
  The cron job that pinged twilio-connection-health every 30 minutes
  is now pointing at a function that no longer exists, so unschedule it.

  Plivo connection health is verified on-demand from the settings UI via
  the plivo-connection 'test' action, so no replacement cron is needed.
*/

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'twilio-connection-health-check') THEN
    PERFORM cron.unschedule('twilio-connection-health-check');
  END IF;
END $$;
