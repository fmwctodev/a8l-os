/*
  # Add Payments Permissions and Feature Flag

  This migration adds the necessary permissions for the Payments module and
  enables the feature flag.

  ## 1. New Permissions
  - payments.view - View invoices, payments, and products
  - payments.manage - Manage products and recurring profiles
  - invoices.create - Create and edit invoices
  - invoices.send - Send invoices to customers
  - invoices.void - Void invoices
  - products.manage - Manage product catalog

  ## 2. Role Assignments
  - SuperAdmin: All permissions
  - Admin: All permissions
  - Manager: All except invoices.void
  - Sales: View, create, send invoices
  - Ops: View only
  - ReadOnly: View only

  ## 3. Feature Flag
  - payments feature flag enabled by default
*/

-- Insert new permissions
INSERT INTO permissions (key, description, module_name) VALUES
  ('invoices.create', 'Create and edit invoices', 'payments'),
  ('invoices.send', 'Send invoices to customers', 'payments'),
  ('invoices.void', 'Void invoices', 'payments'),
  ('products.manage', 'Manage product catalog', 'payments')
ON CONFLICT (key) DO NOTHING;

-- Get role IDs
DO $$
DECLARE
  v_superadmin_id uuid;
  v_admin_id uuid;
  v_manager_id uuid;
  v_sales_id uuid;
  v_ops_id uuid;
  v_readonly_id uuid;
  v_perm_payments_view uuid;
  v_perm_payments_manage uuid;
  v_perm_invoices_create uuid;
  v_perm_invoices_send uuid;
  v_perm_invoices_void uuid;
  v_perm_products_manage uuid;
BEGIN
  -- Get role IDs
  SELECT id INTO v_superadmin_id FROM roles WHERE name = 'SuperAdmin';
  SELECT id INTO v_admin_id FROM roles WHERE name = 'Admin';
  SELECT id INTO v_manager_id FROM roles WHERE name = 'Manager';
  SELECT id INTO v_sales_id FROM roles WHERE name = 'Sales';
  SELECT id INTO v_ops_id FROM roles WHERE name = 'Ops';
  SELECT id INTO v_readonly_id FROM roles WHERE name = 'ReadOnly';

  -- Get permission IDs
  SELECT id INTO v_perm_payments_view FROM permissions WHERE key = 'payments.view';
  SELECT id INTO v_perm_payments_manage FROM permissions WHERE key = 'payments.manage';
  SELECT id INTO v_perm_invoices_create FROM permissions WHERE key = 'invoices.create';
  SELECT id INTO v_perm_invoices_send FROM permissions WHERE key = 'invoices.send';
  SELECT id INTO v_perm_invoices_void FROM permissions WHERE key = 'invoices.void';
  SELECT id INTO v_perm_products_manage FROM permissions WHERE key = 'products.manage';

  -- SuperAdmin: All permissions
  IF v_superadmin_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES
      (v_superadmin_id, v_perm_invoices_create),
      (v_superadmin_id, v_perm_invoices_send),
      (v_superadmin_id, v_perm_invoices_void),
      (v_superadmin_id, v_perm_products_manage)
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- Admin: All permissions
  IF v_admin_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES
      (v_admin_id, v_perm_invoices_create),
      (v_admin_id, v_perm_invoices_send),
      (v_admin_id, v_perm_invoices_void),
      (v_admin_id, v_perm_products_manage)
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- Manager: All except void
  IF v_manager_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES
      (v_manager_id, v_perm_invoices_create),
      (v_manager_id, v_perm_invoices_send),
      (v_manager_id, v_perm_products_manage)
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- Sales: View, create, send
  IF v_sales_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES
      (v_sales_id, v_perm_invoices_create),
      (v_sales_id, v_perm_invoices_send)
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- Ops and ReadOnly: View only (already have payments.view from previous migration)
END $$;

-- Enable payments feature flag
INSERT INTO feature_flags (key, enabled, description) VALUES
  ('payments', true, 'Payments and invoicing module with QuickBooks Online integration')
ON CONFLICT (key) DO UPDATE SET enabled = true;