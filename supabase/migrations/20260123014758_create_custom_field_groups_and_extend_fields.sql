/*
  # Custom Fields Settings - Groups and Extended Schema

  ## Overview
  This migration creates the custom_field_groups table for organizing custom fields
  and extends the existing custom_fields table with additional columns for enhanced
  functionality including scope support (contact vs opportunity), visibility settings,
  and soft delete capability.

  ## 1. New Tables

  ### custom_field_groups
  - `id` (uuid, primary key) - Unique identifier
  - `organization_id` (uuid, FK) - Reference to organization
  - `scope` (text) - 'contact' or 'opportunity' to separate field groups
  - `name` (text) - Group display name
  - `sort_order` (int) - Display order within scope
  - `active` (boolean) - Whether group is active
  - `created_at`, `updated_at` - Timestamps

  ## 2. Schema Changes

  ### custom_fields (extended columns)
  - `scope` (text) - 'contact' or 'opportunity' (defaults to 'contact' for existing)
  - `group_id` (uuid, FK, nullable) - Reference to custom_field_groups
  - `placeholder` (text, nullable) - Placeholder text for input fields
  - `help_text` (text, nullable) - Help tooltip text
  - `visible_in_forms` (boolean) - Show in form builder
  - `visible_in_surveys` (boolean) - Show in survey builder
  - `filterable` (boolean) - Can be used in filters/reports
  - `active` (boolean) - Whether field is active
  - `deleted_at` (timestamptz, nullable) - Soft delete timestamp

  ## 3. Field Type Expansion
  - Extended field_type to include: phone, email, url, datetime, checkbox, radio, currency, file

  ## 4. Indexes
  - Optimized for queries by org_id, scope, group, and active status

  ## 5. Security
  - RLS enabled on custom_field_groups
*/

-- Create custom_field_groups table
CREATE TABLE IF NOT EXISTS custom_field_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('contact', 'opportunity')),
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, scope, name)
);

-- Add new columns to custom_fields table
DO $$
BEGIN
  -- Add scope column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_fields' AND column_name = 'scope'
  ) THEN
    ALTER TABLE custom_fields ADD COLUMN scope text NOT NULL DEFAULT 'contact' CHECK (scope IN ('contact', 'opportunity'));
  END IF;

  -- Add group_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_fields' AND column_name = 'group_id'
  ) THEN
    ALTER TABLE custom_fields ADD COLUMN group_id uuid REFERENCES custom_field_groups(id) ON DELETE SET NULL;
  END IF;

  -- Add placeholder column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_fields' AND column_name = 'placeholder'
  ) THEN
    ALTER TABLE custom_fields ADD COLUMN placeholder text;
  END IF;

  -- Add help_text column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_fields' AND column_name = 'help_text'
  ) THEN
    ALTER TABLE custom_fields ADD COLUMN help_text text;
  END IF;

  -- Add visible_in_forms column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_fields' AND column_name = 'visible_in_forms'
  ) THEN
    ALTER TABLE custom_fields ADD COLUMN visible_in_forms boolean NOT NULL DEFAULT true;
  END IF;

  -- Add visible_in_surveys column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_fields' AND column_name = 'visible_in_surveys'
  ) THEN
    ALTER TABLE custom_fields ADD COLUMN visible_in_surveys boolean NOT NULL DEFAULT true;
  END IF;

  -- Add filterable column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_fields' AND column_name = 'filterable'
  ) THEN
    ALTER TABLE custom_fields ADD COLUMN filterable boolean NOT NULL DEFAULT true;
  END IF;

  -- Add active column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_fields' AND column_name = 'active'
  ) THEN
    ALTER TABLE custom_fields ADD COLUMN active boolean NOT NULL DEFAULT true;
  END IF;

  -- Add deleted_at column for soft delete
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_fields' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE custom_fields ADD COLUMN deleted_at timestamptz;
  END IF;

  -- Add updated_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_fields' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE custom_fields ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

-- Update unique constraint to include scope (need to drop and recreate)
DO $$
BEGIN
  -- Drop existing unique constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'custom_fields_organization_id_field_key_key'
  ) THEN
    ALTER TABLE custom_fields DROP CONSTRAINT custom_fields_organization_id_field_key_key;
  END IF;
END $$;

-- Create new unique constraint including scope
ALTER TABLE custom_fields 
  ADD CONSTRAINT custom_fields_org_scope_field_key_unique UNIQUE (organization_id, scope, field_key);

-- Recreate the field_type constraint to include new types
ALTER TABLE custom_fields DROP CONSTRAINT IF EXISTS custom_fields_field_type_check;
ALTER TABLE custom_fields ADD CONSTRAINT custom_fields_field_type_check 
  CHECK (field_type IN (
    'text', 'textarea', 'number', 'date', 'datetime', 
    'select', 'multi_select', 'boolean', 'checkbox', 'radio',
    'phone', 'email', 'url', 'currency', 'file'
  ));

-- Indexes for custom_field_groups
CREATE INDEX IF NOT EXISTS idx_custom_field_groups_org ON custom_field_groups(organization_id);
CREATE INDEX IF NOT EXISTS idx_custom_field_groups_org_scope ON custom_field_groups(organization_id, scope);
CREATE INDEX IF NOT EXISTS idx_custom_field_groups_org_scope_active ON custom_field_groups(organization_id, scope, active);
CREATE INDEX IF NOT EXISTS idx_custom_field_groups_sort ON custom_field_groups(organization_id, scope, sort_order);

-- Additional indexes for custom_fields
CREATE INDEX IF NOT EXISTS idx_custom_fields_org_scope ON custom_fields(organization_id, scope);
CREATE INDEX IF NOT EXISTS idx_custom_fields_org_scope_active ON custom_fields(organization_id, scope, active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_custom_fields_group ON custom_fields(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_custom_fields_deleted ON custom_fields(organization_id, deleted_at) WHERE deleted_at IS NOT NULL;

-- Enable RLS
ALTER TABLE custom_field_groups ENABLE ROW LEVEL SECURITY;

-- Update trigger for custom_field_groups
CREATE OR REPLACE FUNCTION update_custom_field_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_custom_field_groups_updated_at
  BEFORE UPDATE ON custom_field_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_custom_field_groups_updated_at();

-- Update trigger for custom_fields updated_at
CREATE OR REPLACE FUNCTION update_custom_fields_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_custom_fields_updated_at ON custom_fields;
CREATE TRIGGER set_custom_fields_updated_at
  BEFORE UPDATE ON custom_fields
  FOR EACH ROW
  EXECUTE FUNCTION update_custom_fields_updated_at();
