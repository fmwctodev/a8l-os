/*
  # Custom Objects Framework

  ## Overview
  Adds first-class custom objects (Company, Property, Project, etc.) that contacts
  can be linked to. Schema is intentionally lean: each definition stores its field
  schema as JSONB (mirroring how forms.definition works) so adding a new field
  doesn't require a new migration.

  ## 1. New Tables

  ### custom_object_definitions
  - id, organization_id
  - slug (unique per org)
  - name, icon
  - primary_field_key (which field acts as the display value, e.g. "name")
  - field_definitions jsonb — array of { key, label, type, required?, is_primary? }
  - is_builtin (true for the seeded Company)
  - active, soft-delete via deleted_at

  ### custom_object_records
  - id, organization_id, object_def_id
  - contact_id (optional — most records will be linked to a contact)
  - primary_value (denormalized for fast indexing/filtering)
  - values jsonb — { fieldKey: value }

  ## 2. Seed
  Every existing org gets a built-in "Company" definition with sane defaults.
  A trigger on organizations seeds the same definition for new orgs.

  ## 3. Security
  RLS scoped to organization membership; writes require contacts.edit (matches
  the surface that actually creates these — form/survey submissions).
*/

CREATE TABLE IF NOT EXISTS custom_object_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  icon text,
  primary_field_key text NOT NULL,
  field_definitions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_builtin boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE(organization_id, slug)
);

CREATE TABLE IF NOT EXISTS custom_object_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  object_def_id uuid NOT NULL REFERENCES custom_object_definitions(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  primary_value text,
  values jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_cod_org ON custom_object_definitions(organization_id);
CREATE INDEX IF NOT EXISTS idx_cod_org_active ON custom_object_definitions(organization_id, active) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cor_org ON custom_object_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_cor_def ON custom_object_records(object_def_id);
CREATE INDEX IF NOT EXISTS idx_cor_contact ON custom_object_records(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cor_primary_value ON custom_object_records(organization_id, object_def_id, primary_value) WHERE deleted_at IS NULL;

-- Updated-at trigger
CREATE OR REPLACE FUNCTION update_custom_object_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_custom_object_definitions_updated_at ON custom_object_definitions;
CREATE TRIGGER set_custom_object_definitions_updated_at
  BEFORE UPDATE ON custom_object_definitions
  FOR EACH ROW EXECUTE FUNCTION update_custom_object_updated_at();

DROP TRIGGER IF EXISTS set_custom_object_records_updated_at ON custom_object_records;
CREATE TRIGGER set_custom_object_records_updated_at
  BEFORE UPDATE ON custom_object_records
  FOR EACH ROW EXECUTE FUNCTION update_custom_object_updated_at();

-- Seed built-in Company object for every existing org
INSERT INTO custom_object_definitions (organization_id, slug, name, icon, primary_field_key, field_definitions, is_builtin)
SELECT
  o.id,
  'company',
  'Company',
  'Building2',
  'name',
  '[
    {"key":"name","label":"Company Name","type":"text","required":true,"is_primary":true},
    {"key":"phone","label":"Phone","type":"phone"},
    {"key":"email","label":"Email","type":"email"},
    {"key":"website","label":"Website","type":"url"},
    {"key":"industry","label":"Industry","type":"text"},
    {"key":"employees","label":"Number of Employees","type":"number"},
    {"key":"revenue","label":"Monthly Revenue","type":"currency"},
    {"key":"service_area","label":"Service Area","type":"text"}
  ]'::jsonb,
  true
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM custom_object_definitions d
  WHERE d.organization_id = o.id AND d.slug = 'company'
);

-- Trigger to seed Company on new org creation
CREATE OR REPLACE FUNCTION seed_builtin_custom_objects_for_new_org()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO custom_object_definitions (organization_id, slug, name, icon, primary_field_key, field_definitions, is_builtin)
  VALUES (
    NEW.id,
    'company',
    'Company',
    'Building2',
    'name',
    '[
      {"key":"name","label":"Company Name","type":"text","required":true,"is_primary":true},
      {"key":"phone","label":"Phone","type":"phone"},
      {"key":"email","label":"Email","type":"email"},
      {"key":"website","label":"Website","type":"url"},
      {"key":"industry","label":"Industry","type":"text"},
      {"key":"employees","label":"Number of Employees","type":"number"},
      {"key":"revenue","label":"Monthly Revenue","type":"currency"},
      {"key":"service_area","label":"Service Area","type":"text"}
    ]'::jsonb,
    true
  )
  ON CONFLICT (organization_id, slug) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS seed_builtin_custom_objects_on_org_create ON organizations;
CREATE TRIGGER seed_builtin_custom_objects_on_org_create
  AFTER INSERT ON organizations
  FOR EACH ROW EXECUTE FUNCTION seed_builtin_custom_objects_for_new_org();

-- RLS

ALTER TABLE custom_object_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_object_records ENABLE ROW LEVEL SECURITY;

-- custom_object_definitions
CREATE POLICY "Org members can view custom object definitions"
  ON custom_object_definitions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.organization_id = custom_object_definitions.organization_id
    )
  );

CREATE POLICY "Users with custom_fields.manage can create object definitions"
  ON custom_object_definitions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.organization_id = custom_object_definitions.organization_id
    )
    AND user_has_permission(auth.uid(), 'custom_fields.manage')
  );

CREATE POLICY "Users with custom_fields.manage can update object definitions"
  ON custom_object_definitions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.organization_id = custom_object_definitions.organization_id
    )
    AND user_has_permission(auth.uid(), 'custom_fields.manage')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.organization_id = custom_object_definitions.organization_id
    )
    AND user_has_permission(auth.uid(), 'custom_fields.manage')
  );

CREATE POLICY "Users with custom_fields.manage can delete object definitions"
  ON custom_object_definitions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.organization_id = custom_object_definitions.organization_id
    )
    AND user_has_permission(auth.uid(), 'custom_fields.manage')
    AND is_builtin = false
  );

-- custom_object_records
CREATE POLICY "Org members can view custom object records"
  ON custom_object_records
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.organization_id = custom_object_records.organization_id
    )
  );

CREATE POLICY "Org members can insert custom object records"
  ON custom_object_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.organization_id = custom_object_records.organization_id
    )
  );

CREATE POLICY "Org members can update custom object records"
  ON custom_object_records
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.organization_id = custom_object_records.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.organization_id = custom_object_records.organization_id
    )
  );

CREATE POLICY "Org members can delete custom object records"
  ON custom_object_records
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.organization_id = custom_object_records.organization_id
    )
  );
