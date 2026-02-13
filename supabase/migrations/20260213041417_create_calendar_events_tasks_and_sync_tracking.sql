/*
  # Calendar Events, Tasks, and Sync Tracking

  1. New Tables
    - `calendar_events` - Standalone calendar events (meetings, all-hands, etc.)
      - `id` (uuid, primary key)
      - `org_id` (uuid, FK to organizations)
      - `calendar_id` (uuid, FK to calendars)
      - `user_id` (uuid, FK to users - creator/owner)
      - `title` (text)
      - `description` (text, nullable)
      - `location` (text, nullable)
      - `start_at_utc` (timestamptz)
      - `end_at_utc` (timestamptz)
      - `all_day` (boolean)
      - `timezone` (text)
      - `attendees` (jsonb - array of {email, name, responseStatus})
      - `google_meet_link` (text, nullable)
      - `color` (text, nullable - for visual categorization)
      - `status` (text - confirmed/tentative/cancelled)

    - `calendar_tasks` - Calendar tasks with due dates
      - `id` (uuid, primary key)
      - `org_id` (uuid, FK to organizations)
      - `calendar_id` (uuid, FK to calendars)
      - `user_id` (uuid, FK to users - assignee)
      - `title` (text)
      - `description` (text, nullable)
      - `due_at_utc` (timestamptz)
      - `duration_minutes` (integer, default 30)
      - `completed` (boolean)
      - `completed_at` (timestamptz, nullable)
      - `priority` (text - low/medium/high)
      - `status` (text - pending/in_progress/completed)

    - `blocked_slot_sync` - Sync tracking for blocked slots to Google
      - Same structure as appointment_sync

    - `calendar_event_sync` - Sync tracking for calendar events to Google
      - Same structure as appointment_sync

    - `calendar_task_sync` - Sync tracking for calendar tasks to Google
      - Same structure as appointment_sync

  2. Modified Tables
    - `appointment_sync` - Add user_id column for Google connection lookup

  3. Security
    - Enable RLS on all new tables
    - Policies: users can access data within their org based on role
*/

-- Add user_id to appointment_sync for Google connection lookup
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointment_sync' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE appointment_sync ADD COLUMN user_id uuid REFERENCES users(id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointment_sync' AND column_name = 'google_calendar_id'
  ) THEN
    ALTER TABLE appointment_sync ADD COLUMN google_calendar_id text DEFAULT 'primary';
  END IF;
END $$;

-- Calendar Events table
CREATE TABLE IF NOT EXISTS calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  calendar_id uuid NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  title text NOT NULL,
  description text,
  location text,
  start_at_utc timestamptz NOT NULL,
  end_at_utc timestamptz NOT NULL,
  all_day boolean NOT NULL DEFAULT false,
  timezone text NOT NULL DEFAULT 'UTC',
  attendees jsonb DEFAULT '[]'::jsonb,
  google_meet_link text,
  color text,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'tentative', 'cancelled')),
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_calendar_events_org_id ON calendar_events(org_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_calendar_id ON calendar_events(calendar_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_at ON calendar_events(start_at_utc);
CREATE INDEX IF NOT EXISTS idx_calendar_events_org_user_time ON calendar_events(org_id, user_id, start_at_utc);

CREATE POLICY "Users can view calendar events in their org"
  ON calendar_events FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can create calendar events in their org"
  ON calendar_events FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can update own calendar events"
  ON calendar_events FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR org_id IN (
      SELECT u.organization_id FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = auth.uid() AND r.name IN ('SuperAdmin', 'Admin')
    )
  )
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can delete own calendar events"
  ON calendar_events FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR org_id IN (
      SELECT u.organization_id FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = auth.uid() AND r.name IN ('SuperAdmin', 'Admin')
    )
  );

-- Calendar Tasks table
CREATE TABLE IF NOT EXISTS calendar_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  calendar_id uuid NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  title text NOT NULL,
  description text,
  due_at_utc timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 30,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE calendar_tasks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_calendar_tasks_org_id ON calendar_tasks(org_id);
CREATE INDEX IF NOT EXISTS idx_calendar_tasks_user_id ON calendar_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_tasks_calendar_id ON calendar_tasks(calendar_id);
CREATE INDEX IF NOT EXISTS idx_calendar_tasks_due_at ON calendar_tasks(due_at_utc);
CREATE INDEX IF NOT EXISTS idx_calendar_tasks_org_user_due ON calendar_tasks(org_id, user_id, due_at_utc);

CREATE POLICY "Users can view calendar tasks in their org"
  ON calendar_tasks FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can create calendar tasks in their org"
  ON calendar_tasks FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can update own calendar tasks"
  ON calendar_tasks FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR org_id IN (
      SELECT u.organization_id FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = auth.uid() AND r.name IN ('SuperAdmin', 'Admin')
    )
  )
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can delete own calendar tasks"
  ON calendar_tasks FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR org_id IN (
      SELECT u.organization_id FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = auth.uid() AND r.name IN ('SuperAdmin', 'Admin')
    )
  );

-- Blocked Slot Sync tracking
CREATE TABLE IF NOT EXISTS blocked_slot_sync (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  blocked_slot_id uuid NOT NULL REFERENCES blocked_slots(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id),
  provider text NOT NULL DEFAULT 'google' CHECK (provider IN ('google')),
  external_event_id text,
  google_calendar_id text DEFAULT 'primary',
  sync_status text NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('synced', 'pending', 'failed')),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(blocked_slot_id, provider)
);

ALTER TABLE blocked_slot_sync ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view blocked slot sync in their org"
  ON blocked_slot_sync FOR SELECT TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert blocked slot sync in their org"
  ON blocked_slot_sync FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update blocked slot sync in their org"
  ON blocked_slot_sync FOR UPDATE TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()))
  WITH CHECK (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete blocked slot sync in their org"
  ON blocked_slot_sync FOR DELETE TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

-- Calendar Event Sync tracking
CREATE TABLE IF NOT EXISTS calendar_event_sync (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  calendar_event_id uuid NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id),
  provider text NOT NULL DEFAULT 'google' CHECK (provider IN ('google')),
  external_event_id text,
  google_calendar_id text DEFAULT 'primary',
  sync_status text NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('synced', 'pending', 'failed')),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(calendar_event_id, provider)
);

ALTER TABLE calendar_event_sync ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view calendar event sync in their org"
  ON calendar_event_sync FOR SELECT TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert calendar event sync in their org"
  ON calendar_event_sync FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update calendar event sync in their org"
  ON calendar_event_sync FOR UPDATE TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()))
  WITH CHECK (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete calendar event sync in their org"
  ON calendar_event_sync FOR DELETE TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

-- Calendar Task Sync tracking
CREATE TABLE IF NOT EXISTS calendar_task_sync (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  calendar_task_id uuid NOT NULL REFERENCES calendar_tasks(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id),
  provider text NOT NULL DEFAULT 'google' CHECK (provider IN ('google')),
  external_event_id text,
  google_calendar_id text DEFAULT 'primary',
  sync_status text NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('synced', 'pending', 'failed')),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(calendar_task_id, provider)
);

ALTER TABLE calendar_task_sync ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view calendar task sync in their org"
  ON calendar_task_sync FOR SELECT TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert calendar task sync in their org"
  ON calendar_task_sync FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update calendar task sync in their org"
  ON calendar_task_sync FOR UPDATE TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()))
  WITH CHECK (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete calendar task sync in their org"
  ON calendar_task_sync FOR DELETE TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));
