/*
  # Schedule Signature Reminder and Expiration Cron Jobs

  1. Cron Jobs
    - `signature-reminder-scheduler`: Runs every 6 hours to send reminder emails
      to signers with pending/viewed signature requests
    - `signature-expiration-processor`: Runs every hour to mark expired
      signature requests and update proposal statuses

  2. Important Notes
    - Both functions use service role key (no JWT verification)
    - Reminders are rate-limited: max 3 per request, at least 48h apart
    - Expiration processor only affects requests past their expires_at date
*/

SELECT cron.schedule(
  'signature-reminder-scheduler',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/signature-reminder-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'signature-expiration-processor',
  '15 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/signature-expiration-processor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
