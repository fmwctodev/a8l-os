/*
  # Fix team messaging foreign keys to reference public.users

  1. Problem
    - All team messaging tables have user-referencing FKs pointing to auth.users(id)
    - PostgREST (Supabase REST API) only exposes the public schema
    - Joins like `sender:users!team_messages_sender_id_fkey(...)` fail with PGRST200
      because PostgREST cannot resolve cross-schema FK relationships

  2. Changes
    - Drop and recreate FK `team_messages_sender_id_fkey` -> public.users(id)
    - Drop and recreate FK `team_channels_created_by_fkey` -> public.users(id)
    - Drop and recreate FK `team_channel_members_user_id_fkey` -> public.users(id)
    - Drop and recreate FK `team_message_reactions_user_id_fkey` -> public.users(id)

  3. Safety
    - public.users.id already has a cascading FK to auth.users.id
    - All existing user IDs are valid in both tables
    - ON DELETE CASCADE behavior is preserved
*/

ALTER TABLE team_messages
  DROP CONSTRAINT IF EXISTS team_messages_sender_id_fkey;

ALTER TABLE team_messages
  ADD CONSTRAINT team_messages_sender_id_fkey
  FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE team_channels
  DROP CONSTRAINT IF EXISTS team_channels_created_by_fkey;

ALTER TABLE team_channels
  ADD CONSTRAINT team_channels_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE team_channel_members
  DROP CONSTRAINT IF EXISTS team_channel_members_user_id_fkey;

ALTER TABLE team_channel_members
  ADD CONSTRAINT team_channel_members_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE team_message_reactions
  DROP CONSTRAINT IF EXISTS team_message_reactions_user_id_fkey;

ALTER TABLE team_message_reactions
  ADD CONSTRAINT team_message_reactions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;