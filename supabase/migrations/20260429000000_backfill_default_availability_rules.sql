/*
  Backfill default availability_rules for any calendar that doesn't have a
  calendar-level rule (user_id IS NULL).

  Why: a brand-new calendar has no slots until at least one availability_rules
  row exists. The Calendar Drawer wizard didn't seed one, leaving newly-created
  calendars with empty booking pages until an admin manually configured the
  Availability tab.

  This migration:
  - Inserts a default Mon-Fri 09:00-17:00 rule (the column DEFAULT) for each
    calendar that currently has no calendar-level rule.
  - Picks the calendar's existing user-level rule timezone if any, else
    'America/New_York'.
  - Idempotent: only inserts where missing.
*/

INSERT INTO availability_rules (org_id, calendar_id, user_id, timezone)
SELECT
  c.org_id,
  c.id,
  NULL,
  COALESCE(
    (SELECT ar.timezone
       FROM availability_rules ar
      WHERE ar.calendar_id = c.id
      ORDER BY ar.created_at ASC
      LIMIT 1),
    'America/New_York'
  )
FROM calendars c
WHERE NOT EXISTS (
  SELECT 1
  FROM availability_rules ar
  WHERE ar.calendar_id = c.id
    AND ar.user_id IS NULL
);
