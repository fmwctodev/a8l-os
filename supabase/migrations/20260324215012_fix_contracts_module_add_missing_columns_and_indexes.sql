/*
  # Fix Contracts Module - Add Missing Columns and Indexes

  The initial contracts migration partially applied. This migration adds:
  1. Missing columns on contracts table: content, custom_instructions, assigned_user_id, archived_at
  2. Missing indexes that failed to apply
  3. Missing triggers and RLS policies
  4. Storage bucket for contract signatures
*/

-- Add missing columns to contracts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contracts' AND column_name = 'content'
  ) THEN
    ALTER TABLE contracts ADD COLUMN content text DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contracts' AND column_name = 'custom_instructions'
  ) THEN
    ALTER TABLE contracts ADD COLUMN custom_instructions text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contracts' AND column_name = 'assigned_user_id'
  ) THEN
    ALTER TABLE contracts ADD COLUMN assigned_user_id uuid REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contracts' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE contracts ADD COLUMN archived_at timestamptz;
  END IF;
END $$;

-- Add annotation column to contract_sections if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contract_sections' AND column_name = 'annotation'
  ) THEN
    ALTER TABLE contract_sections ADD COLUMN annotation text;
  END IF;
END $$;

-- Indexes (IF NOT EXISTS handles duplicates)
CREATE INDEX IF NOT EXISTS idx_contracts_org_id ON contracts(org_id);
CREATE INDEX IF NOT EXISTS idx_contracts_proposal_id ON contracts(proposal_id);
CREATE INDEX IF NOT EXISTS idx_contracts_contact_id ON contracts(contact_id);
CREATE INDEX IF NOT EXISTS idx_contracts_opportunity_id ON contracts(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_public_token ON contracts(public_token);
CREATE INDEX IF NOT EXISTS idx_contracts_signature_status ON contracts(signature_status) WHERE signature_status != 'not_sent';
CREATE INDEX IF NOT EXISTS idx_contracts_created_by ON contracts(created_by);
CREATE INDEX IF NOT EXISTS idx_contracts_assigned_user_id ON contracts(assigned_user_id);

CREATE INDEX IF NOT EXISTS idx_contract_sections_contract_id ON contract_sections(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_sections_org_id ON contract_sections(org_id);

CREATE INDEX IF NOT EXISTS idx_contract_activities_contract_id ON contract_activities(contract_id, created_at);
CREATE INDEX IF NOT EXISTS idx_contract_activities_org_id ON contract_activities(org_id);

CREATE INDEX IF NOT EXISTS idx_contract_comments_contract_id ON contract_comments(contract_id, created_at);
CREATE INDEX IF NOT EXISTS idx_contract_comments_org_id ON contract_comments(org_id);

CREATE INDEX IF NOT EXISTS idx_contract_sig_requests_contract_id ON contract_signature_requests(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_sig_requests_token_hash ON contract_signature_requests(access_token_hash);
CREATE INDEX IF NOT EXISTS idx_contract_sig_requests_status ON contract_signature_requests(status);

CREATE INDEX IF NOT EXISTS idx_contract_signatures_contract_id ON contract_signatures(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_signatures_request_id ON contract_signatures(signature_request_id);

CREATE INDEX IF NOT EXISTS idx_contract_audit_events_contract_id ON contract_audit_events(contract_id, created_at);

-- Triggers for updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_contracts_updated_at'
  ) THEN
    CREATE TRIGGER update_contracts_updated_at
      BEFORE UPDATE ON contracts
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_contract_sections_updated_at'
  ) THEN
    CREATE TRIGGER update_contract_sections_updated_at
      BEFORE UPDATE ON contract_sections
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_contract_sig_requests_updated_at'
  ) THEN
    CREATE TRIGGER update_contract_sig_requests_updated_at
      BEFORE UPDATE ON contract_signature_requests
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Enable RLS on all tables (idempotent)
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_signature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_audit_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies (using DO blocks to check existence)

-- contracts policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contracts' AND policyname = 'Org members can view contracts') THEN
    CREATE POLICY "Org members can view contracts" ON contracts FOR SELECT TO authenticated
      USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contracts' AND policyname = 'Org members can create contracts') THEN
    CREATE POLICY "Org members can create contracts" ON contracts FOR INSERT TO authenticated
      WITH CHECK (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contracts' AND policyname = 'Org members can update contracts') THEN
    CREATE POLICY "Org members can update contracts" ON contracts FOR UPDATE TO authenticated
      USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()))
      WITH CHECK (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contracts' AND policyname = 'Org members can delete contracts') THEN
    CREATE POLICY "Org members can delete contracts" ON contracts FOR DELETE TO authenticated
      USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

-- contract_sections policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contract_sections' AND policyname = 'Org members can view contract sections') THEN
    CREATE POLICY "Org members can view contract sections" ON contract_sections FOR SELECT TO authenticated
      USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contract_sections' AND policyname = 'Org members can create contract sections') THEN
    CREATE POLICY "Org members can create contract sections" ON contract_sections FOR INSERT TO authenticated
      WITH CHECK (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contract_sections' AND policyname = 'Org members can update contract sections') THEN
    CREATE POLICY "Org members can update contract sections" ON contract_sections FOR UPDATE TO authenticated
      USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()))
      WITH CHECK (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contract_sections' AND policyname = 'Org members can delete contract sections') THEN
    CREATE POLICY "Org members can delete contract sections" ON contract_sections FOR DELETE TO authenticated
      USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

-- contract_activities policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contract_activities' AND policyname = 'Org members can view contract activities') THEN
    CREATE POLICY "Org members can view contract activities" ON contract_activities FOR SELECT TO authenticated
      USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contract_activities' AND policyname = 'Org members can create contract activities') THEN
    CREATE POLICY "Org members can create contract activities" ON contract_activities FOR INSERT TO authenticated
      WITH CHECK (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

-- contract_comments policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contract_comments' AND policyname = 'Org members can view contract comments') THEN
    CREATE POLICY "Org members can view contract comments" ON contract_comments FOR SELECT TO authenticated
      USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contract_comments' AND policyname = 'Org members can create contract comments') THEN
    CREATE POLICY "Org members can create contract comments" ON contract_comments FOR INSERT TO authenticated
      WITH CHECK (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contract_comments' AND policyname = 'Org members can delete contract comments') THEN
    CREATE POLICY "Org members can delete contract comments" ON contract_comments FOR DELETE TO authenticated
      USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

-- contract_signature_requests policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contract_signature_requests' AND policyname = 'Org members can view contract signature requests') THEN
    CREATE POLICY "Org members can view contract signature requests" ON contract_signature_requests FOR SELECT TO authenticated
      USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contract_signature_requests' AND policyname = 'Org members can create contract signature requests') THEN
    CREATE POLICY "Org members can create contract signature requests" ON contract_signature_requests FOR INSERT TO authenticated
      WITH CHECK (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contract_signature_requests' AND policyname = 'Org members can update contract signature requests') THEN
    CREATE POLICY "Org members can update contract signature requests" ON contract_signature_requests FOR UPDATE TO authenticated
      USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()))
      WITH CHECK (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contract_signature_requests' AND policyname = 'Public can verify contract signature requests by token') THEN
    CREATE POLICY "Public can verify contract signature requests by token" ON contract_signature_requests FOR SELECT TO anon
      USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contract_signature_requests' AND policyname = 'Public can update contract signature request status') THEN
    CREATE POLICY "Public can update contract signature request status" ON contract_signature_requests FOR UPDATE TO anon
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- contract_signatures policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contract_signatures' AND policyname = 'Org members can view contract signatures') THEN
    CREATE POLICY "Org members can view contract signatures" ON contract_signatures FOR SELECT TO authenticated
      USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contract_signatures' AND policyname = 'Anyone can create contract signatures') THEN
    CREATE POLICY "Anyone can create contract signatures" ON contract_signatures FOR INSERT TO anon, authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- contract_audit_events policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contract_audit_events' AND policyname = 'Org members can view contract audit events') THEN
    CREATE POLICY "Org members can view contract audit events" ON contract_audit_events FOR SELECT TO authenticated
      USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contract_audit_events' AND policyname = 'Anyone can create contract audit events') THEN
    CREATE POLICY "Anyone can create contract audit events" ON contract_audit_events FOR INSERT TO anon, authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- Storage bucket for contract signatures
INSERT INTO storage.buckets (id, name, public)
VALUES ('contract-signatures', 'contract-signatures', true)
ON CONFLICT (id) DO NOTHING;
