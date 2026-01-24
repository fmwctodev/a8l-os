/*
  # Custom Fields GHL Parity - Extended Schema

  ## Overview
  This migration extends custom fields with additional columns needed for 
  GoHighLevel feature parity, including option_items with label/value pairs,
  show_in_detail_view visibility flag, allow_duplicate_values setting, and
  description field for groups.

  ## 1. Schema Changes

  ### custom_field_groups (new columns)
  - `description` (text, nullable) - Optional description for the group

  ### custom_fields (new columns)
  - `option_items` (jsonb, nullable) - Array of {label, value} objects for dropdown options
  - `show_in_detail_view` (boolean) - Whether field shows in detail/overview view
  - `allow_duplicate_values` (boolean) - Whether duplicates are allowed for this field
  - `default_value` (jsonb, nullable) - Default value for the field

  ## 2. Data Migration
  - Existing string[] options will be converted to option_items format on read via application code
  - Both formats supported during transition

  ## 3. Security
  - No changes to RLS policies (existing policies cover new columns)
*/

-- Add description column to custom_field_groups
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_field_groups' AND column_name = 'description'
  ) THEN
    ALTER TABLE custom_field_groups ADD COLUMN description text;
  END IF;
END $$;

-- Add option_items column to custom_fields (jsonb for label/value pairs)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_fields' AND column_name = 'option_items'
  ) THEN
    ALTER TABLE custom_fields ADD COLUMN option_items jsonb;
  END IF;
END $$;

-- Add show_in_detail_view column to custom_fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_fields' AND column_name = 'show_in_detail_view'
  ) THEN
    ALTER TABLE custom_fields ADD COLUMN show_in_detail_view boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- Add allow_duplicate_values column to custom_fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_fields' AND column_name = 'allow_duplicate_values'
  ) THEN
    ALTER TABLE custom_fields ADD COLUMN allow_duplicate_values boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- Add default_value column to custom_fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_fields' AND column_name = 'default_value'
  ) THEN
    ALTER TABLE custom_fields ADD COLUMN default_value jsonb;
  END IF;
END $$;

-- Migrate existing options to option_items format where option_items is null but options exists
UPDATE custom_fields
SET option_items = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'label', opt,
      'value', opt
    )
  )
  FROM jsonb_array_elements_text(options) AS opt
)
WHERE options IS NOT NULL 
  AND jsonb_array_length(options) > 0
  AND option_items IS NULL;

-- Index for option_items queries
CREATE INDEX IF NOT EXISTS idx_custom_fields_option_items ON custom_fields USING gin(option_items) WHERE option_items IS NOT NULL;