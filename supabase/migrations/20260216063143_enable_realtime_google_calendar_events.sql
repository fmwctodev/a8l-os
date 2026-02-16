/*
  # Enable Realtime on Google Calendar Events Table

  Adds the `google_calendar_events` table to the Supabase Realtime publication
  so the frontend can subscribe to live changes.

  1. Changes
    - Add `google_calendar_events` to `supabase_realtime` publication

  2. Important Notes
    - Enables the calendar UI to receive instant updates when background sync
      inserts, updates, or deletes Google Calendar events
    - RLS policies already restrict visibility per user/org so Realtime
      respects the same access controls
    - Follows the same pattern used for notifications and team_messages
*/

ALTER PUBLICATION supabase_realtime ADD TABLE google_calendar_events;
