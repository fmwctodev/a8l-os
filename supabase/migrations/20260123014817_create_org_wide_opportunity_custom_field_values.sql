/*
  # Org-Wide Opportunity Custom Field Values

  ## Overview
  This migration creates a table for storing org-wide opportunity custom field values.
  This is separate from the existing pipeline-specific custom fields system (pipeline_custom_fields 
  and opportunity_custom_field_values tables) which remains untouched.

  The org-wide opportunity custom fields use the same custom_fields table with scope='opportunity'.

  ## 1. New Tables

  ### org_opportunity_custom_field_values
  - `id` (uuid, primary key) - Unique identifier
  - `organization_id` (uuid, FK) - Reference to organization
  - `opportunity_id` (uuid, FK) - Reference to opportunity
  - `custom_field_id` (uuid, FK) - Reference to custom_fields (scope='opportunity')
  - `value` (jsonb) - Field value (supports all types)
  - `created_at`, `updated_at` - Timestamps

  ## 2. Indexes
  - Optimized for common query patterns

  ## 3. Security
  - RLS enabled
*/

-- Create org-wide opportunity custom field values table
CREATE TABLE IF NOT EXISTS org_opportunity_custom_field_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  custom_field_id uuid NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  value jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(opportunity_id, custom_field_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_org_opp_cfv_org ON org_opportunity_custom_field_values(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_opp_cfv_opp ON org_opportunity_custom_field_values(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_org_opp_cfv_field ON org_opportunity_custom_field_values(custom_field_id);

-- Enable RLS
ALTER TABLE org_opportunity_custom_field_values ENABLE ROW LEVEL SECURITY;

-- Update trigger
CREATE OR REPLACE FUNCTION update_org_opp_cfv_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_org_opp_cfv_updated_at
  BEFORE UPDATE ON org_opportunity_custom_field_values
  FOR EACH ROW
  EXECUTE FUNCTION update_org_opp_cfv_updated_at();
