/*
  # Create RLS Policies for Calendars Module

  1. Calendars Table Policies
    - Users can view calendars in their organization
    - Users can manage calendars they own or have admin rights to

  2. Calendar Members Table Policies
    - Users can view members of calendars they can access
    - Admins can manage calendar members

  3. Appointment Types Table Policies
    - Users can view appointment types for calendars they can access
    - Calendar owners/admins can manage appointment types

  4. Availability Rules Table Policies
    - Users can view availability for calendars they can access
    - Users can manage their own availability rules

  5. Appointments Table Policies
    - Users can view appointments they're assigned to or have permission
    - Users can create appointments on calendars they have access to

  6. Google Calendar Connections Table Policies
    - Users can only access their own Google connections

  7. Appointment Sync Table Policies
    - Users can view sync status for appointments they can access
*/

-- Helper function to get user's role name
CREATE OR REPLACE FUNCTION get_user_role_name(p_user_id uuid)
RETURNS text AS $$
  SELECT r.name FROM users u
  JOIN roles r ON r.id = u.role_id
  WHERE u.id = p_user_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function to check if user has calendar permission
CREATE OR REPLACE FUNCTION user_has_calendar_permission(
  p_user_id uuid,
  p_calendar_id uuid,
  p_permission text
) RETURNS boolean AS $$
DECLARE
  v_calendar_org_id uuid;
  v_calendar_owner_id uuid;
  v_calendar_department_id uuid;
  v_user_org_id uuid;
  v_user_department_id uuid;
  v_user_role text;
BEGIN
  SELECT org_id, owner_user_id, department_id 
  INTO v_calendar_org_id, v_calendar_owner_id, v_calendar_department_id
  FROM calendars WHERE id = p_calendar_id;

  SELECT organization_id, department_id
  INTO v_user_org_id, v_user_department_id
  FROM users WHERE id = p_user_id;

  v_user_role := get_user_role_name(p_user_id);

  IF v_calendar_org_id != v_user_org_id THEN
    RETURN false;
  END IF;

  IF v_user_role IN ('SuperAdmin', 'Admin') THEN
    RETURN true;
  END IF;

  IF v_calendar_owner_id = p_user_id THEN
    RETURN true;
  END IF;

  IF p_permission = 'view' THEN
    IF v_calendar_department_id IS NULL OR v_calendar_department_id = v_user_department_id THEN
      RETURN true;
    END IF;
    IF EXISTS (SELECT 1 FROM calendar_members WHERE calendar_id = p_calendar_id AND user_id = p_user_id) THEN
      RETURN true;
    END IF;
  END IF;

  IF p_permission = 'manage' THEN
    IF v_user_role = 'Manager' AND v_calendar_department_id = v_user_department_id THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Calendars policies
CREATE POLICY "Users can view calendars in their org"
  ON calendars FOR SELECT
  TO authenticated
  USING (
    org_id = (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Admins can insert calendars"
  ON calendars FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND get_user_role_name(auth.uid()) IN ('SuperAdmin', 'Admin', 'Manager')
  );

CREATE POLICY "Calendar owners and admins can update calendars"
  ON calendars FOR UPDATE
  TO authenticated
  USING (
    user_has_calendar_permission(auth.uid(), id, 'manage')
  )
  WITH CHECK (
    user_has_calendar_permission(auth.uid(), id, 'manage')
  );

CREATE POLICY "Admins can delete calendars"
  ON calendars FOR DELETE
  TO authenticated
  USING (
    get_user_role_name(auth.uid()) IN ('SuperAdmin', 'Admin')
  );

-- Calendar members policies
CREATE POLICY "Users can view calendar members"
  ON calendar_members FOR SELECT
  TO authenticated
  USING (
    user_has_calendar_permission(auth.uid(), calendar_id, 'view')
  );

CREATE POLICY "Calendar managers can insert members"
  ON calendar_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_has_calendar_permission(auth.uid(), calendar_id, 'manage')
  );

CREATE POLICY "Calendar managers can update members"
  ON calendar_members FOR UPDATE
  TO authenticated
  USING (
    user_has_calendar_permission(auth.uid(), calendar_id, 'manage')
  )
  WITH CHECK (
    user_has_calendar_permission(auth.uid(), calendar_id, 'manage')
  );

CREATE POLICY "Calendar managers can delete members"
  ON calendar_members FOR DELETE
  TO authenticated
  USING (
    user_has_calendar_permission(auth.uid(), calendar_id, 'manage')
  );

