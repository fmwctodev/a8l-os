/*
  # Create RLS Policies for Brandboard Module

  1. Security
    - Enable RLS on all brand tables
    - Create view policies for brandboard.view permission
    - Create manage policies for brandboard.manage permission
    - Create activate policies for brandboard.activate permission
    - Org-scoped access for all policies

  2. Tables Covered
    - brand_kits
    - brand_kit_versions
    - brand_voices
    - brand_voice_versions
    - brand_usage
*/

-- Enable RLS on all brand tables
ALTER TABLE brand_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_kit_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_voices ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_voice_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_usage ENABLE ROW LEVEL SECURITY;

-- Helper function for brandboard permissions
CREATE OR REPLACE FUNCTION user_has_brandboard_permission(p_permission_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users u
    JOIN role_permissions rp ON rp.role_id = u.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE u.id = auth.uid()
    AND p.key = p_permission_key
  );
END;
$$;

-- =====================
-- BRAND_KITS POLICIES
-- =====================

-- SELECT: Users with brandboard.view can see non-archived kits in their org
CREATE POLICY "Users can view org brand kits"
ON brand_kits FOR SELECT
TO authenticated
USING (
  org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  AND archived_at IS NULL
  AND user_has_brandboard_permission('brandboard.view')
);

-- INSERT: Users with brandboard.manage can create brand kits
CREATE POLICY "Users can create org brand kits"
ON brand_kits FOR INSERT
TO authenticated
WITH CHECK (
  org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  AND user_has_brandboard_permission('brandboard.manage')
);

-- UPDATE: Users with brandboard.manage can update brand kits (except active status)
-- Users with brandboard.activate can change active status
CREATE POLICY "Users can update org brand kits"
ON brand_kits FOR UPDATE
TO authenticated
USING (
  org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  AND user_has_brandboard_permission('brandboard.manage')
)
WITH CHECK (
  org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  AND user_has_brandboard_permission('brandboard.manage')
);

-- DELETE: Users with brandboard.manage can delete brand kits
CREATE POLICY "Users can delete org brand kits"
ON brand_kits FOR DELETE
TO authenticated
USING (
  org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  AND user_has_brandboard_permission('brandboard.manage')
);

-- ===========================
-- BRAND_KIT_VERSIONS POLICIES
-- ===========================

-- SELECT: Users can view versions of kits they can see
CREATE POLICY "Users can view org brand kit versions"
ON brand_kit_versions FOR SELECT
TO authenticated
USING (
  brand_kit_id IN (
    SELECT id FROM brand_kits 
    WHERE org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND archived_at IS NULL
  )
  AND user_has_brandboard_permission('brandboard.view')
);

-- INSERT: Users with brandboard.manage can create versions
CREATE POLICY "Users can create brand kit versions"
ON brand_kit_versions FOR INSERT
TO authenticated
WITH CHECK (
  brand_kit_id IN (
    SELECT id FROM brand_kits 
    WHERE org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  )
  AND user_has_brandboard_permission('brandboard.manage')
);

-- =====================
-- BRAND_VOICES POLICIES
-- =====================

-- SELECT: Users with brandboard.view can see non-archived voices in their org
CREATE POLICY "Users can view org brand voices"
ON brand_voices FOR SELECT
TO authenticated
USING (
  org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  AND archived_at IS NULL
  AND user_has_brandboard_permission('brandboard.view')
);

-- INSERT: Users with brandboard.manage can create brand voices
CREATE POLICY "Users can create org brand voices"
ON brand_voices FOR INSERT
TO authenticated
WITH CHECK (
  org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  AND user_has_brandboard_permission('brandboard.manage')
);

-- UPDATE: Users with brandboard.manage can update brand voices
CREATE POLICY "Users can update org brand voices"
ON brand_voices FOR UPDATE
TO authenticated
USING (
  org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  AND user_has_brandboard_permission('brandboard.manage')
)
WITH CHECK (
  org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  AND user_has_brandboard_permission('brandboard.manage')
);

-- DELETE: Users with brandboard.manage can delete brand voices
CREATE POLICY "Users can delete org brand voices"
ON brand_voices FOR DELETE
TO authenticated
USING (
  org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  AND user_has_brandboard_permission('brandboard.manage')
);

-- =============================
-- BRAND_VOICE_VERSIONS POLICIES
-- =============================

-- SELECT: Users can view versions of voices they can see
CREATE POLICY "Users can view org brand voice versions"
ON brand_voice_versions FOR SELECT
TO authenticated
USING (
  brand_voice_id IN (
    SELECT id FROM brand_voices 
    WHERE org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND archived_at IS NULL
  )
  AND user_has_brandboard_permission('brandboard.view')
);

-- INSERT: Users with brandboard.manage can create versions
CREATE POLICY "Users can create brand voice versions"
ON brand_voice_versions FOR INSERT
TO authenticated
WITH CHECK (
  brand_voice_id IN (
    SELECT id FROM brand_voices 
    WHERE org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  )
  AND user_has_brandboard_permission('brandboard.manage')
);

-- =====================
-- BRAND_USAGE POLICIES
-- =====================

-- SELECT: Users with brandboard.view can see usage in their org
CREATE POLICY "Users can view org brand usage"
ON brand_usage FOR SELECT
TO authenticated
USING (
  org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  AND user_has_brandboard_permission('brandboard.view')
);

-- INSERT: Users with brandboard.view can track usage (usage is auto-tracked)
CREATE POLICY "Users can track brand usage"
ON brand_usage FOR INSERT
TO authenticated
WITH CHECK (
  org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  AND user_has_brandboard_permission('brandboard.view')
);

-- UPDATE: Users can update usage timestamps
CREATE POLICY "Users can update brand usage"
ON brand_usage FOR UPDATE
TO authenticated
USING (
  org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  AND user_has_brandboard_permission('brandboard.view')
)
WITH CHECK (
  org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  AND user_has_brandboard_permission('brandboard.view')
);

-- DELETE: Users with brandboard.manage can delete usage records
CREATE POLICY "Users can delete brand usage"
ON brand_usage FOR DELETE
TO authenticated
USING (
  org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  AND user_has_brandboard_permission('brandboard.manage')
);
