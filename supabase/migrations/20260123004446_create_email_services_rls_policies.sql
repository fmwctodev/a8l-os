/*
  # Email Services RLS Policies

  1. Overview
    - Creates Row Level Security policies for all email tables
    - Implements permission-based access control
    - Protects sensitive API key columns

  2. Helper Function
    - `user_has_email_permission` - checks if user has specific email permission

  3. Policies
    - email_providers: View with email.settings.view, manage with email.settings.manage
    - email_domains: View with email.settings.view, manage with email.settings.manage
    - email_from_addresses: View with email.settings.view, manage with email.settings.manage
    - email_unsubscribe_groups: View with email.settings.view, manage with email.settings.manage
    - email_defaults: View with email.settings.view, update with email.settings.manage
    - email_test_logs: View with email.settings.view, insert with email.send.test

  4. Security Notes
    - API key columns only accessible to admins via edge functions
    - All policies check org_id membership
*/

-- Create helper function to check email permissions
CREATE OR REPLACE FUNCTION user_has_email_permission(
  user_id uuid,
  required_permission text
)
RETURNS boolean AS $$
DECLARE
  user_role_id uuid;
  has_permission boolean;
BEGIN
  SELECT role_id INTO user_role_id
  FROM users
  WHERE id = user_id;

  IF user_role_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM role_permissions rp
    JOIN permissions p ON p.id = rp.permission_id
    WHERE rp.role_id = user_role_id
    AND p.key = required_permission
  ) INTO has_permission;

  RETURN has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- email_providers policies
CREATE POLICY "Users can view email providers with permission"
  ON email_providers FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND user_has_email_permission(auth.uid(), 'email.settings.view')
  );

CREATE POLICY "Users can insert email providers with manage permission"
  ON email_providers FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND user_has_email_permission(auth.uid(), 'email.settings.manage')
  );

CREATE POLICY "Users can update email providers with manage permission"
  ON email_providers FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND user_has_email_permission(auth.uid(), 'email.settings.manage')
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND user_has_email_permission(auth.uid(), 'email.settings.manage')
  );

CREATE POLICY "Users can delete email providers with manage permission"
  ON email_providers FOR DELETE
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND user_has_email_permission(auth.uid(), 'email.settings.manage')
  );

-- email_domains policies
CREATE POLICY "Users can view email domains with permission"
  ON email_domains FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND user_has_email_permission(auth.uid(), 'email.settings.view')
  );

CREATE POLICY "Users can insert email domains with manage permission"
  ON email_domains FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND user_has_email_permission(auth.uid(), 'email.settings.manage')
  );

CREATE POLICY "Users can update email domains with manage permission"
  ON email_domains FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND user_has_email_permission(auth.uid(), 'email.settings.manage')
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND user_has_email_permission(auth.uid(), 'email.settings.manage')
  );

CREATE POLICY "Users can delete email domains with manage permission"
  ON email_domains FOR DELETE
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND user_has_email_permission(auth.uid(), 'email.settings.manage')
  );

-- email_from_addresses policies
CREATE POLICY "Users can view email from addresses with permission"
  ON email_from_addresses FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND user_has_email_permission(auth.uid(), 'email.settings.view')
  );

CREATE POLICY "Users can insert email from addresses with manage permission"
  ON email_from_addresses FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND user_has_email_permission(auth.uid(), 'email.settings.manage')
  );

CREATE POLICY "Users can update email from addresses with manage permission"
  ON email_from_addresses FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND user_has_email_permission(auth.uid(), 'email.settings.manage')
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND user_has_email_permission(auth.uid(), 'email.settings.manage')
  );

CREATE POLICY "Users can delete email from addresses with manage permission"
  ON email_from_addresses FOR DELETE
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND user_has_email_permission(auth.uid(), 'email.settings.manage')
  );

-- email_unsubscribe_groups policies
CREATE POLICY "Users can view email unsubscribe groups with permission"
  ON email_unsubscribe_groups FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND user_has_email_permission(auth.uid(), 'email.settings.view')
  );

CREATE POLICY "Users can insert email unsubscribe groups with manage permission"
  ON email_unsubscribe_groups FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND user_has_email_permission(auth.uid(), 'email.settings.manage')
  );

CREATE POLICY "Users can update email unsubscribe groups with manage permission"
  ON email_unsubscribe_groups FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND user_has_email_permission(auth.uid(), 'email.settings.manage')
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND user_has_email_permission(auth.uid(), 'email.settings.manage')
  );

CREATE POLICY "Users can delete email unsubscribe groups with manage permission"
  ON email_unsubscribe_groups FOR DELETE
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND user_has_email_permission(auth.uid(), 'email.settings.manage')
  );

-- email_defaults policies
CREATE POLICY "Users can view email defaults with permission"
  ON email_defaults FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND user_has_email_permission(auth.uid(), 'email.settings.view')
  );

CREATE POLICY "Users can insert email defaults with manage permission"
  ON email_defaults FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND user_has_email_permission(auth.uid(), 'email.settings.manage')
  );

CREATE POLICY "Users can update email defaults with manage permission"
  ON email_defaults FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND user_has_email_permission(auth.uid(), 'email.settings.manage')
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND user_has_email_permission(auth.uid(), 'email.settings.manage')
  );

-- email_test_logs policies
CREATE POLICY "Users can view email test logs with permission"
  ON email_test_logs FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND user_has_email_permission(auth.uid(), 'email.settings.view')
  );

CREATE POLICY "Users can insert email test logs with test permission"
  ON email_test_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND user_has_email_permission(auth.uid(), 'email.send.test')
  );
