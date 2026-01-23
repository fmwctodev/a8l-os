/*
  # Seed Calendars Sample Data

  1. Sample Calendars
    - User Calendar: "John's Calendar" owned by first user
    - Team Calendar: "Sales Team" with multiple members

  2. Sample Appointment Types
    - 30 Minute Consultation (user calendar)
    - Discovery Call (team calendar)
    - Product Demo (team calendar)

  3. Sample Availability Rules
    - Standard business hours (9am-5pm Mon-Fri)

  4. Sample Appointments
    - A few upcoming appointments for demonstration
*/

DO $$
DECLARE
  v_org_id uuid;
  v_dept_id uuid;
  v_user_1_id uuid;
  v_user_2_id uuid;
  v_user_3_id uuid;
  v_user_calendar_id uuid;
  v_team_calendar_id uuid;
  v_type_1_id uuid;
  v_type_2_id uuid;
  v_type_3_id uuid;
  v_contact_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  IF v_org_id IS NULL THEN
    RAISE NOTICE 'No organization found, skipping seed data';
    RETURN;
  END IF;

  SELECT id INTO v_dept_id FROM departments WHERE organization_id = v_org_id LIMIT 1;

  SELECT id INTO v_user_1_id FROM users WHERE organization_id = v_org_id ORDER BY created_at ASC LIMIT 1;
  SELECT id INTO v_user_2_id FROM users WHERE organization_id = v_org_id AND id != v_user_1_id ORDER BY created_at ASC LIMIT 1;
  SELECT id INTO v_user_3_id FROM users WHERE organization_id = v_org_id AND id NOT IN (v_user_1_id, COALESCE(v_user_2_id, v_user_1_id)) ORDER BY created_at ASC LIMIT 1;

  IF v_user_1_id IS NULL THEN
    RAISE NOTICE 'No users found, skipping seed data';
    RETURN;
  END IF;

  INSERT INTO calendars (id, org_id, type, name, slug, department_id, owner_user_id, settings)
  VALUES (
    gen_random_uuid(),
    v_org_id,
    'user',
    'My Calendar',
    'my-calendar',
    v_dept_id,
    v_user_1_id,
    '{"assignment_mode": "round_robin", "last_assigned_index": 0}'::jsonb
  )
  ON CONFLICT (org_id, slug) DO NOTHING
  RETURNING id INTO v_user_calendar_id;

  IF v_user_calendar_id IS NULL THEN
    SELECT id INTO v_user_calendar_id FROM calendars WHERE org_id = v_org_id AND slug = 'my-calendar';
  END IF;

  INSERT INTO calendars (id, org_id, type, name, slug, department_id, settings)
  VALUES (
    gen_random_uuid(),
    v_org_id,
    'team',
    'Sales Team',
    'sales-team',
    v_dept_id,
    '{"assignment_mode": "round_robin", "last_assigned_index": 0}'::jsonb
  )
  ON CONFLICT (org_id, slug) DO NOTHING
  RETURNING id INTO v_team_calendar_id;

  IF v_team_calendar_id IS NULL THEN
    SELECT id INTO v_team_calendar_id FROM calendars WHERE org_id = v_org_id AND slug = 'sales-team';
  END IF;

  IF v_team_calendar_id IS NOT NULL AND v_user_1_id IS NOT NULL THEN
    INSERT INTO calendar_members (calendar_id, user_id, weight, priority, active)
    VALUES (v_team_calendar_id, v_user_1_id, 2, 8, true)
    ON CONFLICT (calendar_id, user_id) DO NOTHING;
  END IF;

  IF v_team_calendar_id IS NOT NULL AND v_user_2_id IS NOT NULL THEN
    INSERT INTO calendar_members (calendar_id, user_id, weight, priority, active)
    VALUES (v_team_calendar_id, v_user_2_id, 1, 5, true)
    ON CONFLICT (calendar_id, user_id) DO NOTHING;
  END IF;

  IF v_team_calendar_id IS NOT NULL AND v_user_3_id IS NOT NULL THEN
    INSERT INTO calendar_members (calendar_id, user_id, weight, priority, active)
    VALUES (v_team_calendar_id, v_user_3_id, 1, 3, true)
    ON CONFLICT (calendar_id, user_id) DO NOTHING;
  END IF;

  IF v_user_calendar_id IS NOT NULL THEN
    INSERT INTO appointment_types (id, org_id, calendar_id, name, slug, description, duration_minutes, location_type, generate_google_meet, questions)
    VALUES (
      gen_random_uuid(),
      v_org_id,
      v_user_calendar_id,
      '30 Minute Consultation',
      '30-min-consultation',
      'A quick consultation to discuss your needs and how we can help.',
      30,
      'google_meet',
      true,
      '[{"id":"name","label":"Your Name","type":"text","required":true},{"id":"email","label":"Email Address","type":"text","required":true},{"id":"phone","label":"Phone Number","type":"text","required":false}]'::jsonb
    )
    ON CONFLICT (calendar_id, slug) DO NOTHING
    RETURNING id INTO v_type_1_id;
  END IF;

  IF v_team_calendar_id IS NOT NULL THEN
    INSERT INTO appointment_types (id, org_id, calendar_id, name, slug, description, duration_minutes, location_type, generate_google_meet, questions)
    VALUES (
      gen_random_uuid(),
      v_org_id,
      v_team_calendar_id,
      'Discovery Call',
      'discovery-call',
      'Let us learn about your business and explore how we can work together.',
      45,
      'google_meet',
      true,
      '[{"id":"name","label":"Your Name","type":"text","required":true},{"id":"email","label":"Email Address","type":"text","required":true},{"id":"phone","label":"Phone Number","type":"text","required":false},{"id":"company","label":"Company Name","type":"text","required":false}]'::jsonb
    )
    ON CONFLICT (calendar_id, slug) DO NOTHING
    RETURNING id INTO v_type_2_id;

    INSERT INTO appointment_types (id, org_id, calendar_id, name, slug, description, duration_minutes, location_type, generate_google_meet, questions, max_per_day)
    VALUES (
      gen_random_uuid(),
      v_org_id,
      v_team_calendar_id,
      'Product Demo',
      'product-demo',
      'See our product in action with a personalized demonstration.',
      60,
      'google_meet',
      true,
      '[{"id":"name","label":"Your Name","type":"text","required":true},{"id":"email","label":"Email Address","type":"text","required":true},{"id":"phone","label":"Phone Number","type":"text","required":true},{"id":"company","label":"Company Name","type":"text","required":true},{"id":"role","label":"Your Role","type":"text","required":false}]'::jsonb,
      5
    )
    ON CONFLICT (calendar_id, slug) DO NOTHING
    RETURNING id INTO v_type_3_id;
  END IF;

  IF v_user_calendar_id IS NOT NULL THEN
    INSERT INTO availability_rules (org_id, calendar_id, user_id, timezone, rules, overrides)
    VALUES (
      v_org_id,
      v_user_calendar_id,
      NULL,
      'America/New_York',
      '{
        "monday": [{"start": "09:00", "end": "17:00"}],
        "tuesday": [{"start": "09:00", "end": "17:00"}],
        "wednesday": [{"start": "09:00", "end": "17:00"}],
        "thursday": [{"start": "09:00", "end": "17:00"}],
        "friday": [{"start": "09:00", "end": "17:00"}],
        "saturday": [],
        "sunday": []
      }'::jsonb,
      '[]'::jsonb
    )
    ON CONFLICT (calendar_id, user_id) DO NOTHING;
  END IF;

  IF v_team_calendar_id IS NOT NULL THEN
    INSERT INTO availability_rules (org_id, calendar_id, user_id, timezone, rules, overrides)
    VALUES (
      v_org_id,
      v_team_calendar_id,
      NULL,
      'America/New_York',
      '{
        "monday": [{"start": "09:00", "end": "12:00"}, {"start": "13:00", "end": "18:00"}],
        "tuesday": [{"start": "09:00", "end": "12:00"}, {"start": "13:00", "end": "18:00"}],
        "wednesday": [{"start": "09:00", "end": "12:00"}, {"start": "13:00", "end": "18:00"}],
        "thursday": [{"start": "09:00", "end": "12:00"}, {"start": "13:00", "end": "18:00"}],
        "friday": [{"start": "09:00", "end": "12:00"}, {"start": "13:00", "end": "17:00"}],
        "saturday": [],
        "sunday": []
      }'::jsonb,
      '[]'::jsonb
    )
    ON CONFLICT (calendar_id, user_id) DO NOTHING;
  END IF;

  SELECT id INTO v_contact_id FROM contacts WHERE organization_id = v_org_id LIMIT 1;

  IF v_type_2_id IS NOT NULL AND v_contact_id IS NOT NULL AND v_user_1_id IS NOT NULL THEN
    INSERT INTO appointments (
      org_id, calendar_id, appointment_type_id, contact_id, assigned_user_id,
      status, start_at_utc, end_at_utc, visitor_timezone, answers, source
    )
    VALUES (
      v_org_id,
      v_team_calendar_id,
      v_type_2_id,
      v_contact_id,
      v_user_1_id,
      'scheduled',
      (CURRENT_DATE + INTERVAL '2 days' + INTERVAL '10 hours')::timestamptz,
      (CURRENT_DATE + INTERVAL '2 days' + INTERVAL '10 hours' + INTERVAL '45 minutes')::timestamptz,
      'America/New_York',
      '{"name": "John Smith", "email": "john@example.com", "phone": "+1234567890"}'::jsonb,
      'booking'
    )
    ON CONFLICT DO NOTHING;

    INSERT INTO appointments (
      org_id, calendar_id, appointment_type_id, contact_id, assigned_user_id,
      status, start_at_utc, end_at_utc, visitor_timezone, answers, source
    )
    VALUES (
      v_org_id,
      v_team_calendar_id,
      v_type_2_id,
      v_contact_id,
      COALESCE(v_user_2_id, v_user_1_id),
      'scheduled',
      (CURRENT_DATE + INTERVAL '3 days' + INTERVAL '14 hours')::timestamptz,
      (CURRENT_DATE + INTERVAL '3 days' + INTERVAL '14 hours' + INTERVAL '45 minutes')::timestamptz,
      'America/New_York',
      '{"name": "Jane Doe", "email": "jane@example.com"}'::jsonb,
      'booking'
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RAISE NOTICE 'Calendar sample data seeded successfully';
END $$;