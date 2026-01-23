/*
  # Seed Opportunities Sample Data

  This migration creates sample data for the Opportunities module:

  1. Creates a "Sales Pipeline" with 6 stages:
     - New Lead
     - Qualified
     - Discovery
     - Proposal Sent
     - Negotiation
     - Closed

  2. Creates 25 sample opportunities distributed across stages

  3. Creates pipeline custom fields:
     - Lead Source (dropdown)
     - Deal Type (dropdown)
     - Priority Level (dropdown)
     - Budget Confirmed (boolean)

  ## Important Notes
  - Data is only inserted if no pipelines exist in the default organization
  - Uses existing contacts from the seed data
  - Opportunities are randomly assigned to users
*/

DO $$
DECLARE
  v_org_id uuid;
  v_pipeline_id uuid;
  v_stage_new_lead uuid;
  v_stage_qualified uuid;
  v_stage_discovery uuid;
  v_stage_proposal uuid;
  v_stage_negotiation uuid;
  v_stage_closed uuid;
  v_admin_user_id uuid;
  v_contact_ids uuid[];
  v_user_ids uuid[];
  v_dept_id uuid;
  v_i integer;
  v_contact_id uuid;
  v_user_id uuid;
  v_stage_id uuid;
  v_value numeric;
  v_status text;
  v_opp_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM organizations LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE NOTICE 'No organization found, skipping seed';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM pipelines WHERE org_id = v_org_id) THEN
    RAISE NOTICE 'Pipelines already exist, skipping seed';
    RETURN;
  END IF;

  SELECT id INTO v_admin_user_id FROM users WHERE organization_id = v_org_id LIMIT 1;
  SELECT id INTO v_dept_id FROM departments WHERE organization_id = v_org_id LIMIT 1;

  SELECT ARRAY_AGG(id) INTO v_contact_ids 
  FROM (SELECT id FROM contacts WHERE organization_id = v_org_id LIMIT 30) c;

  SELECT ARRAY_AGG(id) INTO v_user_ids 
  FROM users WHERE organization_id = v_org_id AND status = 'active';

  IF v_admin_user_id IS NULL OR array_length(v_contact_ids, 1) IS NULL THEN
    RAISE NOTICE 'No users or contacts found, skipping seed';
    RETURN;
  END IF;

  INSERT INTO pipelines (id, org_id, name, department_id, sort_order)
  VALUES (gen_random_uuid(), v_org_id, 'Sales Pipeline', v_dept_id, 0)
  RETURNING id INTO v_pipeline_id;

  INSERT INTO pipeline_stages (id, org_id, pipeline_id, name, sort_order)
  VALUES 
    (gen_random_uuid(), v_org_id, v_pipeline_id, 'New Lead', 0)
  RETURNING id INTO v_stage_new_lead;

  INSERT INTO pipeline_stages (id, org_id, pipeline_id, name, sort_order)
  VALUES 
    (gen_random_uuid(), v_org_id, v_pipeline_id, 'Qualified', 1)
  RETURNING id INTO v_stage_qualified;

  INSERT INTO pipeline_stages (id, org_id, pipeline_id, name, sort_order)
  VALUES 
    (gen_random_uuid(), v_org_id, v_pipeline_id, 'Discovery', 2)
  RETURNING id INTO v_stage_discovery;

  INSERT INTO pipeline_stages (id, org_id, pipeline_id, name, sort_order)
  VALUES 
    (gen_random_uuid(), v_org_id, v_pipeline_id, 'Proposal Sent', 3)
  RETURNING id INTO v_stage_proposal;

  INSERT INTO pipeline_stages (id, org_id, pipeline_id, name, sort_order)
  VALUES 
    (gen_random_uuid(), v_org_id, v_pipeline_id, 'Negotiation', 4)
  RETURNING id INTO v_stage_negotiation;

  INSERT INTO pipeline_stages (id, org_id, pipeline_id, name, sort_order)
  VALUES 
    (gen_random_uuid(), v_org_id, v_pipeline_id, 'Closed', 5)
  RETURNING id INTO v_stage_closed;

  INSERT INTO pipeline_custom_fields (org_id, pipeline_id, field_key, label, field_type, options, required, filterable, sort_order)
  VALUES 
    (v_org_id, v_pipeline_id, 'lead_source', 'Lead Source', 'dropdown', '["Website", "Referral", "LinkedIn", "Cold Outreach", "Event", "Partner"]', false, true, 0),
    (v_org_id, v_pipeline_id, 'deal_type', 'Deal Type', 'dropdown', '["New Business", "Upsell", "Renewal", "Cross-sell"]', false, true, 1),
    (v_org_id, v_pipeline_id, 'priority_level', 'Priority Level', 'dropdown', '["Low", "Medium", "High", "Critical"]', false, true, 2),
    (v_org_id, v_pipeline_id, 'budget_confirmed', 'Budget Confirmed', 'boolean', '[]', false, true, 3);

  FOR v_i IN 1..25 LOOP
    v_contact_id := v_contact_ids[1 + (v_i % array_length(v_contact_ids, 1))];
    
    IF v_user_ids IS NOT NULL AND array_length(v_user_ids, 1) > 0 THEN
      v_user_id := v_user_ids[1 + (v_i % array_length(v_user_ids, 1))];
    ELSE
      v_user_id := v_admin_user_id;
    END IF;
    
    CASE 
      WHEN v_i <= 5 THEN 
        v_stage_id := v_stage_new_lead;
        v_status := 'open';
      WHEN v_i <= 10 THEN 
        v_stage_id := v_stage_qualified;
        v_status := 'open';
      WHEN v_i <= 14 THEN 
        v_stage_id := v_stage_discovery;
        v_status := 'open';
      WHEN v_i <= 18 THEN 
        v_stage_id := v_stage_proposal;
        v_status := 'open';
      WHEN v_i <= 21 THEN 
        v_stage_id := v_stage_negotiation;
        v_status := 'open';
      WHEN v_i <= 23 THEN 
        v_stage_id := v_stage_closed;
        v_status := 'won';
      ELSE 
        v_stage_id := v_stage_closed;
        v_status := 'lost';
    END CASE;
    
    v_value := (1000 + (random() * 49000))::numeric(10,2);

    INSERT INTO opportunities (
      id, org_id, contact_id, pipeline_id, stage_id, 
      assigned_user_id, department_id, value_amount, currency, 
      status, source, close_date, created_by, 
      closed_at, lost_reason, created_at, updated_at
    )
    VALUES (
      gen_random_uuid(),
      v_org_id,
      v_contact_id,
      v_pipeline_id,
      v_stage_id,
      v_user_id,
      v_dept_id,
      v_value,
      'USD',
      v_status,
      CASE (v_i % 5)
        WHEN 0 THEN 'Website'
        WHEN 1 THEN 'Referral'
        WHEN 2 THEN 'LinkedIn'
        WHEN 3 THEN 'Cold Outreach'
        ELSE 'Event'
      END,
      CASE WHEN v_status = 'open' THEN CURRENT_DATE + ((7 + v_i * 3) || ' days')::interval ELSE NULL END,
      v_admin_user_id,
      CASE WHEN v_status != 'open' THEN now() - ((v_i || ' days')::interval) ELSE NULL END,
      CASE WHEN v_status = 'lost' THEN 'Budget constraints' ELSE NULL END,
      now() - ((30 - v_i || ' days')::interval),
      now() - ((v_i || ' days')::interval)
    )
    RETURNING id INTO v_opp_id;

    INSERT INTO opportunity_timeline_events (
      org_id, opportunity_id, contact_id, event_type, summary, payload, actor_user_id
    )
    VALUES (
      v_org_id,
      v_opp_id,
      v_contact_id,
      'opportunity_created',
      'Opportunity created',
      jsonb_build_object('pipeline_id', v_pipeline_id, 'stage_id', v_stage_id, 'value_amount', v_value),
      v_admin_user_id
    );

  END LOOP;

  RAISE NOTICE 'Created Sales Pipeline with 6 stages and 25 opportunities';
END $$;
