/*
  # Schedule approval-reminder-cron via pg_cron

  Runs every 30 minutes to:
    - Auto-expire pending approvals past their expires_at (calls
      expire_stale_approvals() RPC).
    - Send 24h reminder emails to approvers via the approval-reminder-cron
      Edge Function.

  Uses the standard Supabase pg_cron + pg_net pattern:

    1. Enable pg_cron + pg_net extensions (idempotent).
    2. Store the service role key in a vault secret named
       `approval_reminder_service_role_key` so it isn't hardcoded
       in this migration / commit history.
    3. Schedule a cron.schedule entry that POSTs to the Edge Function
       with that vault secret as the bearer token.

  The user must run, ONCE, before this migration:

      INSERT INTO vault.secrets (name, secret)
      VALUES ('approval_reminder_service_role_key', '<service-role-key-here>');

  Or via the Supabase Dashboard → Vault → New secret.
  Service role key is at: https://supabase.com/dashboard/project/uscpncgnkmjirbrpidgu/settings/api
*/

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Schedule the cron job. If the job already exists, unschedule + recreate.
DO $$
BEGIN
  -- Drop the prior schedule if it exists so re-running this migration is safe.
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'approval-reminder-cron-30min') THEN
    PERFORM cron.unschedule('approval-reminder-cron-30min');
  END IF;
END $$;

SELECT cron.schedule(
  'approval-reminder-cron-30min',
  '*/30 * * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://uscpncgnkmjirbrpidgu.supabase.co/functions/v1/approval-reminder-cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'approval_reminder_service_role_key'
          LIMIT 1
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    ) AS request_id;
  $cron$
);

-- 3. Verification helper (optional one-shot run for smoke testing).
-- After deploy, you can manually invoke via:
--   SELECT cron.schedule('approval-reminder-now', '* * * * *', '...');
-- or just call the Edge Function with curl + service role key.

COMMENT ON EXTENSION pg_cron IS
  'Used by approval-reminder-cron-30min to auto-expire stale approvals and send 24h reminders.';
