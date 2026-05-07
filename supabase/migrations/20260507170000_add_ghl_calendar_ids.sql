/*
  # Add GHL external IDs for calendars + appointment types

  Mirrors 20260507160000 (contacts/opportunities/appointments) so the
  ghl-import calendars phase can be idempotent. One GHL "calendar" maps
  to one of our calendars + one default appointment_type, both keyed
  by the GHL calendar's UUID.
*/

ALTER TABLE calendars ADD COLUMN IF NOT EXISTS ghl_calendar_id text;
CREATE INDEX IF NOT EXISTS idx_calendars_ghl_id
  ON calendars(org_id, ghl_calendar_id) WHERE ghl_calendar_id IS NOT NULL;

ALTER TABLE appointment_types ADD COLUMN IF NOT EXISTS ghl_calendar_id text;
CREATE INDEX IF NOT EXISTS idx_appointment_types_ghl_calendar
  ON appointment_types(org_id, ghl_calendar_id) WHERE ghl_calendar_id IS NOT NULL;
