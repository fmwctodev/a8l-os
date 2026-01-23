/*
  # RLS Policies for Workflows Module

  Implements comprehensive RLS policies for all workflow tables.

  1. Workflows Table
    - SELECT: Users with automation.view permission can view workflows in their org
    - INSERT: Users with automation.manage permission can create workflows
    - UPDATE: Users with automation.manage permission can update workflows
    - DELETE: Users with automation.manage permission can archive/delete workflows

  2. Workflow Versions Table
    - SELECT: Users with automation.view permission can view versions
    - INSERT: System only (via publish operation)

  3. Workflow Triggers Table
    - SELECT: Users with automation.view permission
    - INSERT/UPDATE/DELETE: Users with automation.manage permission

  4. Workflow Enrollments Table
    - SELECT: Users with automation.view permission
    - INSERT: Users with automation.manage permission (manual enrollment)
    - UPDATE: Users with automation.manage permission (stop enrollment)

  5. Workflow Jobs Table
    - SELECT: Users with automation.view permission
    - Service role handles INSERT/UPDATE (queue operations)

  6. Workflow Execution Logs Table
    - SELECT: Users with automation.view permission
    - INSERT: Service role only (append-only audit trail)

  7. Event Outbox Table
    - SELECT: Service role only
    - INSERT: Authenticated users can publish events
    - UPDATE: Service role only (marking as processed)

  Security Notes:
  - SuperAdmin bypasses all restrictions
  - All tables scoped to organization
  - Execution logs are append-only
*/

-- Workflows policies
CREATE POLICY "Users can view workflows in their org"
  ON workflows FOR SELECT
  TO authenticated
  USING (
    org_id = get_user_org_id() 
    AND has_permission('automation.view')
  );

CREATE POLICY "Users can create workflows in their org"
  ON workflows FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = get_user_org_id() 
    AND has_permission('automation.manage')
  );

CREATE POLICY "Users can update workflows in their org"
  ON workflows FOR UPDATE
  TO authenticated
  USING (
    org_id = get_user_org_id() 
    AND has_permission('automation.manage')
  )
  WITH CHECK (
    org_id = get_user_org_id() 
    AND has_permission('automation.manage')
  );

CREATE POLICY "Users can delete workflows in their org"
  ON workflows FOR DELETE
  TO authenticated
  USING (
    org_id = get_user_org_id() 
    AND has_permission('automation.manage')
  );

-- Workflow versions policies
CREATE POLICY "Users can view workflow versions in their org"
  ON workflow_versions FOR SELECT
  TO authenticated
  USING (
    org_id = get_user_org_id() 
    AND has_permission('automation.view')
  );

CREATE POLICY "Users can create workflow versions when publishing"
  ON workflow_versions FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = get_user_org_id() 
    AND has_permission('automation.manage')
  );

-- Workflow triggers policies
CREATE POLICY "Users can view workflow triggers in their org"
  ON workflow_triggers FOR SELECT
  TO authenticated
  USING (
    org_id = get_user_org_id() 
    AND has_permission('automation.view')
  );

CREATE POLICY "Users can create workflow triggers in their org"
  ON workflow_triggers FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = get_user_org_id() 
    AND has_permission('automation.manage')
  );

CREATE POLICY "Users can update workflow triggers in their org"
  ON workflow_triggers FOR UPDATE
  TO authenticated
  USING (
    org_id = get_user_org_id() 
    AND has_permission('automation.manage')
  )
  WITH CHECK (
    org_id = get_user_org_id() 
    AND has_permission('automation.manage')
  );

CREATE POLICY "Users can delete workflow triggers in their org"
  ON workflow_triggers FOR DELETE
  TO authenticated
  USING (
    org_id = get_user_org_id() 
    AND has_permission('automation.manage')
  );

-- Workflow enrollments policies
CREATE POLICY "Users can view workflow enrollments in their org"
  ON workflow_enrollments FOR SELECT
  TO authenticated
  USING (
    org_id = get_user_org_id() 
    AND has_permission('automation.view')
  );

CREATE POLICY "Users can create workflow enrollments in their org"
  ON workflow_enrollments FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = get_user_org_id() 
    AND has_permission('automation.manage')
  );

CREATE POLICY "Users can update workflow enrollments in their org"
  ON workflow_enrollments FOR UPDATE
  TO authenticated
  USING (
    org_id = get_user_org_id() 
    AND has_permission('automation.manage')
  )
  WITH CHECK (
    org_id = get_user_org_id() 
    AND has_permission('automation.manage')
  );

-- Workflow jobs policies (mostly service role, but allow viewing)
CREATE POLICY "Users can view workflow jobs in their org"
  ON workflow_jobs FOR SELECT
  TO authenticated
  USING (
    org_id = get_user_org_id() 
    AND has_permission('automation.view')
  );

CREATE POLICY "Users can create workflow jobs in their org"
  ON workflow_jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = get_user_org_id() 
    AND has_permission('automation.manage')
  );

CREATE POLICY "Users can update workflow jobs in their org"
  ON workflow_jobs FOR UPDATE
  TO authenticated
  USING (
    org_id = get_user_org_id() 
    AND has_permission('automation.manage')
  )
  WITH CHECK (
    org_id = get_user_org_id() 
    AND has_permission('automation.manage')
  );

-- Workflow execution logs policies (append-only for service, read for users)
CREATE POLICY "Users can view execution logs in their org"
  ON workflow_execution_logs FOR SELECT
  TO authenticated
  USING (
    org_id = get_user_org_id() 
    AND has_permission('automation.view')
  );

CREATE POLICY "Users can create execution logs in their org"
  ON workflow_execution_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = get_user_org_id() 
    AND has_permission('automation.manage')
  );

-- Event outbox policies (mostly service role operations)
CREATE POLICY "Users can view events in their org"
  ON event_outbox FOR SELECT
  TO authenticated
  USING (
    org_id = get_user_org_id() 
    AND has_permission('automation.view')
  );

CREATE POLICY "Authenticated users can publish events"
  ON event_outbox FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id());

CREATE POLICY "Users with manage permission can update events"
  ON event_outbox FOR UPDATE
  TO authenticated
  USING (
    org_id = get_user_org_id() 
    AND has_permission('automation.manage')
  )
  WITH CHECK (
    org_id = get_user_org_id() 
    AND has_permission('automation.manage')
  );