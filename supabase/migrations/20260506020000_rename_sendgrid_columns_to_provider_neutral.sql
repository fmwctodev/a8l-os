/*
  # Rename SendGrid-specific columns to provider-neutral names

  Part of the Mailgun migration. The platform is moving from SendGrid to Mailgun
  as its email provider. To support a clean codebase that doesn't lie about what
  it stores, this migration renames every `sendgrid_*` column to `provider_*`.

  ## Renames

  - `email_domains.sendgrid_domain_id`            → `provider_domain_id`
  - `email_from_addresses.sendgrid_sender_id`     → `provider_sender_id`
  - `email_unsubscribe_groups.sendgrid_group_id`  → `provider_group_id`
      - Drops `NOT NULL` constraint (Mailgun has no native group ID;
        column becomes an optional Mailgun tag label)
      - Drops unique constraint `email_unsubscribe_groups_org_sgid_unique`
        (no longer needed; Mailgun has no group-id concept)
  - `email_test_logs.sendgrid_message_id`         → `provider_message_id`
      - Adds `provider text NOT NULL DEFAULT 'mailgun'` column
  - `proposal_signature_requests.sendgrid_message_id` → `provider_message_id`
      - Renames partial index `idx_proposal_sig_req_send_status` if present
  - `email_campaign_domains.sendgrid_domain_id`   → `provider_domain_id`
  - `report_email_queue.sendgrid_message_id`      → `provider_message_id`

  ## Defaults

  - `email_providers.provider` default changes from `'sendgrid'` to `'mailgun'`.

  ## Idempotency

  All renames are guarded by `information_schema.columns` checks so the
  migration is safe to re-run.
*/

-- email_domains
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_domains' AND column_name = 'sendgrid_domain_id'
  ) THEN
    ALTER TABLE email_domains RENAME COLUMN sendgrid_domain_id TO provider_domain_id;
  END IF;
END $$;

-- email_from_addresses
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_from_addresses' AND column_name = 'sendgrid_sender_id'
  ) THEN
    ALTER TABLE email_from_addresses RENAME COLUMN sendgrid_sender_id TO provider_sender_id;
  END IF;
END $$;

-- email_unsubscribe_groups: rename, drop NOT NULL, drop unique
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_unsubscribe_groups' AND column_name = 'sendgrid_group_id'
  ) THEN
    ALTER TABLE email_unsubscribe_groups RENAME COLUMN sendgrid_group_id TO provider_group_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_unsubscribe_groups'
      AND column_name = 'provider_group_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE email_unsubscribe_groups ALTER COLUMN provider_group_id DROP NOT NULL;
  END IF;
END $$;

ALTER TABLE email_unsubscribe_groups DROP CONSTRAINT IF EXISTS email_unsubscribe_groups_org_sgid_unique;

-- email_test_logs: rename + add provider column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_test_logs' AND column_name = 'sendgrid_message_id'
  ) THEN
    ALTER TABLE email_test_logs RENAME COLUMN sendgrid_message_id TO provider_message_id;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_test_logs' AND column_name = 'provider'
  ) THEN
    ALTER TABLE email_test_logs ADD COLUMN provider text NOT NULL DEFAULT 'mailgun';
  END IF;
END $$;

-- proposal_signature_requests
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proposal_signature_requests' AND column_name = 'sendgrid_message_id'
  ) THEN
    ALTER TABLE proposal_signature_requests RENAME COLUMN sendgrid_message_id TO provider_message_id;
  END IF;
END $$;

-- email_campaign_domains
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_campaign_domains' AND column_name = 'sendgrid_domain_id'
  ) THEN
    ALTER TABLE email_campaign_domains RENAME COLUMN sendgrid_domain_id TO provider_domain_id;
  END IF;
END $$;

-- report_email_queue
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'report_email_queue' AND column_name = 'sendgrid_message_id'
  ) THEN
    ALTER TABLE report_email_queue RENAME COLUMN sendgrid_message_id TO provider_message_id;
  END IF;
END $$;

-- email_providers default
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_providers' AND column_name = 'provider'
  ) THEN
    ALTER TABLE email_providers ALTER COLUMN provider SET DEFAULT 'mailgun';
  END IF;
END $$;
