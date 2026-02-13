/*
  # Add team visibility RLS policies for Google Calendar events

  1. Changes
    - Add SELECT policy for SuperAdmin/Admin users to view all org events
    - Add SELECT policy for Manager users to view events from their department members
    - Add composite index on (org_id, user_id, start_time) for efficient team queries

  2. Security
    - Admins can view all events within their organization
    - Managers can view events from users in their same department
    - Regular users still only see their own events (existing policy)
*/

CREATE POLICY "Admins can view all org calendar events"
  ON google_calendar_events
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT u.id FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.organization_id = google_calendar_events.org_id
      AND r.name IN ('SuperAdmin', 'Admin')
    )
  );

CREATE POLICY "Managers can view department calendar events"
  ON google_calendar_events
  FOR SELECT
  TO authenticated
  USING (
    google_calendar_events.user_id IN (
      SELECT u2.id FROM users u2
      WHERE u2.department_id = (
        SELECT u1.department_id FROM users u1
        JOIN roles r ON r.id = u1.role_id
        WHERE u1.id = auth.uid()
        AND r.name = 'Manager'
        AND u1.department_id IS NOT NULL
      )
    )
  );

CREATE INDEX IF NOT EXISTS idx_google_calendar_events_org_user_time
  ON google_calendar_events (org_id, user_id, start_time);
