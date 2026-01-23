/*
  # Enable Calendars Feature Flag

  1. Fix
    - Updates the calendars feature flag to enabled = true
    - This fixes the bug where the previous migration only updated the description
      but not the enabled status due to incorrect ON CONFLICT clause

  2. Result
    - Calendars module will now appear in the sidebar
    - Users with appropriate permissions can access the calendars functionality
*/

UPDATE feature_flags SET enabled = true WHERE key = 'calendars';