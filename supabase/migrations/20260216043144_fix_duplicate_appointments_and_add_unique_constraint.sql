/*
  # Fix Duplicate Appointments and Add Unique Constraint

  1. Cleanup Actions
    - Delete duplicate appointments with same google_event_id
    - Keep only the oldest appointment (earliest created_at) for each unique google_event_id
    - Clean up orphaned calendar_event_map entries pointing to deleted appointments

  2. Schema Changes
    - Add partial unique index on appointments table: UNIQUE(org_id, google_event_id) WHERE google_event_id IS NOT NULL
    - This prevents future duplicate appointments from being created for the same Google Calendar event

  3. Statistics
    - Before cleanup: ~2,609 appointments total, 155 unique google_event_ids
    - Expected to remove: ~2,454 duplicate appointment records
    - After cleanup: 155 appointments (one per unique Google event)

  ## Important Notes
  - This migration is safe to run - it only removes duplicates and adds a constraint
  - The deduplication logic has been fixed in the edge functions to prevent future duplicates
  - All edge functions have been redeployed with corrected JWT validation
*/

-- Step 1: Identify and delete duplicate appointments, keeping only the oldest one
-- Use a CTE to find the IDs to keep (oldest appointment per google_event_id)
WITH appointments_to_keep AS (
  SELECT DISTINCT ON (org_id, google_event_id) id
  FROM appointments
  WHERE google_event_id IS NOT NULL
  ORDER BY org_id, google_event_id, created_at ASC
),
duplicate_appointments AS (
  SELECT id
  FROM appointments
  WHERE google_event_id IS NOT NULL
    AND id NOT IN (SELECT id FROM appointments_to_keep)
)
DELETE FROM appointments
WHERE id IN (SELECT id FROM duplicate_appointments);

-- Step 2: Clean up orphaned calendar_event_map entries
-- These are map entries pointing to appointments that no longer exist
DELETE FROM calendar_event_map
WHERE appointment_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM appointments
    WHERE appointments.id = calendar_event_map.appointment_id
  );

-- Step 3: Add partial unique index to prevent future duplicates
-- This ensures each Google Calendar event can only create one appointment per organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_unique_google_event
  ON appointments(org_id, google_event_id)
  WHERE google_event_id IS NOT NULL;
