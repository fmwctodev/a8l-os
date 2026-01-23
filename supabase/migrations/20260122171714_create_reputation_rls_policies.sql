/*
  # Create Reputation Module RLS Policies

  1. Security Policies
    - All tables are organization-scoped
    - review_providers: Admin can manage, all can view
    - review_requests: Users with reputation.request can create
    - reviews: Users with reputation.view can read
    - reputation_settings: Admin can update, all can view

  2. Helper Functions
    - user_has_reputation_permission checks permissions
*/

-- Helper function to check reputation permissions
CREATE OR REPLACE FUNCTION user_has_reputation_permission(permission_key text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_permissions up
    JOIN permissions p ON p.id = up.permission_id
    WHERE up.user_id = auth.uid()
      AND p.key = permission_key
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Review Providers Policies
CREATE POLICY "Users can view review providers in their org"
  ON review_providers FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert review providers"
  ON review_providers FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND user_has_reputation_permission('reputation.providers.manage')
  );

CREATE POLICY "Admins can update review providers"
  ON review_providers FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND user_has_reputation_permission('reputation.providers.manage')
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND user_has_reputation_permission('reputation.providers.manage')
  );

CREATE POLICY "Admins can delete review providers"
  ON review_providers FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND user_has_reputation_permission('reputation.providers.manage')
  );

-- Review Requests Policies
CREATE POLICY "Users can view review requests in their org"
  ON review_requests FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND user_has_reputation_permission('reputation.view')
  );

CREATE POLICY "Users can create review requests"
  ON review_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND user_has_reputation_permission('reputation.request')
  );

CREATE POLICY "Users can update review requests"
  ON review_requests FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND user_has_reputation_permission('reputation.request')
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND user_has_reputation_permission('reputation.request')
  );

-- Reviews Policies
CREATE POLICY "Users can view reviews in their org"
  ON reviews FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND user_has_reputation_permission('reputation.view')
  );

CREATE POLICY "Users can create reviews"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND user_has_reputation_permission('reputation.manage')
  );

CREATE POLICY "Users can update reviews"
  ON reviews FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND user_has_reputation_permission('reputation.manage')
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND user_has_reputation_permission('reputation.manage')
  );

-- Reputation Settings Policies
CREATE POLICY "Users can view reputation settings in their org"
  ON reputation_settings FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert reputation settings"
  ON reputation_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND user_has_reputation_permission('reputation.providers.manage')
  );

CREATE POLICY "Admins can update reputation settings"
  ON reputation_settings FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND user_has_reputation_permission('reputation.providers.manage')
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND user_has_reputation_permission('reputation.providers.manage')
  );
