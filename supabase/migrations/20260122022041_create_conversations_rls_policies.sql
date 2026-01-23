/*
  # Conversations Module - RLS Policies

  ## Overview
  Implements department-based access control for conversations:
  - Access inherits from contact access rules
  - Assigned users can manage their conversations
  - Admins can access all conversations
  - Channel configurations are admin-only

  ## 1. Helper Functions
  - can_access_conversation(conversation_id): Checks if user can access specific conversation

  ## 2. Access Rules
  - Conversations: Inherit from contact access (department-based)
  - Messages: Inherit from conversation access
  - Call logs: Inherit from conversation access
  - Inbox events: Inherit from conversation access
  - Channel configs: Admin/SuperAdmin only
  - Gmail tokens: Own tokens or Admin
  - Webchat sessions: Org-wide for users with conversations permission

  ## 3. Write Rules
  - Send messages: conversations.send permission + conversation access
  - Assign conversations: conversations.assign permission
  - Change status: conversations.close or assigned user
  - Manage channels: channels.configure permission (Admin only)
*/

CREATE OR REPLACE FUNCTION can_access_conversation(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = p_conversation_id
    AND c.organization_id = get_user_org_id()
    AND (
      is_admin_or_higher()
      OR can_access_contact(c.contact_id)
      OR c.assigned_user_id = auth.uid()
    )
  )
$$;

CREATE POLICY "Admins can view all conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND is_admin_or_higher()
  );

CREATE POLICY "Users can view conversations for accessible contacts"
  ON conversations FOR SELECT
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND NOT is_admin_or_higher()
    AND (
      can_access_contact(contact_id)
      OR assigned_user_id = auth.uid()
    )
  );

CREATE POLICY "System can create conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = get_user_org_id()
    AND has_permission('conversations.view')
  );

CREATE POLICY "Users can update conversations they have access to"
  ON conversations FOR UPDATE
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND (
      is_admin_or_higher()
      OR assigned_user_id = auth.uid()
      OR (has_permission('conversations.manage') AND can_access_contact(contact_id))
    )
  )
  WITH CHECK (
    organization_id = get_user_org_id()
  );

CREATE POLICY "Only admins can delete conversations"
  ON conversations FOR DELETE
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND is_admin_or_higher()
  );

CREATE POLICY "Users can view messages in accessible conversations"
  ON messages FOR SELECT
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND can_access_conversation(conversation_id)
  );

CREATE POLICY "Users with send permission can create messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = get_user_org_id()
    AND has_permission('conversations.send')
    AND can_access_conversation(conversation_id)
  );

CREATE POLICY "System can update message status"
  ON messages FOR UPDATE
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND can_access_conversation(conversation_id)
  )
  WITH CHECK (
    organization_id = get_user_org_id()
  );

CREATE POLICY "Only admins can delete messages"
  ON messages FOR DELETE
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND is_admin_or_higher()
  );

CREATE POLICY "Users can view call logs for accessible conversations"
  ON call_logs FOR SELECT
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND can_access_conversation(conversation_id)
  );

CREATE POLICY "System can create call logs"
  ON call_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = get_user_org_id()
    AND can_access_conversation(conversation_id)
  );

CREATE POLICY "System can update call logs"
  ON call_logs FOR UPDATE
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND can_access_conversation(conversation_id)
  )
  WITH CHECK (
    organization_id = get_user_org_id()
  );

CREATE POLICY "Users can view inbox events for accessible conversations"
  ON inbox_events FOR SELECT
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND can_access_conversation(conversation_id)
  );

CREATE POLICY "System can create inbox events"
  ON inbox_events FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = get_user_org_id()
    AND can_access_conversation(conversation_id)
  );

CREATE POLICY "Only admins can view channel configurations"
  ON channel_configurations FOR SELECT
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND has_permission('channels.configure')
  );

CREATE POLICY "Only admins can create channel configurations"
  ON channel_configurations FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = get_user_org_id()
    AND has_permission('channels.configure')
  );

CREATE POLICY "Only admins can update channel configurations"
  ON channel_configurations FOR UPDATE
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND has_permission('channels.configure')
  )
  WITH CHECK (
    organization_id = get_user_org_id()
    AND has_permission('channels.configure')
  );

CREATE POLICY "Only admins can delete channel configurations"
  ON channel_configurations FOR DELETE
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND has_permission('channels.configure')
  );

CREATE POLICY "Users can view their own Gmail tokens"
  ON gmail_oauth_tokens FOR SELECT
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND (user_id = auth.uid() OR is_admin_or_higher())
  );

CREATE POLICY "Users can create their own Gmail tokens"
  ON gmail_oauth_tokens FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = get_user_org_id()
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can update their own Gmail tokens"
  ON gmail_oauth_tokens FOR UPDATE
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND user_id = auth.uid()
  )
  WITH CHECK (
    organization_id = get_user_org_id()
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can delete their own Gmail tokens"
  ON gmail_oauth_tokens FOR DELETE
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND (user_id = auth.uid() OR is_admin_or_higher())
  );

CREATE POLICY "Users can view webchat sessions in their org"
  ON webchat_sessions FOR SELECT
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND has_permission('conversations.view')
  );

CREATE POLICY "System can create webchat sessions"
  ON webchat_sessions FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_user_org_id());

CREATE POLICY "System can update webchat sessions"
  ON webchat_sessions FOR UPDATE
  TO authenticated
  USING (organization_id = get_user_org_id())
  WITH CHECK (organization_id = get_user_org_id());
