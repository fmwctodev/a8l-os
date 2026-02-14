/*
  # Calendar 2-Way Sync Infrastructure (GHL-style)

  1. New Tables
    - `calendar_event_map` - Backbone linking CRM appointments to Google Calendar events
      - `id` (uuid, primary key)
      - `org_id` (uuid, FK to organizations)
      - `connection_id` (uuid, FK to google_calendar_connections)
      - `user_id` (uuid, FK to users)
      - `appointment_id` (uuid, nullable FK to appointments)
      - `calendar_id` (text, Google calendar ID)
      - `google_event_id` (text)
      - `ical_uid` (text)
      - `etag` (text)
      - `extended_properties` (jsonb)
      - `last_google_updated_at` (timestamptz)
      - `last_crm_updated_at` (timestamptz)
      - `sync_direction` (text)
      - `sync_status` (text)
      - `is_deleted` (boolean)
    - `calendar_sync_logs` - Debug/observability logs for sync operations
      - `id` (uuid, primary key)
      - `org_id` (uuid, FK to organizations)
      - `connection_id` (uuid, FK to google_calendar_connections)
      - `calendar_id` (text)
      - `job_id` (uuid)
      - `level` (text - debug/info/warn/error)
      - `message` (text)
      - `meta` (jsonb)

  2. Modified Tables
    - `google_calendar_events` - Add etag + extended_properties columns
    - `google_calendar_connections` - Add scopes column
    - `appointments` - Add location + google_event_id columns

  3. Security
    - Enable RLS on all new tables
    - Users can view data in their org
    - Service role has full access for background sync jobs
*/

-- calendar_event_map: the backbone for 2-way sync
CREATE TABLE IF NOT EXISTS calendar_event_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES google_calendar_connections(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  calendar_id text NOT NULL DEFAULT 'primary',
  google_event_id text NOT NULL,
  ical_uid text,
  etag text,
  extended_properties jsonb,
  last_google_updated_at timestamptz,
  last_crm_updated_at timestamptz,
  sync_direction text NOT NULL DEFAULT 'bidirectional'
    CHECK (sync_direction IN ('to_google', 'from_google', 'bidirectional')),
  sync_status text NOT NULL DEFAULT 'synced'
    CHECK (sync_status IN ('synced', 'pending', 'conflict', 'error')),
  last_error text,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_event_map_google_event
  ON calendar_event_map(connection_id, google_event_id) WHERE NOT is_deleted;
CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_event_map_appointment
  ON calendar_event_map(connection_id, appointment_id)
  WHERE appointment_id IS NOT NULL AND NOT is_deleted;

CREATE INDEX IF NOT EXISTS idx_calendar_event_map_org ON calendar_event_map(org_id);
CREATE INDEX IF NOT EXISTS idx_calendar_event_map_user ON calendar_event_map(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_event_map_connection ON calendar_event_map(connection_id);
CREATE INDEX IF NOT EXISTS idx_calendar_event_map_appointment_id
  ON calendar_event_map(appointment_id) WHERE appointment_id IS NOT NULL;

ALTER TABLE calendar_event_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view calendar event map in their org"
  ON calendar_event_map FOR SELECT TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert calendar event map in their org"
  ON calendar_event_map FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update calendar event map in their org"
  ON calendar_event_map FOR UPDATE TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()))
  WITH CHECK (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete calendar event map in their org"
  ON calendar_event_map FOR DELETE TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

-- calendar_sync_logs: observability
CREATE TABLE IF NOT EXISTS calendar_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES google_calendar_connections(id) ON DELETE CASCADE,
  calendar_id text,
  job_id uuid,
  level text NOT NULL DEFAULT 'info' CHECK (level IN ('debug', 'info', 'warn', 'error')),
  message text NOT NULL,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_sync_logs_connection
  ON calendar_sync_logs(connection_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calendar_sync_logs_level
  ON calendar_sync_logs(level, created_at DESC);

ALTER TABLE calendar_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sync logs in their org"
  ON calendar_sync_logs FOR SELECT TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert sync logs in their org"
  ON calendar_sync_logs FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

-- Add etag and extended_properties to google_calendar_events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'google_calendar_events' AND column_name = 'etag'
  ) THEN
    ALTER TABLE google_calendar_events ADD COLUMN etag text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'google_calendar_events' AND column_name = 'extended_properties'
  ) THEN
    ALTER TABLE google_calendar_events ADD COLUMN extended_properties jsonb;
  END IF;
END $$;

-- Add scopes to google_calendar_connections
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'google_calendar_connections' AND column_name = 'scopes'
  ) THEN
    ALTER TABLE google_calendar_connections ADD COLUMN scopes text;
  END IF;
END $$;

-- Add location + google_event_id to appointments for reverse mapping
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'location'
  ) THEN
    ALTER TABLE appointments ADD COLUMN location text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'google_event_id'
  ) THEN
    ALTER TABLE appointments ADD COLUMN google_event_id text;
  END IF;
END $$;
