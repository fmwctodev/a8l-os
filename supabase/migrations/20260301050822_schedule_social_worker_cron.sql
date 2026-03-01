/*
  # Schedule social-worker cron job

  1. Changes
    - Adds a pg_cron job that invokes the `social-worker` edge function every 2 minutes
    - This processes any social posts with `status = 'scheduled'` whose `scheduled_at_utc` has passed
    - Without this cron, scheduled posts would never be picked up and published

  2. Important Notes
    - The cron calls social-worker with no body, triggering its "cron mode"
    - In cron mode, social-worker fetches all due posts and processes them in batch
    - Posts created via "Post Now" are also handled directly by the frontend,
      so this cron serves as a safety net and handles future-scheduled posts
*/

SELECT cron.schedule(
  'social-worker-process-scheduled',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/social-worker',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
