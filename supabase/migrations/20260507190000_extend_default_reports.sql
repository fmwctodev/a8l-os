/*
  # Extend seed_default_reports_for_org() with 6 advanced reports

  Original starter set (5 reports, migration 20260507180000):
    - Open Pipeline by Stage
    - Open Opportunities
    - Recent Contacts (30 days)
    - Upcoming Appointments
    - Contacts by Source

  Adds:
    - Revenue This Month (bar) — payments grouped by week, sum amount
    - Conversion Funnel (bar) — opps by stage with count
    - Won vs Lost Opportunities (pie)
    - Outstanding Invoices (table)
    - Top Customers by Revenue (bar) — sum payments by contact
    - Appointment Status Breakdown (pie)

  Idempotent — function still skips reports whose name already exists
  in the target org. Safe to re-run for any tenant.

  Function is CREATE OR REPLACE so the body just gets atomically
  swapped; no data migration needed.
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
      -- ===== Starter set (5) =====
      ('Open Pipeline by Stage', 'Total open opportunity value grouped by pipeline stage.', 'opportunities',
        '{"dimensions":[{"id":"stage","field":"stage_name","label":"Stage","dataSource":"opportunities","dataType":"string"}],"metrics":[{"id":"value","field":"value_amount","label":"Open value","dataSource":"opportunities","aggregation":"sum","format":"currency"},{"id":"count","field":"id","label":"Count","dataSource":"opportunities","aggregation":"count"}],"filters":[{"id":"status","field":"status","operator":"equals","value":"open","dataType":"string"}],"timeRange":{"type":"preset","preset":"all_time"},"sorting":[{"field":"value","direction":"desc"}]}'::jsonb, 'bar'),
      ('Open Opportunities', 'List of all open opportunities with stage, pipeline, and contact.', 'opportunities',
        '{"dimensions":[],"metrics":[],"filters":[{"id":"status","field":"status","operator":"equals","value":"open","dataType":"string"}],"timeRange":{"type":"preset","preset":"all_time"},"sorting":[{"field":"value_amount","direction":"desc"}],"limit":200}'::jsonb, 'table'),
      ('Recent Contacts (30 days)', 'Contacts created in the last 30 days, newest first.', 'contacts',
        '{"dimensions":[],"metrics":[],"filters":[],"timeRange":{"type":"preset","preset":"last_30_days"},"sorting":[{"field":"created_at","direction":"desc"}],"limit":100}'::jsonb, 'table'),
      ('Upcoming Appointments', 'All scheduled appointments from now into the future.', 'appointments',
        '{"dimensions":[],"metrics":[],"filters":[{"id":"status","field":"status","operator":"equals","value":"scheduled","dataType":"string"}],"timeRange":{"type":"preset","preset":"this_year"},"sorting":[{"field":"start_at_utc","direction":"asc"}],"limit":100}'::jsonb, 'table'),
      ('Contacts by Source', 'Count of contacts grouped by their origin source.', 'contacts',
        '{"dimensions":[{"id":"source","field":"source","label":"Source","dataSource":"contacts","dataType":"string"}],"metrics":[{"id":"count","field":"id","label":"Contacts","dataSource":"contacts","aggregation":"count"}],"filters":[],"timeRange":{"type":"preset","preset":"all_time"},"sorting":[{"field":"count","direction":"desc"}]}'::jsonb, 'pie'),

      -- ===== Advanced set (6) =====
      ('Revenue This Month', 'Payments received this month, broken down by week.', 'payments',
        '{"dimensions":[{"id":"paid_week","field":"paid_at","label":"Week","dataSource":"payments","dataType":"date","dateGrouping":"week"}],"metrics":[{"id":"revenue","field":"amount","label":"Revenue","dataSource":"payments","aggregation":"sum","format":"currency"},{"id":"count","field":"id","label":"Payments","dataSource":"payments","aggregation":"count"}],"filters":[],"timeRange":{"type":"preset","preset":"this_month"},"sorting":[{"field":"paid_week","direction":"asc"}]}'::jsonb, 'bar'),

      ('Conversion Funnel', 'Count of opportunities at each stage — the funnel shape across your pipeline.', 'opportunities',
        '{"dimensions":[{"id":"stage","field":"stage_name","label":"Stage","dataSource":"opportunities","dataType":"string"}],"metrics":[{"id":"count","field":"id","label":"Opportunities","dataSource":"opportunities","aggregation":"count"},{"id":"value","field":"value_amount","label":"Total value","dataSource":"opportunities","aggregation":"sum","format":"currency"}],"filters":[],"timeRange":{"type":"preset","preset":"all_time"},"sorting":[{"field":"count","direction":"desc"}]}'::jsonb, 'bar'),

      ('Won vs Lost Opportunities', 'Closed opportunities split between won and lost.', 'opportunities',
        '{"dimensions":[{"id":"status","field":"status","label":"Outcome","dataSource":"opportunities","dataType":"string"}],"metrics":[{"id":"count","field":"id","label":"Count","dataSource":"opportunities","aggregation":"count"},{"id":"value","field":"value_amount","label":"Total value","dataSource":"opportunities","aggregation":"sum","format":"currency"}],"filters":[{"id":"status","field":"status","operator":"in","value":["closed_won","closed_lost"],"dataType":"string"}],"timeRange":{"type":"preset","preset":"all_time"},"sorting":[{"field":"count","direction":"desc"}]}'::jsonb, 'pie'),

      ('Outstanding Invoices', 'Invoices that have been sent but not yet paid, plus overdue ones.', 'invoices',
        '{"dimensions":[],"metrics":[],"filters":[{"id":"status","field":"status","operator":"in","value":["sent","overdue"],"dataType":"string"}],"timeRange":{"type":"preset","preset":"all_time"},"sorting":[{"field":"due_date","direction":"asc"}],"limit":200}'::jsonb, 'table'),

      ('Top Customers by Revenue', 'Top 20 contacts ranked by total payments received.', 'payments',
        '{"dimensions":[{"id":"contact","field":"contact_first_name","label":"Customer","dataSource":"payments","dataType":"string"}],"metrics":[{"id":"revenue","field":"amount","label":"Revenue","dataSource":"payments","aggregation":"sum","format":"currency"},{"id":"payments","field":"id","label":"Payments","dataSource":"payments","aggregation":"count"}],"filters":[],"timeRange":{"type":"preset","preset":"all_time"},"sorting":[{"field":"revenue","direction":"desc"}],"limit":20}'::jsonb, 'bar'),

      ('Appointment Status Breakdown', 'Distribution of appointments across scheduled / completed / no-show / canceled.', 'appointments',
        '{"dimensions":[{"id":"status","field":"status","label":"Status","dataSource":"appointments","dataType":"string"}],"metrics":[{"id":"count","field":"id","label":"Appointments","dataSource":"appointments","aggregation":"count"}],"filters":[],"timeRange":{"type":"preset","preset":"this_year"},"sorting":[{"field":"count","direction":"desc"}]}'::jsonb, 'pie')
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
