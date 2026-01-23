/*
  # Create Calendars and Booking Module Schema

  1. New Tables
    - `calendars`
      - `id` (uuid, primary key)
      - `org_id` (uuid, references organizations)
      - `type` (text, 'user' or 'team')
      - `name` (text)
      - `slug` (text, unique per org)
      - `department_id` (uuid, optional, references departments)
      - `owner_user_id` (uuid, optional, for user calendars)
      - `settings` (jsonb, assignment mode, last_assigned_index, etc.)
      - `created_at`, `updated_at`

    - `calendar_members`
      - `id` (uuid, primary key)
      - `calendar_id` (uuid, references calendars)
      - `user_id` (uuid, references users)
      - `weight` (int, for round-robin weighting)
      - `priority` (int, for priority-based assignment)
      - `active` (bool)
      - `created_at`

    - `appointment_types`
      - `id` (uuid, primary key)
      - `org_id` (uuid, references organizations)
      - `calendar_id` (uuid, references calendars)
      - `name` (text)
      - `slug` (text)
      - `duration_minutes` (int)
      - `location_type` (text)
      - `location_value` (jsonb)
      - `questions` (jsonb, custom form questions)
      - `slot_interval_minutes` (int)
      - `buffer_before_minutes` (int)
      - `buffer_after_minutes` (int)
      - `min_notice_minutes` (int)
      - `booking_window_days` (int)
      - `max_per_day` (int, optional)
      - `generate_google_meet` (bool)
      - `created_at`, `updated_at`

    - `availability_rules`
      - `id` (uuid, primary key)
      - `org_id` (uuid, references organizations)
      - `calendar_id` (uuid, references calendars)
      - `user_id` (uuid, optional, for per-user overrides)
      - `timezone` (text)
      - `rules` (jsonb, weekly schedule)
      - `overrides` (jsonb, date-specific overrides)
      - `created_at`, `updated_at`

    - `appointments`
      - `id` (uuid, primary key)
      - `org_id` (uuid, references organizations)
      - `calendar_id` (uuid, references calendars)
      - `appointment_type_id` (uuid, references appointment_types)
      - `contact_id` (uuid, references contacts)
      - `assigned_user_id` (uuid, references users)
      - `status` (text, 'scheduled' or 'canceled')
      - `start_at_utc` (timestamptz)
      - `end_at_utc` (timestamptz)
      - `visitor_timezone` (text)
      - `answers` (jsonb, form responses)
      - `source` (text, 'booking' or 'manual')
      - `google_meet_link` (text, optional)
      - `reschedule_token` (text, unique)
      - `cancel_token` (text, unique)
      - `notes` (text, optional)
      - `created_at`, `updated_at`, `canceled_at`

    - `google_calendar_connections`
      - `id` (uuid, primary key)
      - `org_id` (uuid, references organizations)
      - `user_id` (uuid, references users)
      - `access_token` (text, encrypted)
      - `refresh_token` (text, encrypted)
      - `token_expiry` (timestamptz)
      - `email` (text)
      - `selected_calendar_ids` (jsonb, array of calendar IDs)
      - `created_at`, `updated_at`

    - `appointment_sync`
      - `id` (uuid, primary key)
      - `org_id` (uuid, references organizations)
      - `appointment_id` (uuid, references appointments)
      - `provider` (text, 'google')
      - `external_event_id` (text)
      - `sync_status` (text, 'synced', 'pending', 'failed')
      - `last_error` (text, optional)
      - `created_at`, `updated_at`

  2. Indexes
    - appointments(start_at_utc)
    - appointments(assigned_user_id, start_at_utc)
    - appointments(calendar_id, start_at_utc)
    - appointment_types(calendar_id)
    - calendars(org_id, slug)
    - appointments(reschedule_token)
    - appointments(cancel_token)
*/

-- Calendars table
CREATE TABLE IF NOT EXISTS calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('user', 'team')),
  name text NOT NULL,
  slug text NOT NULL,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  settings jsonb NOT NULL DEFAULT '{"assignment_mode": "round_robin", "last_assigned_index": 0}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, slug),
  CONSTRAINT valid_calendar_type CHECK (
    (type = 'user' AND owner_user_id IS NOT NULL) OR
    (type = 'team' AND owner_user_id IS NULL)
  )
);

-- Calendar members table (for team calendars)
CREATE TABLE IF NOT EXISTS calendar_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id uuid NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weight int NOT NULL DEFAULT 1 CHECK (weight >= 1 AND weight <= 10),
  priority int NOT NULL DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(calendar_id, user_id)
);

