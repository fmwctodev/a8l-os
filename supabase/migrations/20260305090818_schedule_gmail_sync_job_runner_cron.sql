/*
  # Schedule Gmail Sync Job Runner Cron

  ## Summary
  Adds a pg_cron job that calls the gmail-sync-job-runner edge function every 5 minutes.
  This ensures:
  - Queued initial sync jobs (created on OAuth connect) execute automatically
  - Incremental sync jobs enqueued by the job runner itself get processed continuously
  - No manual intervention needed for Gmail sync to stay current

  ## Changes
  - Schedules `gmail-sync-job-runner` cron every 5 minutes
  - Also schedules `gmail-watch-renew` daily at 3am to keep Pub/Sub watches alive

  ## Notes
  - Uses the same pg_cron + net.http_post pattern already used for calendar and token refresh crons
  - Service role key is passed as Authorization header so the function accepts the call
*/

select
  cron.schedule(
    'gmail-sync-job-runner',
    '*/5 * * * *',
    $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_URL') || '/functions/v1/gmail-sync-job-runner',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY')
      ),
      body := '{}'::jsonb
    );
    $$
  );

select
  cron.schedule(
    'gmail-watch-renew',
    '0 3 * * *',
    $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_URL') || '/functions/v1/gmail-watch-renew',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY')
      ),
      body := '{}'::jsonb
    );
    $$
  );
