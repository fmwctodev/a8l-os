/*
  # Fix Calendar Cascade Delete RLS — All Child Tables

  ## Problem
  When an Admin user deletes a calendar, the explicit pre-deletion of child records
  fails because several tables have RLS DELETE policies that are too restrictive:
  
  - calendar_events: only allows deleting own events (user_id = auth.uid())
  - calendar_tasks: only allows deleting own tasks (user_id = auth.uid())
  
  Admins and SuperAdmins need to be able to delete all records in their org
  when performing a calendar deletion.

  ## Fix
  Update DELETE policies on calendar_events and calendar_tasks to allow
  org-level deletion for Admin and SuperAdmin roles (same pattern already
  used in those tables' existing policies, but extended to the DELETE operation).
*/

-- Fix calendar_events DELETE policy to allow org-level deletion for admins
DROP POLICY IF EXISTS "Users can delete own calendar events" ON calendar_events;

CREATE POLICY "Users can delete own calendar events"
  ON calendar_events FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR org_id IN (
      SELECT u.organization_id FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = auth.uid()
        AND r.name = ANY(ARRAY['SuperAdmin', 'Admin'])
    )
    OR org_id = get_auth_user_org_id()
  );

-- Fix calendar_tasks DELETE policy to allow org-level deletion for admins
DROP POLICY IF EXISTS "Users can delete own calendar tasks" ON calendar_tasks;

CREATE POLICY "Users can delete own calendar tasks"
  ON calendar_tasks FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR org_id IN (
      SELECT u.organization_id FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = auth.uid()
        AND r.name = ANY(ARRAY['SuperAdmin', 'Admin'])
    )
    OR org_id = get_auth_user_org_id()
  );
