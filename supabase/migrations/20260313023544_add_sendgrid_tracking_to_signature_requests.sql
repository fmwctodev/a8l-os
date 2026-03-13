/*
  # Add SendGrid Tracking Columns to Proposal Signature Requests

  1. Modified Tables
    - `proposal_signature_requests`
      - `send_status` (text, default 'pending') - Email delivery status: pending, sent, or failed
      - `sendgrid_message_id` (text, nullable) - SendGrid message ID for delivery event correlation
      - `send_error` (text, nullable) - Error message if email delivery failed
      - `last_sent_at` (timestamptz, nullable) - When the signature request email was last sent

  2. Indexes
    - Index on `send_status` for querying failed sends

  3. Important Notes
    - These columns track whether the SendGrid email was actually delivered
    - The `sendgrid_message_id` enables correlation with SendGrid webhook delivery events
    - The `send_error` stores the failure reason so it can be surfaced in the UI
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proposal_signature_requests' AND column_name = 'send_status'
  ) THEN
    ALTER TABLE proposal_signature_requests ADD COLUMN send_status text NOT NULL DEFAULT 'pending';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'proposal_sig_req_send_status_check'
  ) THEN
    ALTER TABLE proposal_signature_requests ADD CONSTRAINT proposal_sig_req_send_status_check
      CHECK (send_status IN ('pending', 'sent', 'failed'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proposal_signature_requests' AND column_name = 'sendgrid_message_id'
  ) THEN
    ALTER TABLE proposal_signature_requests ADD COLUMN sendgrid_message_id text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proposal_signature_requests' AND column_name = 'send_error'
  ) THEN
    ALTER TABLE proposal_signature_requests ADD COLUMN send_error text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proposal_signature_requests' AND column_name = 'last_sent_at'
  ) THEN
    ALTER TABLE proposal_signature_requests ADD COLUMN last_sent_at timestamptz;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_proposal_sig_req_send_status
  ON proposal_signature_requests(send_status)
  WHERE send_status = 'failed';
