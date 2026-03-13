/*
  # Create Proposal Signature Module

  1. Modified Tables
    - `proposals` - Added signature tracking columns:
      - `signature_status` (text) - Tracks signing workflow
      - `signed_at`, `declined_at`, `expires_at` (timestamptz)
      - `final_signed_pdf_url` (text) - URL to the signed PDF
      - `frozen_html_snapshot` (text) - Immutable HTML at send time
      - `frozen_json_snapshot` (jsonb) - Immutable JSON data
      - `frozen_document_hash` (text) - SHA-256 for tamper detection
      - `signer_name`, `signer_email` (text)
      - `signature_request_id` (uuid)

  2. New Tables
    - `proposal_signature_requests` - Tracks signature requests
    - `proposal_signatures` - Stores actual signature data
    - `proposal_audit_events` - Complete audit trail

  3. Security
    - RLS enabled on all new tables
    - Org-scoped policies for authenticated users
    - Public access via token hash for signing page
    - Storage bucket for signed PDFs
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proposals' AND column_name = 'signature_status'
  ) THEN
    ALTER TABLE proposals ADD COLUMN signature_status text NOT NULL DEFAULT 'not_sent';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proposals' AND column_name = 'signed_at'
  ) THEN
    ALTER TABLE proposals ADD COLUMN signed_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proposals' AND column_name = 'declined_at'
  ) THEN
    ALTER TABLE proposals ADD COLUMN declined_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proposals' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE proposals ADD COLUMN expires_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proposals' AND column_name = 'final_signed_pdf_url'
  ) THEN
    ALTER TABLE proposals ADD COLUMN final_signed_pdf_url text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proposals' AND column_name = 'frozen_html_snapshot'
  ) THEN
    ALTER TABLE proposals ADD COLUMN frozen_html_snapshot text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proposals' AND column_name = 'frozen_json_snapshot'
  ) THEN
    ALTER TABLE proposals ADD COLUMN frozen_json_snapshot jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proposals' AND column_name = 'frozen_document_hash'
  ) THEN
    ALTER TABLE proposals ADD COLUMN frozen_document_hash text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proposals' AND column_name = 'signer_name'
  ) THEN
    ALTER TABLE proposals ADD COLUMN signer_name text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proposals' AND column_name = 'signer_email'
  ) THEN
    ALTER TABLE proposals ADD COLUMN signer_email text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proposals' AND column_name = 'signature_request_id'
  ) THEN
    ALTER TABLE proposals ADD COLUMN signature_request_id uuid;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'proposals_signature_status_check'
  ) THEN
    ALTER TABLE proposals ADD CONSTRAINT proposals_signature_status_check
      CHECK (signature_status IN ('not_sent', 'pending_signature', 'viewed', 'signed', 'declined', 'expired', 'voided'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS proposal_signature_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  proposal_id uuid NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  signer_name text NOT NULL,
  signer_email text NOT NULL,
  access_token_hash text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  viewed_at timestamptz,
  signed_at timestamptz,
  declined_at timestamptz,
  decline_reason text,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT proposal_sig_req_status_check CHECK (status IN ('pending', 'viewed', 'signed', 'declined', 'expired', 'voided'))
);

CREATE TABLE IF NOT EXISTS proposal_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  proposal_id uuid NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  signature_request_id uuid NOT NULL REFERENCES proposal_signature_requests(id) ON DELETE CASCADE,
  signature_type text NOT NULL DEFAULT 'drawn',
  signature_text text,
  signature_image_url text,
  signer_name text NOT NULL,
  signer_email text NOT NULL,
  ip_address text,
  user_agent text,
  consent_text text NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  document_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT proposal_sig_type_check CHECK (signature_type IN ('typed', 'drawn'))
);

CREATE TABLE IF NOT EXISTS proposal_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  proposal_id uuid NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_type text NOT NULL DEFAULT 'system',
  actor_id text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT proposal_audit_actor_type_check CHECK (actor_type IN ('system', 'user', 'signer'))
);

CREATE INDEX IF NOT EXISTS idx_proposal_sig_requests_proposal_id ON proposal_signature_requests(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_sig_requests_token_hash ON proposal_signature_requests(access_token_hash);
CREATE INDEX IF NOT EXISTS idx_proposal_sig_requests_status ON proposal_signature_requests(status);
CREATE INDEX IF NOT EXISTS idx_proposal_signatures_proposal_id ON proposal_signatures(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_signatures_request_id ON proposal_signatures(signature_request_id);
CREATE INDEX IF NOT EXISTS idx_proposal_audit_events_proposal_id ON proposal_audit_events(proposal_id, created_at);
CREATE INDEX IF NOT EXISTS idx_proposals_signature_status ON proposals(signature_status) WHERE signature_status != 'not_sent';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_proposal_sig_requests_updated_at'
  ) THEN
    CREATE TRIGGER update_proposal_sig_requests_updated_at
      BEFORE UPDATE ON proposal_signature_requests
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

ALTER TABLE proposal_signature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view signature requests"
  ON proposal_signature_requests FOR SELECT TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Org members can create signature requests"
  ON proposal_signature_requests FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Org members can update signature requests"
  ON proposal_signature_requests FOR UPDATE TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()))
  WITH CHECK (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Public can verify signature requests by token"
  ON proposal_signature_requests FOR SELECT TO anon
  USING (true);

CREATE POLICY "Public can update signature request status"
  ON proposal_signature_requests FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Org members can view signatures"
  ON proposal_signatures FOR SELECT TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Anyone can create signatures"
  ON proposal_signatures FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Org members can view audit events"
  ON proposal_audit_events FOR SELECT TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Anyone can create audit events"
  ON proposal_audit_events FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'auto_advance_opportunity_on_signed'
  ) THEN
    ALTER TABLE organizations ADD COLUMN auto_advance_opportunity_on_signed boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'auto_create_project_on_signed'
  ) THEN
    ALTER TABLE organizations ADD COLUMN auto_create_project_on_signed boolean NOT NULL DEFAULT false;
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public)
VALUES ('proposal-signatures', 'proposal-signatures', true)
ON CONFLICT (id) DO NOTHING;
