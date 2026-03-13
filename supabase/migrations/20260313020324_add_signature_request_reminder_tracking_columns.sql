/*
  # Add Reminder Tracking Columns to Signature Requests

  1. Modified Tables
    - `proposal_signature_requests`
      - `reminder_count` (integer, default 0) - tracks how many reminders sent
      - `last_reminder_sent_at` (timestamptz) - when last reminder was sent

  2. Important Notes
    - These columns support the signature-reminder-scheduler edge function
    - Max 3 reminders with at least 48h between each
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proposal_signature_requests' AND column_name = 'reminder_count'
  ) THEN
    ALTER TABLE proposal_signature_requests ADD COLUMN reminder_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proposal_signature_requests' AND column_name = 'last_reminder_sent_at'
  ) THEN
    ALTER TABLE proposal_signature_requests ADD COLUMN last_reminder_sent_at timestamptz;
  END IF;
END $$;