-- Appointment types table
CREATE TABLE IF NOT EXISTS appointment_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  calendar_id uuid NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  duration_minutes int NOT NULL DEFAULT 30 CHECK (duration_minutes > 0),
  location_type text NOT NULL DEFAULT 'google_meet' CHECK (location_type IN ('phone', 'google_meet', 'zoom', 'in_person', 'custom')),
  location_value jsonb DEFAULT '{}'::jsonb,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  slot_interval_minutes int NOT NULL DEFAULT 15 CHECK (slot_interval_minutes > 0),
  buffer_before_minutes int NOT NULL DEFAULT 0 CHECK (buffer_before_minutes >= 0),
  buffer_after_minutes int NOT NULL DEFAULT 0 CHECK (buffer_after_minutes >= 0),
  min_notice_minutes int NOT NULL DEFAULT 60 CHECK (min_notice_minutes >= 0),
  booking_window_days int NOT NULL DEFAULT 30 CHECK (booking_window_days > 0),
  max_per_day int CHECK (max_per_day IS NULL OR max_per_day > 0),
  generate_google_meet boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(calendar_id, slug)
);

-- Availability rules table
CREATE TABLE IF NOT EXISTS availability_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  calendar_id uuid NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  timezone text NOT NULL DEFAULT 'America/New_York',
  rules jsonb NOT NULL DEFAULT '{
    "monday": [{"start": "09:00", "end": "17:00"}],
    "tuesday": [{"start": "09:00", "end": "17:00"}],
    "wednesday": [{"start": "09:00", "end": "17:00"}],
    "thursday": [{"start": "09:00", "end": "17:00"}],
    "friday": [{"start": "09:00", "end": "17:00"}],
    "saturday": [],
    "sunday": []
  }'::jsonb,
  overrides jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(calendar_id, user_id)
);

-- Appointments table
CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  calendar_id uuid NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  appointment_type_id uuid NOT NULL REFERENCES appointment_types(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  assigned_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'canceled', 'completed', 'no_show')),
  start_at_utc timestamptz NOT NULL,
  end_at_utc timestamptz NOT NULL,
  visitor_timezone text NOT NULL DEFAULT 'America/New_York',
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'booking' CHECK (source IN ('booking', 'manual')),
  google_meet_link text,
  reschedule_token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  cancel_token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  notes text,
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  canceled_at timestamptz,
  CONSTRAINT valid_time_range CHECK (end_at_utc > start_at_utc)
);

-- Google Calendar connections table
CREATE TABLE IF NOT EXISTS google_calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expiry timestamptz NOT NULL,
  email text NOT NULL,
  selected_calendar_ids jsonb NOT NULL DEFAULT '["primary"]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id)
);

-- Appointment sync table (for Google Calendar sync status)
CREATE TABLE IF NOT EXISTS appointment_sync (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'google' CHECK (provider IN ('google')),
  external_event_id text,
  sync_status text NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('synced', 'pending', 'failed')),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(appointment_id, provider)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_appointments_start_at ON appointments(start_at_utc);
CREATE INDEX IF NOT EXISTS idx_appointments_user_start ON appointments(assigned_user_id, start_at_utc);
CREATE INDEX IF NOT EXISTS idx_appointments_calendar_start ON appointments(calendar_id, start_at_utc);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_appointment_types_calendar ON appointment_types(calendar_id);
CREATE INDEX IF NOT EXISTS idx_calendars_org_slug ON calendars(org_id, slug);
CREATE INDEX IF NOT EXISTS idx_appointments_reschedule ON appointments(reschedule_token);
CREATE INDEX IF NOT EXISTS idx_appointments_cancel ON appointments(cancel_token);
CREATE INDEX IF NOT EXISTS idx_calendar_members_calendar ON calendar_members(calendar_id);
CREATE INDEX IF NOT EXISTS idx_availability_rules_calendar ON availability_rules(calendar_id);
CREATE INDEX IF NOT EXISTS idx_google_connections_user ON google_calendar_connections(user_id);

-- Enable RLS on all tables
ALTER TABLE calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_sync ENABLE ROW LEVEL SECURITY;

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_calendars_updated_at ON calendars;
CREATE TRIGGER update_calendars_updated_at
  BEFORE UPDATE ON calendars
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_appointment_types_updated_at ON appointment_types;
CREATE TRIGGER update_appointment_types_updated_at
  BEFORE UPDATE ON appointment_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_availability_rules_updated_at ON availability_rules;
CREATE TRIGGER update_availability_rules_updated_at
  BEFORE UPDATE ON availability_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_appointments_updated_at ON appointments;
CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_google_connections_updated_at ON google_calendar_connections;
CREATE TRIGGER update_google_connections_updated_at
  BEFORE UPDATE ON google_calendar_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_appointment_sync_updated_at ON appointment_sync;
CREATE TRIGGER update_appointment_sync_updated_at
  BEFORE UPDATE ON appointment_sync
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();