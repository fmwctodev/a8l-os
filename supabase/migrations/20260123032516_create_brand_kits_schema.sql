/*
  # Create Brand Kits Schema

  1. New Tables
    - `brand_kits`
      - `id` (uuid, primary key)
      - `org_id` (uuid, foreign key to organizations)
      - `name` (text, required)
      - `description` (text, optional)
      - `active` (boolean, default false)
      - `archived_at` (timestamptz, for soft delete)
      - `created_by` (uuid, foreign key to users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `brand_kit_versions`
      - `id` (uuid, primary key)
      - `brand_kit_id` (uuid, foreign key to brand_kits)
      - `version_number` (integer, auto-incremented per kit)
      - `logos` (jsonb, array of logo objects with source_type, drive_file_id, url, storage_path, label, variant)
      - `colors` (jsonb, object with primary, secondary, accent, background, text colors)
      - `fonts` (jsonb, object with primary and secondary font settings)
      - `imagery_refs` (jsonb, optional array of imagery references)
      - `created_by` (uuid, foreign key to users)
      - `created_at` (timestamptz)

  2. Indexes
    - Index on brand_kits.org_id for tenant queries
    - Index on brand_kits.active for filtering
    - Index on brand_kit_versions.brand_kit_id and version_number for version lookups

  3. Functions
    - `get_next_brand_kit_version()` for auto-incrementing version numbers
*/

-- Create brand_kits table
CREATE TABLE IF NOT EXISTS brand_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  active boolean DEFAULT false,
  archived_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create brand_kit_versions table
CREATE TABLE IF NOT EXISTS brand_kit_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_kit_id uuid NOT NULL REFERENCES brand_kits(id) ON DELETE CASCADE,
  version_number integer NOT NULL DEFAULT 1,
  logos jsonb DEFAULT '[]'::jsonb,
  colors jsonb DEFAULT '{}'::jsonb,
  fonts jsonb DEFAULT '{}'::jsonb,
  imagery_refs jsonb DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(brand_kit_id, version_number)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_brand_kits_org_id ON brand_kits(org_id);
CREATE INDEX IF NOT EXISTS idx_brand_kits_active ON brand_kits(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_brand_kits_not_archived ON brand_kits(org_id) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_brand_kit_versions_kit_id ON brand_kit_versions(brand_kit_id);
CREATE INDEX IF NOT EXISTS idx_brand_kit_versions_latest ON brand_kit_versions(brand_kit_id, version_number DESC);

-- Function to get next version number for a brand kit
CREATE OR REPLACE FUNCTION get_next_brand_kit_version(p_brand_kit_id uuid)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  next_version integer;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO next_version
  FROM brand_kit_versions
  WHERE brand_kit_id = p_brand_kit_id;
  
  RETURN next_version;
END;
$$;

-- Trigger to auto-set version_number on insert
CREATE OR REPLACE FUNCTION set_brand_kit_version_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.version_number IS NULL OR NEW.version_number = 1 THEN
    NEW.version_number := get_next_brand_kit_version(NEW.brand_kit_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_brand_kit_version_number
  BEFORE INSERT ON brand_kit_versions
  FOR EACH ROW
  EXECUTE FUNCTION set_brand_kit_version_number();

-- Trigger to update updated_at on brand_kits
CREATE OR REPLACE FUNCTION update_brand_kit_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE brand_kits SET updated_at = now() WHERE id = NEW.brand_kit_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_brand_kit_timestamp
  AFTER INSERT ON brand_kit_versions
  FOR EACH ROW
  EXECUTE FUNCTION update_brand_kit_timestamp();

-- Add comments for documentation
COMMENT ON TABLE brand_kits IS 'Stores brand kit definitions for organizations';
COMMENT ON TABLE brand_kit_versions IS 'Immutable version history for brand kits';
COMMENT ON COLUMN brand_kit_versions.logos IS 'Array of logo objects: [{source_type: "drive"|"url"|"upload", drive_file_id?, url?, storage_path?, label: "primary"|"secondary"|"icon"|"light"|"dark", variant?: "light"|"dark"}]';
COMMENT ON COLUMN brand_kit_versions.colors IS 'Object with color definitions: {primary: {hex, name?}, secondary: {hex, name?}, accent: {hex, name?}, background: {hex, name?}, text: {hex, name?}}';
COMMENT ON COLUMN brand_kit_versions.fonts IS 'Object with font settings: {primary: {name, source?}, secondary: {name, source?}}';
