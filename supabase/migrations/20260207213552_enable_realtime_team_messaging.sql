/*
  # Enable Realtime for Team Messaging Tables

  1. Changes
    - Add `team_messages` table to the `supabase_realtime` publication
    - Add `team_channel_members` table to the `supabase_realtime` publication

  2. Why
    - Supabase Postgres Changes requires tables to be in the `supabase_realtime` publication
    - Without this, real-time subscriptions for new messages and channel membership changes do not receive events
    - This enables automatic message syncing without manual refresh
*/

ALTER PUBLICATION supabase_realtime ADD TABLE team_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE team_channel_members;
