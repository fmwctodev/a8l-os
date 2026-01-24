/*
  # Add Extended Visibility Options for Custom Fields

  ## Overview
  This migration adds additional visibility control columns to custom_fields table
  to support fine-grained control over where custom fields appear in the system.

  ## New Columns

  ### custom_fields (extended columns)
  - `visible_in_automations` (boolean) - Whether field appears in automation conditions/actions
  - `visible_in_reporting` (boolean) - Whether field appears in reporting dimensions
  - `read_only` (boolean) - Whether field values can be edited in UI
  - `show_in_list_view` (boolean) - Whether field appears in contact/opportunity list views

  ## Notes
  - All columns default to true for backwards compatibility
  - Existing fields will have full visibility by default
*/

-- Add visible_in_automations column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_fields' AND column_name = 'visible_in_automations'
  ) THEN
    ALTER TABLE custom_fields ADD COLUMN visible_in_automations boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- Add visible_in_reporting column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_fields' AND column_name = 'visible_in_reporting'
  ) THEN
    ALTER TABLE custom_fields ADD COLUMN visible_in_reporting boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- Add read_only column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_fields' AND column_name = 'read_only'
  ) THEN
    ALTER TABLE custom_fields ADD COLUMN read_only boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Add show_in_list_view column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_fields' AND column_name = 'show_in_list_view'
  ) THEN
    ALTER TABLE custom_fields ADD COLUMN show_in_list_view boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Add indexes for common visibility queries
CREATE INDEX IF NOT EXISTS idx_custom_fields_visible_automations 
  ON custom_fields(organization_id, scope, visible_in_automations) 
  WHERE visible_in_automations = true AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_custom_fields_visible_reporting 
  ON custom_fields(organization_id, scope, visible_in_reporting) 
  WHERE visible_in_reporting = true AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_custom_fields_list_view 
  ON custom_fields(organization_id, scope, show_in_list_view) 
  WHERE show_in_list_view = true AND deleted_at IS NULL;