/*
  # Schedule Google Calendar Sync Cron Jobs

  Adds two pg_cron jobs to automate Google Calendar synchronization,
  matching the existing Gmail sync pattern.

  1. New Cron Jobs
    - `gcal-enqueue-syncs` (every 2 minutes on even minutes)
      - Calls the `google-calendar-sync-cron` edge function
      - Enqueues incremental sync jobs for all enabled connections that are due
    - `gcal-process-job-queue` (every 2 minutes on odd minutes)
      - Calls the `google-calendar-sync-runner` edge function
      - Processes queued sync jobs (up to 5 per run)

  2. Important Notes
    - The cron edge function already exists and handles job enqueueing
    - The runner edge function already exists and processes queued jobs
    - This mirrors the Gmail sync cron pattern (jobs 1 and 2)
    - Staggered schedules (even/odd minutes) prevent resource contention
    - Without these cron jobs, sync only happened on manual button click or page load
*/

SELECT cron.schedule(
  'gcal-enqueue-syncs',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/google-calendar-sync-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  )
  $$
);

SELECT cron.schedule(
  'gcal-process-job-queue',
  '1-59/2 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/google-calendar-sync-runner',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  )
  $$
);
