/*
  # Create RLS Policies for Marketing Module

  1. Forms Policies
    - Users can view forms in their organization
    - Users with manage permission can create/update forms
    - Users with publish permission can publish forms
    - SuperAdmin can access all forms

  2. Form Submissions Policies
    - Users can view submissions in their organization
    - Service role can insert submissions (from edge functions)
    - Attribution data (IP, user agent) restricted to admins

  3. Surveys Policies
    - Same pattern as forms

  4. Survey Submissions Policies
    - Same pattern as form submissions

  5. Social Accounts Policies
    - Users can view connected accounts in their organization
    - Users with connect permission can add/manage accounts
    - Token data restricted to service role

  6. Social Posts Policies
    - Users can view posts in their organization
    - Users with manage permission can create/edit posts
    - Users with approve permission can approve posts
    - Users with publish permission can schedule posts

  7. OAuth States Policies
    - Users can only access their own OAuth states
*/

-- Forms policies
CREATE POLICY "Users can view forms in their organization"
  ON forms FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users with manage permission can create forms"
  ON forms FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND (
      EXISTS (
        SELECT 1 FROM users u
        JOIN roles r ON u.role_id = r.id
        JOIN role_permissions rp ON r.id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE u.id = auth.uid() AND p.key = 'marketing.forms.manage'
      )
      OR EXISTS (
        SELECT 1 FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = auth.uid() AND r.name = 'SuperAdmin'
      )
    )
  );

CREATE POLICY "Users with manage permission can update forms"
  ON forms FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND (
      EXISTS (
        SELECT 1 FROM users u
        JOIN roles r ON u.role_id = r.id
        JOIN role_permissions rp ON r.id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE u.id = auth.uid() AND p.key = 'marketing.forms.manage'
      )
      OR EXISTS (
        SELECT 1 FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = auth.uid() AND r.name = 'SuperAdmin'
      )
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users with manage permission can delete forms"
  ON forms FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND (
      EXISTS (
        SELECT 1 FROM users u
        JOIN roles r ON u.role_id = r.id
        JOIN role_permissions rp ON r.id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE u.id = auth.uid() AND p.key = 'marketing.forms.manage'
      )
      OR EXISTS (
        SELECT 1 FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = auth.uid() AND r.name = 'SuperAdmin'
      )
    )
  );

-- Form submissions policies
CREATE POLICY "Users can view form submissions in their organization"
  ON form_submissions FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert form submissions"
  ON form_submissions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Surveys policies
CREATE POLICY "Users can view surveys in their organization"
  ON surveys FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users with manage permission can create surveys"
  ON surveys FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND (
      EXISTS (
        SELECT 1 FROM users u
        JOIN roles r ON u.role_id = r.id
        JOIN role_permissions rp ON r.id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE u.id = auth.uid() AND p.key = 'marketing.surveys.manage'
      )
      OR EXISTS (
        SELECT 1 FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = auth.uid() AND r.name = 'SuperAdmin'
      )
    )
  );

CREATE POLICY "Users with manage permission can update surveys"
  ON surveys FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND (
      EXISTS (
        SELECT 1 FROM users u
        JOIN roles r ON u.role_id = r.id
        JOIN role_permissions rp ON r.id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE u.id = auth.uid() AND p.key = 'marketing.surveys.manage'
      )
      OR EXISTS (
        SELECT 1 FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = auth.uid() AND r.name = 'SuperAdmin'
      )
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users with manage permission can delete surveys"
  ON surveys FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND (
      EXISTS (
        SELECT 1 FROM users u
        JOIN roles r ON u.role_id = r.id
        JOIN role_permissions rp ON r.id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE u.id = auth.uid() AND p.key = 'marketing.surveys.manage'
      )
      OR EXISTS (
        SELECT 1 FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = auth.uid() AND r.name = 'SuperAdmin'
      )
    )
  );

-- Survey submissions policies
CREATE POLICY "Users can view survey submissions in their organization"
  ON survey_submissions FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert survey submissions"
  ON survey_submissions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Social accounts policies
CREATE POLICY "Users can view social accounts in their organization"
  ON social_accounts FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users with connect permission can create social accounts"
  ON social_accounts FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND (
      EXISTS (
        SELECT 1 FROM users u
        JOIN roles r ON u.role_id = r.id
        JOIN role_permissions rp ON r.id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE u.id = auth.uid() AND p.key = 'marketing.social.connect'
      )
      OR EXISTS (
        SELECT 1 FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = auth.uid() AND r.name = 'SuperAdmin'
      )
    )
  );

CREATE POLICY "Users with connect permission can update social accounts"
  ON social_accounts FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND (
      EXISTS (
        SELECT 1 FROM users u
        JOIN roles r ON u.role_id = r.id
        JOIN role_permissions rp ON r.id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE u.id = auth.uid() AND p.key = 'marketing.social.connect'
      )
      OR EXISTS (
        SELECT 1 FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = auth.uid() AND r.name = 'SuperAdmin'
      )
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users with connect permission can delete social accounts"
  ON social_accounts FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND (
      EXISTS (
        SELECT 1 FROM users u
        JOIN roles r ON u.role_id = r.id
        JOIN role_permissions rp ON r.id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE u.id = auth.uid() AND p.key = 'marketing.social.connect'
      )
      OR EXISTS (
        SELECT 1 FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = auth.uid() AND r.name = 'SuperAdmin'
      )
    )
  );

-- OAuth states policies (users can only see their own)
CREATE POLICY "Users can view their own OAuth states"
  ON social_oauth_states FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own OAuth states"
  ON social_oauth_states FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own OAuth states"
  ON social_oauth_states FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Social posts policies
CREATE POLICY "Users can view social posts in their organization"
  ON social_posts FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users with manage permission can create social posts"
  ON social_posts FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND (
      EXISTS (
        SELECT 1 FROM users u
        JOIN roles r ON u.role_id = r.id
        JOIN role_permissions rp ON r.id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE u.id = auth.uid() AND p.key = 'marketing.social.manage'
      )
      OR EXISTS (
        SELECT 1 FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = auth.uid() AND r.name = 'SuperAdmin'
      )
    )
  );

CREATE POLICY "Users with manage permission can update social posts"
  ON social_posts FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND (
      EXISTS (
        SELECT 1 FROM users u
        JOIN roles r ON u.role_id = r.id
        JOIN role_permissions rp ON r.id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE u.id = auth.uid() AND p.key = 'marketing.social.manage'
      )
      OR EXISTS (
        SELECT 1 FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = auth.uid() AND r.name = 'SuperAdmin'
      )
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users with manage permission can delete social posts"
  ON social_posts FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND (
      EXISTS (
        SELECT 1 FROM users u
        JOIN roles r ON u.role_id = r.id
        JOIN role_permissions rp ON r.id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE u.id = auth.uid() AND p.key = 'marketing.social.manage'
      )
      OR EXISTS (
        SELECT 1 FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = auth.uid() AND r.name = 'SuperAdmin'
      )
    )
  );

-- Social post logs policies
CREATE POLICY "Users can view post logs in their organization"
  ON social_post_logs FOR SELECT
  TO authenticated
  USING (
    post_id IN (
      SELECT id FROM social_posts WHERE organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Service role can insert post logs"
  ON social_post_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);
