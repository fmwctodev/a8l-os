/*
  # Create Workflow Analytics Cache Table

  1. New Tables
    - `workflow_analytics_cache`
      - `id` (uuid, primary key) - Unique identifier
      - `org_id` (uuid, FK) - Organization scope
      - `workflow_id` (uuid, FK) - Which workflow this cache is for
      - `cache_key` (text) - Unique key for time range and version filter combo
      - `time_range` (text) - Time range identifier (7d, 30d, 90d, custom)
      - `version_filter` (integer, nullable) - Specific version or null for all
      - `metrics` (jsonb) - Pre-computed analytics metrics
      - `computed_at` (timestamptz) - When metrics were computed
      - `expires_at` (timestamptz) - Cache expiration time

  2. Purpose
    - Cache expensive analytics computations
    - 5-minute TTL for fresh but performant data
    - Scoped by org, workflow, time range, and version

  3. Security
    - Enable RLS with org-scoped policies
    - Only automation.view permission needed for reads
*/

-- Create workflow_analytics_cache table
CREATE TABLE IF NOT EXISTS workflow_analytics_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  cache_key text NOT NULL,
  time_range text NOT NULL,
  version_filter integer,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  CONSTRAINT workflow_analytics_cache_key_unique UNIQUE (org_id, workflow_id, cache_key)
);

-- Create indexes for efficient cache lookups
CREATE INDEX IF NOT EXISTS idx_workflow_analytics_cache_lookup 
  ON workflow_analytics_cache(workflow_id, cache_key, expires_at);

CREATE INDEX IF NOT EXISTS idx_workflow_analytics_cache_expiry 
  ON workflow_analytics_cache(expires_at);

-- Enable RLS
ALTER TABLE workflow_analytics_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view workflow analytics cache in their org"
  ON workflow_analytics_cache
  FOR SELECT
  TO authenticated
  USING (
    org_id = get_user_org_id()
    AND has_permission('automation.view')
  );

CREATE POLICY "Users can create workflow analytics cache in their org"
  ON workflow_analytics_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = get_user_org_id()
    AND has_permission('automation.view')
  );

CREATE POLICY "Users can update workflow analytics cache in their org"
  ON workflow_analytics_cache
  FOR UPDATE
  TO authenticated
  USING (
    org_id = get_user_org_id()
    AND has_permission('automation.view')
  )
  WITH CHECK (
    org_id = get_user_org_id()
    AND has_permission('automation.view')
  );

CREATE POLICY "Users can delete expired cache in their org"
  ON workflow_analytics_cache
  FOR DELETE
  TO authenticated
  USING (
    org_id = get_user_org_id()
    AND has_permission('automation.view')
  );

-- Function to clean expired cache entries (can be called periodically)
CREATE OR REPLACE FUNCTION clean_expired_workflow_analytics_cache()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM workflow_analytics_cache
  WHERE expires_at < now();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
