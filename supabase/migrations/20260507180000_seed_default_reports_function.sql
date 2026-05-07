/*
  # seed_default_reports_for_org() — reusable starter-kit reports

  Drops 5 sensible starter reports into a target org's `reports` table:
    - Open Pipeline by Stage (bar)
    - Open Opportunities (table)
    - Recent Contacts (30 days) (table)
    - Upcoming Appointments (table)
    - Contacts by Source (pie)

  Idempotent: skips any report whose name already exists in the
  target org. Safe to call multiple times.

  Designed for the multi-tenant onboarding flow: when a new org is
  created, the platform admin can call this with the new org's id
  + the seeding user's id to give them a useful Reporting module
  out-of-the-box instead of an empty list.

  BuilderLync was already seeded directly via SQL on 2026-05-07.
  This function captures that seed pattern in source control.
*/

CREATE OR REPLACE FUNCTION public.seed_default_reports_for_org(
  target_org_id uuid,
  seeded_by_user_id uuid
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted int := 0;
BEGIN
  IF target_org_id IS NULL OR seeded_by_user_id IS NULL THEN
    RAISE EXCEPTION 'target_org_id and seeded_by_user_id are required';
  END IF;

  WITH seeds(name, description, data_source, config, visualization_type) AS (
    VALUES
      (
        'Open Pipeline by Stage',
        'Total open opportunity value grouped by pipeline stage.',
        'opportunities',
        '{"dimensions":[{"id":"stage","field":"stage_name","label":"Stage","dataSource":"opportunities","dataType":"string"}],"metrics":[{"id":"value","field":"value_amount","label":"Open value","dataSource":"opportunities","aggregation":"sum","format":"currency"},{"id":"count","field":"id","label":"Count","dataSource":"opportunities","aggregation":"count"}],"filters":[{"id":"status","field":"status","operator":"equals","value":"open","dataType":"string"}],"timeRange":{"type":"preset","preset":"all_time"},"sorting":[{"field":"value","direction":"desc"}]}'::jsonb,
        'bar'
      ),
      (
        'Open Opportunities',
        'List of all open opportunities with stage, pipeline, and contact.',
        'opportunities',
        '{"dimensions":[],"metrics":[],"filters":[{"id":"status","field":"status","operator":"equals","value":"open","dataType":"string"}],"timeRange":{"type":"preset","preset":"all_time"},"sorting":[{"field":"value_amount","direction":"desc"}],"limit":200}'::jsonb,
        'table'
      ),
      (
        'Recent Contacts (30 days)',
        'Contacts created in the last 30 days, newest first.',
        'contacts',
        '{"dimensions":[],"metrics":[],"filters":[],"timeRange":{"type":"preset","preset":"last_30_days"},"sorting":[{"field":"created_at","direction":"desc"}],"limit":100}'::jsonb,
        'table'
      ),
      (
        'Upcoming Appointments',
        'All scheduled appointments from now into the future.',
        'appointments',
        '{"dimensions":[],"metrics":[],"filters":[{"id":"status","field":"status","operator":"equals","value":"scheduled","dataType":"string"}],"timeRange":{"type":"preset","preset":"this_year"},"sorting":[{"field":"start_at_utc","direction":"asc"}],"limit":100}'::jsonb,
        'table'
      ),
      (
        'Contacts by Source',
        'Count of contacts grouped by their origin source.',
        'contacts',
        '{"dimensions":[{"id":"source","field":"source","label":"Source","dataSource":"contacts","dataType":"string"}],"metrics":[{"id":"count","field":"id","label":"Contacts","dataSource":"contacts","aggregation":"count"}],"filters":[],"timeRange":{"type":"preset","preset":"all_time"},"sorting":[{"field":"count","direction":"desc"}]}'::jsonb,
        'pie'
      )
  )
  INSERT INTO reports (organization_id, name, description, data_source, config, visualization_type, visibility, created_by, report_type)
  SELECT target_org_id, s.name, s.description, s.data_source, s.config, s.visualization_type, 'organization', seeded_by_user_id, 'manual'
  FROM seeds s
  WHERE NOT EXISTS (
    SELECT 1 FROM reports r
    WHERE r.organization_id = target_org_id AND r.name = s.name
  );

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END $$;

GRANT EXECUTE ON FUNCTION public.seed_default_reports_for_org(uuid, uuid) TO service_role;
