/*
  # Fix Google integration settings_path values

  1. Modified Tables
    - `integrations` - Update settings_path for Google services

  2. Changes
    - `google_workspace`: Set settings_path to /settings/profile?tab=connected-accounts
      (was NULL, causing the broken generic OAuth panel to open)
    - `gmail`: Set settings_path to /settings/profile?tab=connected-accounts
      (was /settings/integrations?tab=connected, creating circular navigation)
    - `google_calendar`: Already correct (/settings/calendars), no change needed

  3. Notes
    - These redirects send users to the working standalone Google OAuth flow
      instead of the generic integrations-connect flow
*/

UPDATE integrations
SET settings_path = '/settings/profile?tab=connected-accounts',
    updated_at = now()
WHERE key = 'google_workspace';

UPDATE integrations
SET settings_path = '/settings/profile?tab=connected-accounts',
    updated_at = now()
WHERE key = 'gmail';
