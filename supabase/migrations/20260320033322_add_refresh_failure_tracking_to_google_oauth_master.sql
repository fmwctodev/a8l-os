/*
  # Add Refresh Failure Tracking to Google OAuth Master

  ## Summary
  Adds columns to track token refresh failures so the cron job can skip
  accounts with persistently bad refresh tokens instead of hammering Google
  with repeated failed requests.

  ## New Columns
  - `refresh_fail_count` (integer) - Number of consecutive refresh failures
  - `refresh_failed_at` (timestamptz) - When the last failure occurred

  ## Notes
  - Accounts with 5+ consecutive failures are skipped by the cron until
    the user manually reconnects (which resets the counter to 0)
  - A successful refresh resets fail_count back to 0
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'google_oauth_master' AND column_name = 'refresh_fail_count'
  ) THEN
    ALTER TABLE google_oauth_master ADD COLUMN refresh_fail_count integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'google_oauth_master' AND column_name = 'refresh_failed_at'
  ) THEN
    ALTER TABLE google_oauth_master ADD COLUMN refresh_failed_at timestamptz;
  END IF;
END $$;