-- Appointment types policies
CREATE POLICY "Users can view appointment types"
  ON appointment_types FOR SELECT
  TO authenticated
  USING (
    user_has_calendar_permission(auth.uid(), calendar_id, 'view')
  );

CREATE POLICY "Calendar managers can insert appointment types"
  ON appointment_types FOR INSERT
  TO authenticated
  WITH CHECK (
    user_has_calendar_permission(auth.uid(), calendar_id, 'manage')
  );

CREATE POLICY "Calendar managers can update appointment types"
  ON appointment_types FOR UPDATE
  TO authenticated
  USING (
    user_has_calendar_permission(auth.uid(), calendar_id, 'manage')
  )
  WITH CHECK (
    user_has_calendar_permission(auth.uid(), calendar_id, 'manage')
  );

CREATE POLICY "Calendar managers can delete appointment types"
  ON appointment_types FOR DELETE
  TO authenticated
  USING (
    user_has_calendar_permission(auth.uid(), calendar_id, 'manage')
  );

-- Availability rules policies
CREATE POLICY "Users can view availability rules"
  ON availability_rules FOR SELECT
  TO authenticated
  USING (
    user_has_calendar_permission(auth.uid(), calendar_id, 'view')
  );

CREATE POLICY "Users can insert their own availability"
  ON availability_rules FOR INSERT
  TO authenticated
  WITH CHECK (
    user_has_calendar_permission(auth.uid(), calendar_id, 'view')
    AND (user_id IS NULL OR user_id = auth.uid() OR user_has_calendar_permission(auth.uid(), calendar_id, 'manage'))
  );

CREATE POLICY "Users can update their own availability"
  ON availability_rules FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() OR user_has_calendar_permission(auth.uid(), calendar_id, 'manage')
  )
  WITH CHECK (
    user_id = auth.uid() OR user_has_calendar_permission(auth.uid(), calendar_id, 'manage')
  );

CREATE POLICY "Calendar managers can delete availability"
  ON availability_rules FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid() OR user_has_calendar_permission(auth.uid(), calendar_id, 'manage')
  );

-- Appointments policies
CREATE POLICY "Users can view appointments they have access to"
  ON appointments FOR SELECT
  TO authenticated
  USING (
    assigned_user_id = auth.uid()
    OR user_has_calendar_permission(auth.uid(), calendar_id, 'view')
  );

CREATE POLICY "Users can insert appointments"
  ON appointments FOR INSERT
  TO authenticated
  WITH CHECK (
    user_has_calendar_permission(auth.uid(), calendar_id, 'view')
  );

CREATE POLICY "Users can update appointments they manage"
  ON appointments FOR UPDATE
  TO authenticated
  USING (
    assigned_user_id = auth.uid()
    OR user_has_calendar_permission(auth.uid(), calendar_id, 'manage')
  )
  WITH CHECK (
    assigned_user_id = auth.uid()
    OR user_has_calendar_permission(auth.uid(), calendar_id, 'manage')
  );

CREATE POLICY "Calendar managers can delete appointments"
  ON appointments FOR DELETE
  TO authenticated
  USING (
    user_has_calendar_permission(auth.uid(), calendar_id, 'manage')
  );

-- Google calendar connections policies
CREATE POLICY "Users can view their own Google connections"
  ON google_calendar_connections FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own Google connections"
  ON google_calendar_connections FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own Google connections"
  ON google_calendar_connections FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own Google connections"
  ON google_calendar_connections FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Appointment sync policies
CREATE POLICY "Users can view sync status for their appointments"
  ON appointment_sync FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.id = appointment_id
      AND (a.assigned_user_id = auth.uid() OR user_has_calendar_permission(auth.uid(), a.calendar_id, 'view'))
    )
  );

CREATE POLICY "Users can insert sync records for their appointments"
  ON appointment_sync FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.id = appointment_id
      AND (a.assigned_user_id = auth.uid() OR user_has_calendar_permission(auth.uid(), a.calendar_id, 'manage'))
    )
  );

CREATE POLICY "Users can update sync records for their appointments"
  ON appointment_sync FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.id = appointment_id
      AND (a.assigned_user_id = auth.uid() OR user_has_calendar_permission(auth.uid(), a.calendar_id, 'manage'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.id = appointment_id
      AND (a.assigned_user_id = auth.uid() OR user_has_calendar_permission(auth.uid(), a.calendar_id, 'manage'))
    )
  );