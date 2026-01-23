/*
  # Create RLS Policies for Payments Module

  This migration creates Row Level Security policies for all payments-related tables.
  Policies enforce organization isolation and permission-based access control.

  ## 1. Security Model

  ### qbo_connections
  - Only admins can view and manage (via settings.manage permission)
  - Organization-scoped

  ### products
  - View: Users with payments.view permission
  - Manage: Users with payments.manage permission
  - Organization-scoped

  ### invoices
  - View: Users with payments.view permission in their department
  - Create/Edit: Users with invoices.create permission
  - Void: Users with invoices.void permission
  - Organization-scoped with department filtering

  ### invoice_line_items
  - Follows parent invoice permissions
  - Organization-scoped

  ### payments
  - View: Users with payments.view permission
  - Organization-scoped

  ### recurring_profiles
  - View: Users with payments.view permission
  - Manage: Users with payments.manage permission
  - Organization-scoped

  ### qbo_webhook_logs
  - Admin only (via settings.manage)
  - Organization-scoped

  ## 2. Permission Requirements
  - payments.view - View invoices, payments, products
  - payments.manage - Manage products, recurring profiles
  - invoices.create - Create and edit invoices
  - invoices.send - Send invoices to customers
  - invoices.void - Void invoices
*/

-- Helper function to check if user has a specific permission
CREATE OR REPLACE FUNCTION user_has_payments_permission(permission_key text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users u
    JOIN role_permissions rp ON rp.role_id = u.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE u.id = auth.uid()
    AND p.key = permission_key
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get user's organization
CREATE OR REPLACE FUNCTION get_user_organization_id()
RETURNS uuid AS $$
BEGIN
  RETURN (SELECT organization_id FROM users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- QBO Connections Policies (Admin Only)
-- ============================================

CREATE POLICY "Admins can view QBO connections"
  ON qbo_connections FOR SELECT
  TO authenticated
  USING (
    org_id = get_user_organization_id()
    AND user_has_payments_permission('settings.manage')
  );

CREATE POLICY "Admins can insert QBO connections"
  ON qbo_connections FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = get_user_organization_id()
    AND user_has_payments_permission('settings.manage')
  );

CREATE POLICY "Admins can update QBO connections"
  ON qbo_connections FOR UPDATE
  TO authenticated
  USING (
    org_id = get_user_organization_id()
    AND user_has_payments_permission('settings.manage')
  )
  WITH CHECK (
    org_id = get_user_organization_id()
    AND user_has_payments_permission('settings.manage')
  );

CREATE POLICY "Admins can delete QBO connections"
  ON qbo_connections FOR DELETE
  TO authenticated
  USING (
    org_id = get_user_organization_id()
    AND user_has_payments_permission('settings.manage')
  );

-- ============================================
-- Products Policies
-- ============================================

CREATE POLICY "Users with payments.view can view products"
  ON products FOR SELECT
  TO authenticated
  USING (
    org_id = get_user_organization_id()
    AND user_has_payments_permission('payments.view')
  );

CREATE POLICY "Users with payments.manage can insert products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = get_user_organization_id()
    AND user_has_payments_permission('payments.manage')
  );

CREATE POLICY "Users with payments.manage can update products"
  ON products FOR UPDATE
  TO authenticated
  USING (
    org_id = get_user_organization_id()
    AND user_has_payments_permission('payments.manage')
  )
  WITH CHECK (
    org_id = get_user_organization_id()
    AND user_has_payments_permission('payments.manage')
  );

CREATE POLICY "Users with payments.manage can delete products"
  ON products FOR DELETE
  TO authenticated
  USING (
    org_id = get_user_organization_id()
    AND user_has_payments_permission('payments.manage')
  );

-- ============================================
-- Invoices Policies
-- ============================================

CREATE POLICY "Users with payments.view can view invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    org_id = get_user_organization_id()
    AND user_has_payments_permission('payments.view')
  );

CREATE POLICY "Users with invoices.create can insert invoices"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = get_user_organization_id()
    AND user_has_payments_permission('invoices.create')
  );

CREATE POLICY "Users with invoices.create can update invoices"
  ON invoices FOR UPDATE
  TO authenticated
  USING (
    org_id = get_user_organization_id()
    AND (
      user_has_payments_permission('invoices.create')
      OR user_has_payments_permission('invoices.send')
      OR user_has_payments_permission('invoices.void')
    )
  )
  WITH CHECK (
    org_id = get_user_organization_id()
    AND (
      user_has_payments_permission('invoices.create')
      OR user_has_payments_permission('invoices.send')
      OR user_has_payments_permission('invoices.void')
    )
  );

