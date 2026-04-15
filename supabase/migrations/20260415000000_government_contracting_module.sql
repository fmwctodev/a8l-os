/*
  # Government Contracting Module — SAM.gov Integration

  Creates:
  1. "Government" pipeline with 9 stages for federal contracting workflow
  2. gov_saved_searches table for auto-alert criteria
  3. gov_opportunity_imports table for tracking imported SAM.gov opportunities
  4. SAM.gov integration entry in the integrations catalog
*/

-- 1. Create the Government pipeline and stages
DO $$
DECLARE
  v_org_id uuid := '00000000-0000-0000-0000-000000000001';
  v_pipeline_id uuid;
BEGIN
  -- Check if Government pipeline already exists
  SELECT id INTO v_pipeline_id FROM pipelines
  WHERE org_id = v_org_id AND name = 'Government' LIMIT 1;

  IF v_pipeline_id IS NULL THEN
    INSERT INTO pipelines (org_id, name, sort_order)
    VALUES (v_org_id, 'Government', 2)
    RETURNING id INTO v_pipeline_id;
  END IF;

  -- Insert stages (skip if pipeline already has stages)
  IF NOT EXISTS (SELECT 1 FROM pipeline_stages WHERE pipeline_id = v_pipeline_id LIMIT 1) THEN
    INSERT INTO pipeline_stages (org_id, pipeline_id, name, sort_order, aging_threshold_days) VALUES
      (v_org_id, v_pipeline_id, 'Identified',              0,  14),
      (v_org_id, v_pipeline_id, 'Qualifying',              1,   7),
      (v_org_id, v_pipeline_id, 'Capture Planning',        2,  14),
      (v_org_id, v_pipeline_id, 'Bid / No-Bid Decision',   3,   7),
      (v_org_id, v_pipeline_id, 'Proposal Writing',        4,  21),
      (v_org_id, v_pipeline_id, 'Submitted',               5,  30),
      (v_org_id, v_pipeline_id, 'Under Evaluation',        6,  60),
      (v_org_id, v_pipeline_id, 'Awarded (Won)',           7,  NULL),
      (v_org_id, v_pipeline_id, 'Not Awarded (Lost)',      8,  NULL);
  END IF;
END $$;

-- 2. gov_saved_searches — saved SAM.gov search criteria for auto-alerts
CREATE TABLE IF NOT EXISTS gov_saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  search_criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- search_criteria shape: { keywords, naicsCode, pscCode, setAsideType,
  --   state, agencyName, procurementType }
  alert_enabled boolean NOT NULL DEFAULT true,
  alert_frequency text NOT NULL DEFAULT 'daily'
    CHECK (alert_frequency IN ('daily', 'weekly')),
  last_checked_at timestamptz,
  results_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gov_saved_searches_org ON gov_saved_searches(org_id);
CREATE INDEX IF NOT EXISTS idx_gov_saved_searches_user ON gov_saved_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_gov_saved_searches_alert ON gov_saved_searches(alert_enabled)
  WHERE alert_enabled = true;

ALTER TABLE gov_saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view saved searches for their org"
  ON gov_saved_searches FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = (SELECT auth.uid()) AND u.organization_id = gov_saved_searches.org_id));

CREATE POLICY "Users can manage their own saved searches"
  ON gov_saved_searches FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- 3. gov_opportunity_imports — tracks imported SAM.gov opportunities
CREATE TABLE IF NOT EXISTS gov_opportunity_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES opportunities(id) ON DELETE SET NULL,
  sam_notice_id text NOT NULL,
  sam_solicitation_number text,
  sam_title text,
  sam_agency text,
  sam_posted_date timestamptz,
  sam_response_deadline timestamptz,
  sam_set_aside text,
  sam_naics_code text,
  sam_psc_code text,
  sam_type text,
  sam_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamptz NOT NULL DEFAULT now(),
  imported_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (org_id, sam_notice_id)
);

CREATE INDEX IF NOT EXISTS idx_gov_imports_org ON gov_opportunity_imports(org_id);
CREATE INDEX IF NOT EXISTS idx_gov_imports_notice ON gov_opportunity_imports(sam_notice_id);
CREATE INDEX IF NOT EXISTS idx_gov_imports_opp ON gov_opportunity_imports(opportunity_id);

ALTER TABLE gov_opportunity_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view imports for their org"
  ON gov_opportunity_imports FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = (SELECT auth.uid()) AND u.organization_id = gov_opportunity_imports.org_id));

CREATE POLICY "Org members can create imports for their org"
  ON gov_opportunity_imports FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.id = (SELECT auth.uid()) AND u.organization_id = gov_opportunity_imports.org_id));

-- 4. Add SAM.gov to integrations catalog
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM integrations WHERE key = 'sam_gov') THEN
    INSERT INTO integrations (org_id, key, name, description, category, connection_type, enabled, created_at)
    VALUES (
      '00000000-0000-0000-0000-000000000001',
      'sam_gov',
      'SAM.gov',
      'Search and track federal government contract opportunities from SAM.gov',
      'Other',
      'api_key',
      true,
      now()
    );
  END IF;
END $$;
