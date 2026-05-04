/*
  # plivo_connection.plivo_app_id

  Per-org Plivo Application id. Each org gets exactly one Plivo Application
  ("Autom8ion Lab — Webhooks") whose answer / hangup / message URLs point at
  our edge functions. The Application id is reused across syncs so we PATCH
  the existing app instead of creating duplicates.
*/

ALTER TABLE plivo_connection
  ADD COLUMN IF NOT EXISTS plivo_app_id text;