CREATE POLICY "Users with invoices.void can delete invoices"
  ON invoices FOR DELETE
  TO authenticated
  USING (
    org_id = get_user_organization_id()
    AND user_has_payments_permission('invoices.void')
  );

-- ============================================
-- Invoice Line Items Policies
-- ============================================

CREATE POLICY "Users with payments.view can view invoice line items"
  ON invoice_line_items FOR SELECT
  TO authenticated
  USING (
    org_id = get_user_organization_id()
    AND user_has_payments_permission('payments.view')
  );

CREATE POLICY "Users with invoices.create can insert invoice line items"
  ON invoice_line_items FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = get_user_organization_id()
    AND user_has_payments_permission('invoices.create')
  );

CREATE POLICY "Users with invoices.create can update invoice line items"
  ON invoice_line_items FOR UPDATE
  TO authenticated
  USING (
    org_id = get_user_organization_id()
    AND user_has_payments_permission('invoices.create')
  )
  WITH CHECK (
    org_id = get_user_organization_id()
    AND user_has_payments_permission('invoices.create')
  );

CREATE POLICY "Users with invoices.create can delete invoice line items"
  ON invoice_line_items FOR DELETE
  TO authenticated
  USING (
    org_id = get_user_organization_id()
    AND user_has_payments_permission('invoices.create')
  );

-- ============================================
-- Payments Policies
-- ============================================

CREATE POLICY "Users with payments.view can view payments"
  ON payments FOR SELECT
  TO authenticated
  USING (
    org_id = get_user_organization_id()
    AND user_has_payments_permission('payments.view')
  );

CREATE POLICY "Users with payments.manage can insert payments"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = get_user_organization_id()
    AND user_has_payments_permission('payments.manage')
  );

CREATE POLICY "Users with payments.manage can update payments"
  ON payments FOR UPDATE
  TO authenticated
  USING (
    org_id = get_user_organization_id()
    AND user_has_payments_permission('payments.manage')
  )
  WITH CHECK (
    org_id = get_user_organization_id()
    AND user_has_payments_permission('payments.manage')
  );

-- ============================================
-- Recurring Profiles Policies
-- ============================================

CREATE POLICY "Users with payments.view can view recurring profiles"
  ON recurring_profiles FOR SELECT
  TO authenticated
  USING (
    org_id = get_user_organization_id()
    AND user_has_payments_permission('payments.view')
  );

CREATE POLICY "Users with payments.manage can insert recurring profiles"
  ON recurring_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = get_user_organization_id()
    AND user_has_payments_permission('payments.manage')
  );

CREATE POLICY "Users with payments.manage can update recurring profiles"
  ON recurring_profiles FOR UPDATE
  TO authenticated
  USING (
    org_id = get_user_organization_id()
    AND user_has_payments_permission('payments.manage')
  )
  WITH CHECK (
    org_id = get_user_organization_id()
    AND user_has_payments_permission('payments.manage')
  );

CREATE POLICY "Users with payments.manage can delete recurring profiles"
  ON recurring_profiles FOR DELETE
  TO authenticated
  USING (
    org_id = get_user_organization_id()
    AND user_has_payments_permission('payments.manage')
  );

-- ============================================
-- Recurring Profile Items Policies
-- ============================================

CREATE POLICY "Users with payments.view can view recurring profile items"
  ON recurring_profile_items FOR SELECT
  TO authenticated
  USING (
    org_id = get_user_organization_id()
    AND user_has_payments_permission('payments.view')
  );

CREATE POLICY "Users with payments.manage can insert recurring profile items"
  ON recurring_profile_items FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = get_user_organization_id()
    AND user_has_payments_permission('payments.manage')
  );

CREATE POLICY "Users with payments.manage can update recurring profile items"
  ON recurring_profile_items FOR UPDATE
  TO authenticated
  USING (
    org_id = get_user_organization_id()
    AND user_has_payments_permission('payments.manage')
  )
  WITH CHECK (
    org_id = get_user_organization_id()
    AND user_has_payments_permission('payments.manage')
  );

CREATE POLICY "Users with payments.manage can delete recurring profile items"
  ON recurring_profile_items FOR DELETE
  TO authenticated
  USING (
    org_id = get_user_organization_id()
    AND user_has_payments_permission('payments.manage')
  );

-- ============================================
-- QBO Webhook Logs Policies (Admin Only)
-- ============================================

CREATE POLICY "Admins can view QBO webhook logs"
  ON qbo_webhook_logs FOR SELECT
  TO authenticated
  USING (
    org_id = get_user_organization_id()
    AND user_has_payments_permission('settings.manage')
  );

CREATE POLICY "Admins can insert QBO webhook logs"
  ON qbo_webhook_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = get_user_organization_id()
  );