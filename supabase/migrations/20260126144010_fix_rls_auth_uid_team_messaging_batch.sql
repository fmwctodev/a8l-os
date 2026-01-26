/*
  # Fix RLS auth.uid() Performance - Team Messaging Batch
  
  This migration optimizes RLS policies for team messaging tables by:
  1. Wrapping auth.uid() calls in (select ...) for single evaluation per query
  2. Removing duplicate policies that were created during previous optimization attempts
  3. Consolidating to single optimized policies per operation
  
  ## Tables Fixed
  - team_channels: Channel management
  - team_channel_members: Channel membership
  - team_messages: Messages in channels
  - team_message_reactions: Message reactions
  
  ## Changes
  - All auth.uid() calls wrapped in (select auth.uid())
  - Duplicate policies removed and consolidated
  - Consistent naming conventions applied
*/

-- ============================================
-- team_channels - Drop duplicates and fix
-- ============================================

-- Drop old unoptimized policies
DROP POLICY IF EXISTS "Channel creators can view their channels" ON team_channels;
DROP POLICY IF EXISTS "Users can view channels they are members of" ON team_channels;
DROP POLICY IF EXISTS "Channel admins can update channels" ON team_channels;
DROP POLICY IF EXISTS "Channel admins can delete channels" ON team_channels;

-- The optimized policies already exist with get_user_org_id() and (select auth.uid())
-- Just verify/keep: "Users can create channels", "Users can view channels in their organization", 
-- "Channel creators can update their channels", "Channel creators can delete their channels"

-- ============================================
-- team_channel_members - Drop duplicates and fix
-- ============================================

-- Drop old unoptimized policies
DROP POLICY IF EXISTS "Users can view members of their channels" ON team_channel_members;
DROP POLICY IF EXISTS "Channel admins can remove members" ON team_channel_members;
DROP POLICY IF EXISTS "Channel creators can add members" ON team_channel_members;

-- Fix "Users can update their own membership" - uses bare auth.uid()
DROP POLICY IF EXISTS "Users can update their own membership" ON team_channel_members;
CREATE POLICY "Users can update their own membership"
  ON team_channel_members
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ============================================
-- team_messages - Drop duplicates and fix
-- ============================================

-- Drop old unoptimized policies
DROP POLICY IF EXISTS "Users can view messages in their channels" ON team_messages;
DROP POLICY IF EXISTS "Channel members can send messages" ON team_messages;
DROP POLICY IF EXISTS "Users can edit their own messages" ON team_messages;
DROP POLICY IF EXISTS "Users and admins can delete messages" ON team_messages;

-- ============================================
-- team_message_reactions - Drop duplicates and fix
-- ============================================

-- Drop old unoptimized policies
DROP POLICY IF EXISTS "Users can view reactions in their channels" ON team_message_reactions;
DROP POLICY IF EXISTS "Users can add reactions" ON team_message_reactions;
DROP POLICY IF EXISTS "Users can remove their own reactions" ON team_message_reactions;

