/*
  # Reduce Google Calendar Sync Interval to 1 Minute

  1. Changes
    - Update `sync_interval_minutes` from 2 to 1 for all existing connections
    - This halves the maximum delay between a Google Calendar change and the CRM picking it up

  2. Important Notes
    - Google Calendar API has generous quotas (1,000,000 queries/day)
    - Incremental sync uses sync tokens so most calls return minimal data
    - Combined with Realtime subscriptions, the UI will update within seconds
*/

UPDATE google_calendar_connections
SET sync_interval_minutes = 1
WHERE sync_interval_minutes = 2;
