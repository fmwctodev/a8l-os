/*
  # Create Custom Values Module

  This migration creates a simple, GHL-style Custom Values system for reusable
  organization-wide variables that can be inserted as tokens (e.g., {{custom.company_name}})
  across emails, SMS, automations, AI prompts, and proposals.

  ## 1. New Tables

  ### custom_value_categories
  - `id` (uuid, primary key) - Unique identifier
  - `org_id` (uuid, foreign key) - Organization this category belongs to
  - `name` (text) - Category display name (e.g., "Company Info")
  - `description` (text, optional) - Category description
  - `sort_order` (integer) - Display order for categories
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### custom_values
  - `id` (uuid, primary key) - Unique identifier
  - `org_id` (uuid, foreign key) - Organization this value belongs to
  - `category_id` (uuid, foreign key, nullable) - Optional category grouping
  - `name` (text) - Human-readable label (e.g., "Company Name")
  - `key` (text) - Token key for insertion (e.g., "company_name" for {{custom.company_name}})
  - `value` (text) - The actual value (plain text, no encryption)
  - `available_in_emails` (boolean) - Can be used in email templates
  - `available_in_sms` (boolean) - Can be used in SMS messages
  - `available_in_automations` (boolean) - Can be used in workflow automations
  - `available_in_ai_prompts` (boolean) - Can be used in AI agent prompts
  - `available_in_proposals` (boolean) - Can be used in proposals/invoices
  - `created_by` (uuid) - User who created this value
  - `updated_by` (uuid) - User who last updated this value
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ## 2. Security
  - RLS enabled on both tables
  - Org members can read values
  - Admin+ can create/edit/delete values and manage categories

  ## 3. Default Data
  - Seeds default categories: Company Info, Contact Details, Links & URLs, Other
  - Adds feature flag: custom_values (enabled)
  - Adds permissions for custom values management
*/

-- Create custom_value_categories table
CREATE TABLE IF NOT EXISTS custom_value_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create custom_values table
CREATE TABLE IF NOT EXISTS custom_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category_id uuid REFERENCES custom_value_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  key text NOT NULL,
  value text NOT NULL DEFAULT '',
  available_in_emails boolean DEFAULT true,
  available_in_sms boolean DEFAULT true,
  available_in_automations boolean DEFAULT true,
  available_in_ai_prompts boolean DEFAULT true,
  available_in_proposals boolean DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add unique constraint on org_id + key
ALTER TABLE custom_values ADD CONSTRAINT custom_values_org_key_unique UNIQUE (org_id, key);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_custom_value_categories_org_id ON custom_value_categories(org_id);
CREATE INDEX IF NOT EXISTS idx_custom_values_org_id ON custom_values(org_id);
CREATE INDEX IF NOT EXISTS idx_custom_values_category_id ON custom_values(category_id);
CREATE INDEX IF NOT EXISTS idx_custom_values_org_key ON custom_values(org_id, key);

-- Enable RLS
ALTER TABLE custom_value_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_values ENABLE ROW LEVEL SECURITY;

-- RLS Policies for custom_value_categories

CREATE POLICY "Org members can view custom value categories"
  ON custom_value_categories
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.organization_id = custom_value_categories.org_id
    )
  );

CREATE POLICY "Admins can create custom value categories"
  ON custom_value_categories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND u.organization_id = custom_value_categories.org_id
      AND r.name IN ('SuperAdmin', 'Admin')
    )
  );

CREATE POLICY "Admins can update custom value categories"
  ON custom_value_categories
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND u.organization_id = custom_value_categories.org_id
      AND r.name IN ('SuperAdmin', 'Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND u.organization_id = custom_value_categories.org_id
      AND r.name IN ('SuperAdmin', 'Admin')
    )
  );

CREATE POLICY "Admins can delete custom value categories"
  ON custom_value_categories
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND u.organization_id = custom_value_categories.org_id
      AND r.name IN ('SuperAdmin', 'Admin')
    )
  );

-- RLS Policies for custom_values

CREATE POLICY "Org members can view custom values"
  ON custom_values
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.organization_id = custom_values.org_id
    )
  );

CREATE POLICY "Admins can create custom values"
  ON custom_values
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND u.organization_id = custom_values.org_id
      AND r.name IN ('SuperAdmin', 'Admin')
    )
  );

CREATE POLICY "Admins can update custom values"
  ON custom_values
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND u.organization_id = custom_values.org_id
      AND r.name IN ('SuperAdmin', 'Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND u.organization_id = custom_values.org_id
      AND r.name IN ('SuperAdmin', 'Admin')
    )
  );

CREATE POLICY "Admins can delete custom values"
  ON custom_values
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND u.organization_id = custom_values.org_id
      AND r.name IN ('SuperAdmin', 'Admin')
    )
  );

-- Seed default categories for the default organization
INSERT INTO custom_value_categories (org_id, name, description, sort_order)
SELECT 
  id as org_id,
  category.name,
  category.description,
  category.sort_order
FROM organizations
CROSS JOIN (
  VALUES 
    ('Company Info', 'Business name, address, and other company details', 1),
    ('Contact Details', 'Phone numbers, email addresses, and contact information', 2),
    ('Links & URLs', 'Website links, social media URLs, and booking pages', 3),
    ('Other', 'Miscellaneous custom values', 4)
) AS category(name, description, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM custom_value_categories cvc 
  WHERE cvc.org_id = organizations.id AND cvc.name = category.name
);

-- Add feature flag for custom values
INSERT INTO feature_flags (key, enabled, description)
VALUES ('custom_values', true, 'Custom Values module for reusable organization-wide variables')
ON CONFLICT (key) DO NOTHING;

-- Add permissions for custom values
INSERT INTO permissions (key, description, module_name) VALUES
  ('custom_values.view', 'View custom values', 'Custom Values'),
  ('custom_values.create', 'Create custom values', 'Custom Values'),
  ('custom_values.edit', 'Edit custom values', 'Custom Values'),
  ('custom_values.delete', 'Delete custom values', 'Custom Values'),
  ('custom_values.categories', 'Manage custom value categories', 'Custom Values')
ON CONFLICT (key) DO NOTHING;

-- Assign permissions to roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'SuperAdmin'
AND p.key IN (
  'custom_values.view',
  'custom_values.create',
  'custom_values.edit',
  'custom_values.delete',
  'custom_values.categories'
)
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Admin'
AND p.key IN (
  'custom_values.view',
  'custom_values.create',
  'custom_values.edit',
  'custom_values.delete',
  'custom_values.categories'
)
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Manager'
AND p.key IN ('custom_values.view')
ON CONFLICT DO NOTHING;

-- Create trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_custom_values_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER custom_value_categories_updated_at
  BEFORE UPDATE ON custom_value_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_custom_values_updated_at();

CREATE TRIGGER custom_values_updated_at
  BEFORE UPDATE ON custom_values
  FOR EACH ROW
  EXECUTE FUNCTION update_custom_values_updated_at();
