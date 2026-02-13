/*
  # Add default value for access_role on google_calendar_list

  1. Modified Tables
    - `google_calendar_list`
      - `access_role` column now defaults to 'owner' instead of requiring explicit value
  
  2. Notes
    - This fixes calendar sync failures where the upsert was missing the access_role field
*/

ALTER TABLE google_calendar_list ALTER COLUMN access_role SET DEFAULT 'owner';
