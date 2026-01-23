/*
  # Seed Sample Reports

  This migration creates sample reports for demonstration purposes.

  1. Sample Reports Created
    - New Contacts Over Time (bar chart)
    - Conversations by Channel (pie chart)
    - Appointments by Status (table)

  2. Notes
    - Reports are created for the default organization
    - Visibility set to organization-wide
*/

DO $$
DECLARE
  org_id uuid;
  admin_user_id uuid;
BEGIN
  SELECT id INTO org_id FROM organizations LIMIT 1;
  
  SELECT id INTO admin_user_id FROM users WHERE organization_id = org_id LIMIT 1;
  
  IF org_id IS NOT NULL AND admin_user_id IS NOT NULL THEN
    INSERT INTO reports (organization_id, name, description, data_source, config, visualization_type, visibility, created_by)
    VALUES (
      org_id,
      'New Contacts Over Time',
      'Track contact growth with daily breakdown',
      'contacts',
      '{
        "dimensions": [
          {"id": "contacts_dim_0", "field": "created_at", "label": "Created Date", "dataSource": "contacts", "dataType": "date", "dateGrouping": "day"}
        ],
        "metrics": [
          {"id": "contacts_metric_0", "field": "id", "label": "Total Contacts", "dataSource": "contacts", "aggregation": "count"}
        ],
        "filters": [],
        "timeRange": {"type": "preset", "preset": "last_30_days"},
        "sorting": [{"field": "contacts_dim_0", "direction": "asc"}]
      }'::jsonb,
      'bar',
      'organization',
      admin_user_id
    )
    ON CONFLICT DO NOTHING;
    
    INSERT INTO reports (organization_id, name, description, data_source, config, visualization_type, visibility, created_by)
    VALUES (
      org_id,
      'Conversations by Status',
      'Distribution of conversations by current status',
      'conversations',
      '{
        "dimensions": [
          {"id": "conversations_dim_2", "field": "status", "label": "Status", "dataSource": "conversations", "dataType": "string"}
        ],
        "metrics": [
          {"id": "conversations_metric_0", "field": "id", "label": "Total Conversations", "dataSource": "conversations", "aggregation": "count"}
        ],
        "filters": [],
        "timeRange": {"type": "preset", "preset": "all_time"},
        "sorting": []
      }'::jsonb,
      'pie',
      'organization',
      admin_user_id
    )
    ON CONFLICT DO NOTHING;
    
    INSERT INTO reports (organization_id, name, description, data_source, config, visualization_type, visibility, created_by)
    VALUES (
      org_id,
      'Appointment Summary',
      'Overview of appointments by status',
      'appointments',
      '{
        "dimensions": [
          {"id": "appointments_dim_2", "field": "status", "label": "Status", "dataSource": "appointments", "dataType": "string"},
          {"id": "appointments_dim_0", "field": "start_at_utc", "label": "Appointment Date", "dataSource": "appointments", "dataType": "date", "dateGrouping": "week"}
        ],
        "metrics": [
          {"id": "appointments_metric_0", "field": "id", "label": "Total Appointments", "dataSource": "appointments", "aggregation": "count"}
        ],
        "filters": [],
        "timeRange": {"type": "preset", "preset": "last_90_days"},
        "sorting": [{"field": "appointments_dim_0", "direction": "desc"}]
      }'::jsonb,
      'table',
      'organization',
      admin_user_id
    )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;