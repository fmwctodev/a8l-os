/*
  # Optimize RLS policies for timeline, files, and oauth tables

  1. Changes
    - Optimize RLS policies for contact_timeline table
    - Optimize RLS policies for opportunity_notes table
    - Optimize RLS policies for opportunity_timeline_events table
    - Optimize RLS policies for file_attachments table
    - Optimize RLS policies for gmail_oauth_tokens table
    - Optimize RLS policies for event_outbox table
    - Optimize RLS policies for inbox_events table
    
  2. Security
    - Replace auth.uid() with (select auth.uid()) for performance
    - Maintain exact same security logic
    - All policies continue to check organization membership and permissions
*/

-- contact_timeline (links through contacts table)
DROP POLICY IF EXISTS "Users can view contact timeline in their organization" ON contact_timeline;
CREATE POLICY "Users can view contact timeline in their organization"
  ON contact_timeline FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = contact_timeline.contact_id
      AND c.organization_id = get_user_org_id()
      AND has_permission('contacts:view')
    )
  );

DROP POLICY IF EXISTS "Users can create contact timeline events" ON contact_timeline;
CREATE POLICY "Users can create contact timeline events"
  ON contact_timeline FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = contact_timeline.contact_id
      AND c.organization_id = get_user_org_id()
      AND has_permission('contacts:edit')
    )
  );

-- opportunity_notes (uses org_id)
DROP POLICY IF EXISTS "Users can view opportunity notes in their organization" ON opportunity_notes;
CREATE POLICY "Users can view opportunity notes in their organization"
  ON opportunity_notes FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('opportunities:view'));

DROP POLICY IF EXISTS "Users can create opportunity notes" ON opportunity_notes;
CREATE POLICY "Users can create opportunity notes"
  ON opportunity_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = get_user_org_id() 
    AND created_by = (select auth.uid())
    AND has_permission('opportunities:edit')
  );

DROP POLICY IF EXISTS "Users can update their own opportunity notes" ON opportunity_notes;
CREATE POLICY "Users can update their own opportunity notes"
  ON opportunity_notes FOR UPDATE
  TO authenticated
  USING (
    org_id = get_user_org_id() 
    AND created_by = (select auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete their own opportunity notes" ON opportunity_notes;
CREATE POLICY "Users can delete their own opportunity notes"
  ON opportunity_notes FOR DELETE
  TO authenticated
  USING (
    org_id = get_user_org_id() 
    AND created_by = (select auth.uid())
  );

-- opportunity_timeline_events (uses org_id)
DROP POLICY IF EXISTS "Users can view opportunity timeline in their organization" ON opportunity_timeline_events;
CREATE POLICY "Users can view opportunity timeline in their organization"
  ON opportunity_timeline_events FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('opportunities:view'));

DROP POLICY IF EXISTS "System can create opportunity timeline events" ON opportunity_timeline_events;
CREATE POLICY "System can create opportunity timeline events"
  ON opportunity_timeline_events FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id());

-- file_attachments (uses organization_id)
DROP POLICY IF EXISTS "Users can view file attachments in their organization" ON file_attachments;
CREATE POLICY "Users can view file attachments in their organization"
  ON file_attachments FOR SELECT
  TO authenticated
  USING (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can create file attachments" ON file_attachments;
CREATE POLICY "Users can create file attachments"
  ON file_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = get_user_org_id() 
    AND attached_by = (select auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete their own file attachments" ON file_attachments;
CREATE POLICY "Users can delete their own file attachments"
  ON file_attachments FOR DELETE
  TO authenticated
  USING (
    organization_id = get_user_org_id() 
    AND attached_by = (select auth.uid())
  );

-- gmail_oauth_tokens (uses organization_id)
DROP POLICY IF EXISTS "Users can view their own gmail oauth tokens" ON gmail_oauth_tokens;
CREATE POLICY "Users can view their own gmail oauth tokens"
  ON gmail_oauth_tokens FOR SELECT
  TO authenticated
  USING (
    organization_id = get_user_org_id() 
    AND user_id = (select auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert their own gmail oauth tokens" ON gmail_oauth_tokens;
CREATE POLICY "Users can insert their own gmail oauth tokens"
  ON gmail_oauth_tokens FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = get_user_org_id() 
    AND user_id = (select auth.uid())
  );

DROP POLICY IF EXISTS "Users can update their own gmail oauth tokens" ON gmail_oauth_tokens;
CREATE POLICY "Users can update their own gmail oauth tokens"
  ON gmail_oauth_tokens FOR UPDATE
  TO authenticated
  USING (
    organization_id = get_user_org_id() 
    AND user_id = (select auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete their own gmail oauth tokens" ON gmail_oauth_tokens;
CREATE POLICY "Users can delete their own gmail oauth tokens"
  ON gmail_oauth_tokens FOR DELETE
  TO authenticated
  USING (
    organization_id = get_user_org_id() 
    AND user_id = (select auth.uid())
  );

-- event_outbox (uses org_id)
DROP POLICY IF EXISTS "System can read event outbox" ON event_outbox;
CREATE POLICY "System can read event outbox"
  ON event_outbox FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id());

DROP POLICY IF EXISTS "System can insert event outbox" ON event_outbox;
CREATE POLICY "System can insert event outbox"
  ON event_outbox FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id());

DROP POLICY IF EXISTS "System can update event outbox" ON event_outbox;
CREATE POLICY "System can update event outbox"
  ON event_outbox FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id());

-- inbox_events (uses organization_id)
DROP POLICY IF EXISTS "Users can view inbox events in their organization" ON inbox_events;
CREATE POLICY "Users can view inbox events in their organization"
  ON inbox_events FOR SELECT
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('conversations:view'));

DROP POLICY IF EXISTS "System can create inbox events" ON inbox_events;
CREATE POLICY "System can create inbox events"
  ON inbox_events FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_user_org_id());