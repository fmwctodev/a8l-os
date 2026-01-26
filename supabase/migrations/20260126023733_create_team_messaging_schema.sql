/*
  # Create Team Messaging Schema

  ## Overview
  Creates an in-house team messaging system replacing Google Chat integration.
  Supports direct messages between users and group channels created by admins.

  ## New Tables

  ### team_channels
  - `id` (uuid, primary key)
  - `organization_id` (uuid, references organizations)
  - `name` (text) - Channel name (null for DMs)
  - `type` (text) - 'direct' or 'group'
  - `description` (text) - Channel description
  - `created_by` (uuid, references users)
  - `department_id` (uuid, optional) - Associated department
  - `avatar_url` (text) - Channel avatar
  - `is_archived` (boolean) - Archive status
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### team_channel_members
  - `id` (uuid, primary key)
  - `channel_id` (uuid, references team_channels)
  - `user_id` (uuid, references users)
  - `organization_id` (uuid, references organizations)
  - `role` (text) - 'admin' or 'member'
  - `joined_at` (timestamptz)
  - `last_read_at` (timestamptz) - Last time user read messages
  - `is_muted` (boolean) - Mute notifications

  ### team_messages
  - `id` (uuid, primary key)
  - `channel_id` (uuid, references team_channels)
  - `organization_id` (uuid, references organizations)
  - `sender_id` (uuid, references users)
  - `content` (text) - Message content
  - `reply_to_id` (uuid) - Reference to message being replied to
  - `attachments` (jsonb) - File attachments
  - `mentions` (jsonb) - User mentions
  - `is_edited` (boolean) - Edit flag
  - `is_deleted` (boolean) - Soft delete flag
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### team_message_reactions
  - `id` (uuid, primary key)
  - `message_id` (uuid, references team_messages)
  - `user_id` (uuid, references users)
  - `organization_id` (uuid, references organizations)
  - `emoji` (text) - Reaction emoji
  - `created_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Users can only access channels they are members of
  - Only admins can create group channels
  - Only message senders can edit/delete their messages
  - Channel admins can manage members and delete messages

  ## Indexes
  - Indexes on channel_id, sender_id, created_at for performance
  - Unique constraints on DM pairs and reaction combinations
*/

-- Create team_channels table
CREATE TABLE IF NOT EXISTS team_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text,
  type text NOT NULL CHECK (type IN ('direct', 'group')),
  description text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  avatar_url text,
  is_archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create team_channel_members table
CREATE TABLE IF NOT EXISTS team_channel_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES team_channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at timestamptz DEFAULT now(),
  last_read_at timestamptz DEFAULT now(),
  is_muted boolean DEFAULT false,
  UNIQUE(channel_id, user_id)
);

-- Create team_messages table
CREATE TABLE IF NOT EXISTS team_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES team_channels(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  reply_to_id uuid REFERENCES team_messages(id) ON DELETE SET NULL,
  attachments jsonb DEFAULT '[]'::jsonb,
  mentions jsonb DEFAULT '[]'::jsonb,
  is_edited boolean DEFAULT false,
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create team_message_reactions table
CREATE TABLE IF NOT EXISTS team_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES team_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_team_channels_org ON team_channels(organization_id);
CREATE INDEX IF NOT EXISTS idx_team_channels_created_by ON team_channels(created_by);
CREATE INDEX IF NOT EXISTS idx_team_channel_members_channel ON team_channel_members(channel_id);
CREATE INDEX IF NOT EXISTS idx_team_channel_members_user ON team_channel_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_channel_members_org ON team_channel_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_team_messages_channel ON team_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_team_messages_sender ON team_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_team_messages_created ON team_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_message_reactions_message ON team_message_reactions(message_id);

-- Enable Row Level Security
ALTER TABLE team_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_message_reactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for team_channels
CREATE POLICY "Users can view channels they are members of"
  ON team_channels FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_channel_members
      WHERE team_channel_members.channel_id = team_channels.id
      AND team_channel_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create channels"
  ON team_channels FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Channel admins can update channels"
  ON team_channels FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_channel_members
      WHERE team_channel_members.channel_id = team_channels.id
      AND team_channel_members.user_id = auth.uid()
      AND team_channel_members.role = 'admin'
    )
  );

CREATE POLICY "Channel admins can delete channels"
  ON team_channels FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_channel_members
      WHERE team_channel_members.channel_id = team_channels.id
      AND team_channel_members.user_id = auth.uid()
      AND team_channel_members.role = 'admin'
    )
  );

-- RLS Policies for team_channel_members
CREATE POLICY "Users can view members of their channels"
  ON team_channel_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_channel_members AS tcm
      WHERE tcm.channel_id = team_channel_members.channel_id
      AND tcm.user_id = auth.uid()
    )
  );

CREATE POLICY "Channel creators can add members"
  ON team_channel_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_channels
      WHERE team_channels.id = channel_id
      AND team_channels.created_by = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM team_channel_members AS tcm
      WHERE tcm.channel_id = team_channel_members.channel_id
      AND tcm.user_id = auth.uid()
      AND tcm.role = 'admin'
    )
  );

CREATE POLICY "Users can update their own membership"
  ON team_channel_members FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Channel admins can remove members"
  ON team_channel_members FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM team_channel_members AS tcm
      WHERE tcm.channel_id = team_channel_members.channel_id
      AND tcm.user_id = auth.uid()
      AND tcm.role = 'admin'
    )
  );

-- RLS Policies for team_messages
CREATE POLICY "Users can view messages in their channels"
  ON team_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_channel_members
      WHERE team_channel_members.channel_id = team_messages.channel_id
      AND team_channel_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Channel members can send messages"
  ON team_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM team_channel_members
      WHERE team_channel_members.channel_id = team_messages.channel_id
      AND team_channel_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can edit their own messages"
  ON team_messages FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users and admins can delete messages"
  ON team_messages FOR DELETE
  TO authenticated
  USING (
    sender_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM team_channel_members
      WHERE team_channel_members.channel_id = team_messages.channel_id
      AND team_channel_members.user_id = auth.uid()
      AND team_channel_members.role = 'admin'
    )
  );

-- RLS Policies for team_message_reactions
CREATE POLICY "Users can view reactions in their channels"
  ON team_message_reactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_messages
      JOIN team_channel_members ON team_channel_members.channel_id = team_messages.channel_id
      WHERE team_messages.id = team_message_reactions.message_id
      AND team_channel_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add reactions"
  ON team_message_reactions FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM team_messages
      JOIN team_channel_members ON team_channel_members.channel_id = team_messages.channel_id
      WHERE team_messages.id = message_id
      AND team_channel_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can remove their own reactions"
  ON team_message_reactions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Create function to get unread count for a channel
CREATE OR REPLACE FUNCTION get_channel_unread_count(p_channel_id uuid, p_user_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_last_read_at timestamptz;
  v_unread_count bigint;
BEGIN
  -- Get user's last read timestamp for this channel
  SELECT last_read_at INTO v_last_read_at
  FROM team_channel_members
  WHERE channel_id = p_channel_id
  AND user_id = p_user_id;

  -- Count messages created after last read time
  SELECT COUNT(*)::bigint INTO v_unread_count
  FROM team_messages
  WHERE channel_id = p_channel_id
  AND created_at > COALESCE(v_last_read_at, '1970-01-01'::timestamptz)
  AND sender_id != p_user_id
  AND is_deleted = false;

  RETURN COALESCE(v_unread_count, 0);
END;
$$;
