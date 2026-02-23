/*
  # Schedule Google Token Refresh Cron Job

  1. Purpose
    - Creates a cron job that runs every 5 minutes to proactively refresh
      Google OAuth access tokens before they expire
    - Prevents users from seeing false "connection expired" warnings
    - Ensures all Google service integrations (Gmail, Calendar, Drive) 
      maintain valid tokens at all times

  2. Changes
    - Registers a new pg_cron job `google-token-refresh` that invokes
      the `google-token-refresh-cron` edge function every 5 minutes

  3. Important Notes
    - Google access tokens expire after 60 minutes
    - The cron refreshes tokens that expire within the next 10 minutes
    - Running every 5 minutes ensures no token ever fully expires
    - Individual refresh failures are isolated and do not block other users
*/

SELECT cron.unschedule('google-token-refresh')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'google-token-refresh'
);

SELECT cron.schedule(
  'google-token-refresh',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/google-token-refresh-cron',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
