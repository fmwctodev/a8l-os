/*
  # Optimize RLS policies for AI agents and team messaging tables

  1. Changes
    - Optimize RLS policies for ai_agent_memory table
    - Optimize RLS policies for ai_agent_runs table
    - Optimize RLS policies for ai_agent_tool_calls table
    - Optimize RLS policies for ai_drafts table
    - Optimize RLS policies for team_channels table
    - Optimize RLS policies for team_channel_members table
    - Optimize RLS policies for team_messages table
    - Optimize RLS policies for team_message_reactions table
    
  2. Security
    - Replace auth.uid() with (select auth.uid()) for performance
    - Maintain exact same security logic
    - All policies continue to check organization membership and permissions
*/

-- ai_agent_memory (uses org_id)
DROP POLICY IF EXISTS "Users can view agent memory in their organization" ON ai_agent_memory;
CREATE POLICY "Users can view agent memory in their organization"
  ON ai_agent_memory FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('ai_agents:view'));

DROP POLICY IF EXISTS "System can create agent memory" ON ai_agent_memory;
CREATE POLICY "System can create agent memory"
  ON ai_agent_memory FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id());

DROP POLICY IF EXISTS "System can update agent memory" ON ai_agent_memory;
CREATE POLICY "System can update agent memory"
  ON ai_agent_memory FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can delete agent memory" ON ai_agent_memory;
CREATE POLICY "Users can delete agent memory"
  ON ai_agent_memory FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('ai_agents:manage'));

-- ai_agent_runs (uses org_id)
DROP POLICY IF EXISTS "Users can view agent runs in their organization" ON ai_agent_runs;
CREATE POLICY "Users can view agent runs in their organization"
  ON ai_agent_runs FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('ai_agents:view'));

DROP POLICY IF EXISTS "System can create agent runs" ON ai_agent_runs;
CREATE POLICY "System can create agent runs"
  ON ai_agent_runs FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id());

DROP POLICY IF EXISTS "System can update agent runs" ON ai_agent_runs;
CREATE POLICY "System can update agent runs"
  ON ai_agent_runs FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id());

-- ai_agent_tool_calls (uses org_id)
DROP POLICY IF EXISTS "Users can view agent tool calls in their organization" ON ai_agent_tool_calls;
CREATE POLICY "Users can view agent tool calls in their organization"
  ON ai_agent_tool_calls FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('ai_agents:view'));

DROP POLICY IF EXISTS "System can create agent tool calls" ON ai_agent_tool_calls;
CREATE POLICY "System can create agent tool calls"
  ON ai_agent_tool_calls FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id());

DROP POLICY IF EXISTS "System can update agent tool calls" ON ai_agent_tool_calls;
CREATE POLICY "System can update agent tool calls"
  ON ai_agent_tool_calls FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id());

-- ai_drafts (uses organization_id)
DROP POLICY IF EXISTS "Users can view AI drafts in their organization" ON ai_drafts;
CREATE POLICY "Users can view AI drafts in their organization"
  ON ai_drafts FOR SELECT
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('conversations:view'));

DROP POLICY IF EXISTS "System can create AI drafts" ON ai_drafts;
CREATE POLICY "System can create AI drafts"
  ON ai_drafts FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can update AI drafts" ON ai_drafts;
CREATE POLICY "Users can update AI drafts"
  ON ai_drafts FOR UPDATE
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('conversations:edit'));

DROP POLICY IF EXISTS "Users can delete AI drafts" ON ai_drafts;
CREATE POLICY "Users can delete AI drafts"
  ON ai_drafts FOR DELETE
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('conversations:edit'));

