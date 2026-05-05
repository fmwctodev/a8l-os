/*
  # Extend workflow_trigger_type enum with form + opportunity triggers

  The form-submit Edge Function emits `form_submitted` and `opportunity_created`
  events to event_outbox, but the workflow_trigger_type enum (created in
  20260122032112_create_workflows_module.sql) doesn't include those values, so
  any workflow configured against them gets a constraint violation when
  workflow_triggers.trigger_type is set.

  Adding the values is the only Phase B database change needed — workflow-processor
  already polls event_outbox and matches on event_type → trigger_type, so once
  the enum allows these values, the user can configure SMS workflows via the
  visual builder UI without further code changes.

  ALTER TYPE ADD VALUE IF NOT EXISTS is idempotent (safe to re-run) and works
  inside a transaction block on Postgres 12+. Supabase runs Postgres 15+.
*/

ALTER TYPE workflow_trigger_type ADD VALUE IF NOT EXISTS 'form_submitted';
ALTER TYPE workflow_trigger_type ADD VALUE IF NOT EXISTS 'opportunity_created';
ALTER TYPE workflow_trigger_type ADD VALUE IF NOT EXISTS 'opportunity_stage_changed';
ALTER TYPE workflow_trigger_type ADD VALUE IF NOT EXISTS 'sms_send_requested';
