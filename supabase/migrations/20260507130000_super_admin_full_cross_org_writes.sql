/*
  # SuperAdmin: full permissions + cross-org write capability

  Two compounding issues blocked SuperAdmin from "every function in
  every module in both orgs":

  ## Issue 1 — SuperAdmin role missing 7 permissions Admin had

  An audit of role_permissions showed SuperAdmin had only 186
  permissions while Admin had 190. The gap (7 permissions Admin had
  that SuperAdmin lacked):
    - reporting.ai.query
    - reputation.analytics.view
    - reputation.providers.manage
    - reputation.reply
    - reputation.request
    - reputation.spam.manage
    - team_messaging.manage

  Likely an oversight when those modules' permissions were seeded.
  Backfill: grant SuperAdmin every permission Admin has.

  ## Issue 2 — Inline `org_id IN (SELECT users.organization_id ...)` policies

  Several tables had INSERT/UPDATE/DELETE policies of the form:
    org_id IN (SELECT u.organization_id FROM users u WHERE u.id = auth.uid())

  This subquery returns the user's *home* `organization_id` directly
  from the row, bypassing our unified helper functions. So when
  SuperAdmin pivoted active org to BuilderLync, RLS still locked
  writes to their HOME org (Autom8ion Lab) — they could VIEW BL
  data but not create/update/delete in it.

  Affected tables:
    - calendar_events (INSERT, UPDATE, DELETE)
    - contracts (INSERT, UPDATE, DELETE)
    - projects (INSERT, UPDATE, DELETE)
    - project_tasks (INSERT, UPDATE, DELETE)
    - project_change_requests (INSERT, UPDATE)
    - project_support_tickets (INSERT, UPDATE)

  Fix: rewrite each policy to use `org_id = get_auth_user_org_id()`,
  which now honors `super_admin_active_org_id`. Public-token policies
  on project_change_requests and project_support_tickets are
  preserved (untouched).

  ## After

  - SuperAdmin in any active org context can read AND write everywhere
    that org-scoped policies allow.
  - Regular users / non-pivoted SuperAdmins are unchanged
    (active_org === home_org for them).
  - Hierarchy-level / role gates inside policies (e.g.
    "Admins can delete projects") still apply; only the org pivot was
    fixed.
*/

-- 1) Backfill SuperAdmin permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT
  (SELECT id FROM roles WHERE name = 'SuperAdmin'),
  p.id
FROM permissions p
JOIN role_permissions rp_a ON rp_a.permission_id = p.id
JOIN roles ra ON ra.id = rp_a.role_id AND ra.name = 'Admin'
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions rp_s
  JOIN roles rs ON rs.id = rp_s.role_id AND rs.name = 'SuperAdmin'
  WHERE rp_s.permission_id = p.id
)
ON CONFLICT DO NOTHING;

-- 2) Rewrite inline org-scope policies on affected tables

-- calendar_events
DROP POLICY IF EXISTS "Users can create calendar events in their org" ON calendar_events;
CREATE POLICY "Users can create calendar events in their org"
  ON calendar_events FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

DROP POLICY IF EXISTS "Users can update own calendar events" ON calendar_events;
CREATE POLICY "Users can update own calendar events"
  ON calendar_events FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      org_id = get_auth_user_org_id()
      AND EXISTS (
        SELECT 1 FROM users u JOIN roles r ON r.id = u.role_id
        WHERE u.id = auth.uid() AND r.name IN ('SuperAdmin','Admin')
      )
    )
  )
  WITH CHECK (org_id = get_auth_user_org_id());

DROP POLICY IF EXISTS "Users can delete own calendar events" ON calendar_events;
CREATE POLICY "Users can delete own calendar events"
  ON calendar_events FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      org_id = get_auth_user_org_id()
      AND EXISTS (
        SELECT 1 FROM users u JOIN roles r ON r.id = u.role_id
        WHERE u.id = auth.uid() AND r.name IN ('SuperAdmin','Admin')
      )
    )
  );

-- contracts
DROP POLICY IF EXISTS "Org members can create contracts" ON contracts;
CREATE POLICY "Org members can create contracts"
  ON contracts FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

DROP POLICY IF EXISTS "Org members can update contracts" ON contracts;
CREATE POLICY "Org members can update contracts"
  ON contracts FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

DROP POLICY IF EXISTS "Org members can delete contracts" ON contracts;
CREATE POLICY "Org members can delete contracts"
  ON contracts FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- projects
DROP POLICY IF EXISTS "Org members can create projects" ON projects;
CREATE POLICY "Org members can create projects"
  ON projects FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

DROP POLICY IF EXISTS "Org members can update projects" ON projects;
CREATE POLICY "Org members can update projects"
  ON projects FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

DROP POLICY IF EXISTS "Admins can delete projects" ON projects;
CREATE POLICY "Admins can delete projects"
  ON projects FOR DELETE TO authenticated
  USING (
    org_id = get_auth_user_org_id()
    AND EXISTS (
      SELECT 1 FROM users u JOIN roles r ON r.id = u.role_id
      WHERE u.id = auth.uid() AND r.hierarchy_level <= 2
    )
  );

-- project_tasks
DROP POLICY IF EXISTS "Org members can create project tasks" ON project_tasks;
CREATE POLICY "Org members can create project tasks"
  ON project_tasks FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

DROP POLICY IF EXISTS "Org members can update project tasks" ON project_tasks;
CREATE POLICY "Org members can update project tasks"
  ON project_tasks FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

DROP POLICY IF EXISTS "Task creator or admin can delete project tasks" ON project_tasks;
CREATE POLICY "Task creator or admin can delete project tasks"
  ON project_tasks FOR DELETE TO authenticated
  USING (
    org_id = get_auth_user_org_id()
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM users u JOIN roles r ON r.id = u.role_id
        WHERE u.id = auth.uid() AND r.hierarchy_level <= 2
      )
    )
  );

-- project_change_requests (public-token policies preserved)
DROP POLICY IF EXISTS "Org members can create change requests" ON project_change_requests;
CREATE POLICY "Org members can create change requests"
  ON project_change_requests FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

DROP POLICY IF EXISTS "Org members can update change requests" ON project_change_requests;
CREATE POLICY "Org members can update change requests"
  ON project_change_requests FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

-- project_support_tickets (public-token policies preserved)
DROP POLICY IF EXISTS "Org members can create support tickets" ON project_support_tickets;
CREATE POLICY "Org members can create support tickets"
  ON project_support_tickets FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

DROP POLICY IF EXISTS "Org members can update support tickets" ON project_support_tickets;
CREATE POLICY "Org members can update support tickets"
  ON project_support_tickets FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());