-- team_channels (uses organization_id, type field for channel visibility)
DROP POLICY IF EXISTS "Users can view channels in their organization" ON team_channels;
CREATE POLICY "Users can view channels in their organization"
  ON team_channels FOR SELECT
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND (
      type = 'public' 
      OR created_by = (select auth.uid())
      OR EXISTS (
        SELECT 1 FROM team_channel_members tcm
        WHERE tcm.channel_id = team_channels.id
        AND tcm.user_id = (select auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Users can create channels" ON team_channels;
CREATE POLICY "Users can create channels"
  ON team_channels FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = get_user_org_id()
    AND created_by = (select auth.uid())
  );

DROP POLICY IF EXISTS "Channel creators can update their channels" ON team_channels;
CREATE POLICY "Channel creators can update their channels"
  ON team_channels FOR UPDATE
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND created_by = (select auth.uid())
  );

DROP POLICY IF EXISTS "Channel creators can delete their channels" ON team_channels;
CREATE POLICY "Channel creators can delete their channels"
  ON team_channels FOR DELETE
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND created_by = (select auth.uid())
  );

-- team_channel_members (uses organization_id)
DROP POLICY IF EXISTS "Users can view channel members" ON team_channel_members;
CREATE POLICY "Users can view channel members"
  ON team_channel_members FOR SELECT
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND (
      user_id = (select auth.uid())
      OR EXISTS (
        SELECT 1 FROM team_channels tc
        WHERE tc.id = team_channel_members.channel_id
        AND tc.organization_id = get_user_org_id()
        AND (tc.type = 'public' OR tc.created_by = (select auth.uid()))
      )
    )
  );

DROP POLICY IF EXISTS "Channel owners can add members" ON team_channel_members;
CREATE POLICY "Channel owners can add members"
  ON team_channel_members FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = get_user_org_id()
    AND EXISTS (
      SELECT 1 FROM team_channels tc
      WHERE tc.id = team_channel_members.channel_id
      AND tc.created_by = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Channel owners can remove members" ON team_channel_members;
CREATE POLICY "Channel owners can remove members"
  ON team_channel_members FOR DELETE
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND EXISTS (
      SELECT 1 FROM team_channels tc
      WHERE tc.id = team_channel_members.channel_id
      AND tc.created_by = (select auth.uid())
    )
  );

-- team_messages (uses organization_id, sender_id)
DROP POLICY IF EXISTS "Channel members can view messages" ON team_messages;
CREATE POLICY "Channel members can view messages"
  ON team_messages FOR SELECT
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND EXISTS (
      SELECT 1 FROM team_channel_members tcm
      WHERE tcm.channel_id = team_messages.channel_id
      AND tcm.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Channel members can create messages" ON team_messages;
CREATE POLICY "Channel members can create messages"
  ON team_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = get_user_org_id()
    AND sender_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM team_channel_members tcm
      WHERE tcm.channel_id = team_messages.channel_id
      AND tcm.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Message senders can update their messages" ON team_messages;
CREATE POLICY "Message senders can update their messages"
  ON team_messages FOR UPDATE
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND sender_id = (select auth.uid())
  );

DROP POLICY IF EXISTS "Message senders can delete their messages" ON team_messages;
CREATE POLICY "Message senders can delete their messages"
  ON team_messages FOR DELETE
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND sender_id = (select auth.uid())
  );

-- team_message_reactions (uses organization_id)
DROP POLICY IF EXISTS "Channel members can view reactions" ON team_message_reactions;
CREATE POLICY "Channel members can view reactions"
  ON team_message_reactions FOR SELECT
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND EXISTS (
      SELECT 1 FROM team_messages tm
      JOIN team_channel_members tcm ON tcm.channel_id = tm.channel_id
      WHERE tm.id = team_message_reactions.message_id
      AND tcm.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Channel members can add reactions" ON team_message_reactions;
CREATE POLICY "Channel members can add reactions"
  ON team_message_reactions FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = get_user_org_id()
    AND user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM team_messages tm
      JOIN team_channel_members tcm ON tcm.channel_id = tm.channel_id
      WHERE tm.id = team_message_reactions.message_id
      AND tcm.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can remove their reactions" ON team_message_reactions;
CREATE POLICY "Users can remove their reactions"
  ON team_message_reactions FOR DELETE
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND user_id = (select auth.uid())
  );