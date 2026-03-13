/*
  # Schedule Workflow Automation Cron Jobs

  Creates pg_cron jobs for the automation runtime:
  1. workflow-processor - runs every minute to process pending events and jobs
  2. workflow-scheduled-processor - runs every 5 minutes for scheduled triggers
  3. workflow-condition-checker - runs every 5 minutes to check waiting conditions
  4. workflow cleanup - archives old processed events daily
*/

-- Enable pg_cron and pg_net if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Workflow processor: process pending event_outbox events and workflow_jobs every minute
SELECT cron.schedule(
  'workflow-processor-cron',
  '* * * * *',
  $$
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/workflow-processor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"source": "cron", "batch_size": 50}'::jsonb
  );
  $$
);

-- Workflow scheduled processor: check due scheduled triggers every 5 minutes
SELECT cron.schedule(
  'workflow-scheduled-processor-cron',
  '*/5 * * * *',
  $$
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/workflow-scheduled-processor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"source": "cron"}'::jsonb
  );
  $$
);

-- Workflow condition checker: check waiting conditions every 5 minutes
SELECT cron.schedule(
  'workflow-condition-checker-cron',
  '*/5 * * * *',
  $$
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/workflow-condition-checker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"source": "cron"}'::jsonb
  );
  $$
);

-- Cleanup: archive processed events older than 30 days, run daily at 3 AM UTC
SELECT cron.schedule(
  'workflow-event-cleanup-cron',
  '0 3 * * *',
  $$
  DELETE FROM event_outbox
  WHERE processed_at IS NOT NULL
    AND processed_at < now() - interval '30 days';
  $$
);
