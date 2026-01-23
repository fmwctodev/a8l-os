/*
  # Seed Sample Contacts Data

  ## Overview
  Creates sample data for testing the Contacts module including:
  - Sample tags for categorization
  - Sample custom fields
  - Sample contacts with various data
  - Sample notes and tasks on contacts
  - Timeline events for activity history

  ## 1. Sample Tags
  - Lead, Customer, VIP, Partner, Prospect, Inactive

  ## 2. Sample Custom Fields
  - Lead Score (number)
  - Preferred Contact Method (select)
  - Newsletter Subscribed (boolean)

  ## 3. Sample Contacts
  - 6 sample contacts across different sources and with various data

  ## Note
  This migration only runs if sample data doesn't already exist
*/

DO $$
DECLARE
  v_org_id uuid;
  v_sales_dept_id uuid;
  v_ops_dept_id uuid;
  v_admin_user_id uuid;
  v_tag_lead_id uuid;
  v_tag_customer_id uuid;
  v_tag_vip_id uuid;
  v_tag_partner_id uuid;
  v_tag_prospect_id uuid;
  v_tag_inactive_id uuid;
  v_cf_lead_score_id uuid;
  v_cf_contact_method_id uuid;
  v_cf_newsletter_id uuid;
  v_contact1_id uuid;
  v_contact2_id uuid;
  v_contact3_id uuid;
  v_contact4_id uuid;
  v_contact5_id uuid;
  v_contact6_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM organizations WHERE name = 'Autom8ion Lab' LIMIT 1;
  
  IF v_org_id IS NULL THEN
    RAISE NOTICE 'No organization found, skipping seed data';
    RETURN;
  END IF;

  SELECT id INTO v_sales_dept_id FROM departments WHERE organization_id = v_org_id AND name = 'Sales' LIMIT 1;
  SELECT id INTO v_ops_dept_id FROM departments WHERE organization_id = v_org_id AND name = 'Operations' LIMIT 1;
  SELECT id INTO v_admin_user_id FROM users WHERE organization_id = v_org_id LIMIT 1;

  IF v_sales_dept_id IS NULL THEN
    INSERT INTO departments (organization_id, name) VALUES (v_org_id, 'Sales') RETURNING id INTO v_sales_dept_id;
  END IF;

  IF v_ops_dept_id IS NULL THEN
    INSERT INTO departments (organization_id, name) VALUES (v_org_id, 'Operations') RETURNING id INTO v_ops_dept_id;
  END IF;

  IF EXISTS (SELECT 1 FROM tags WHERE organization_id = v_org_id) THEN
    RAISE NOTICE 'Tags already exist, skipping seed data';
    RETURN;
  END IF;

  INSERT INTO tags (organization_id, name, color) VALUES
    (v_org_id, 'Lead', '#3B82F6') RETURNING id INTO v_tag_lead_id;
  INSERT INTO tags (organization_id, name, color) VALUES
    (v_org_id, 'Customer', '#10B981') RETURNING id INTO v_tag_customer_id;
  INSERT INTO tags (organization_id, name, color) VALUES
    (v_org_id, 'VIP', '#F59E0B') RETURNING id INTO v_tag_vip_id;
  INSERT INTO tags (organization_id, name, color) VALUES
    (v_org_id, 'Partner', '#8B5CF6') RETURNING id INTO v_tag_partner_id;
  INSERT INTO tags (organization_id, name, color) VALUES
    (v_org_id, 'Prospect', '#06B6D4') RETURNING id INTO v_tag_prospect_id;
  INSERT INTO tags (organization_id, name, color) VALUES
    (v_org_id, 'Inactive', '#6B7280') RETURNING id INTO v_tag_inactive_id;

  INSERT INTO custom_fields (organization_id, name, field_key, field_type, is_required, display_order) VALUES
    (v_org_id, 'Lead Score', 'lead_score', 'number', false, 1) RETURNING id INTO v_cf_lead_score_id;
  INSERT INTO custom_fields (organization_id, name, field_key, field_type, options, is_required, display_order) VALUES
    (v_org_id, 'Preferred Contact Method', 'preferred_contact_method', 'select', '["Email", "Phone", "Text", "In-Person"]', false, 2) RETURNING id INTO v_cf_contact_method_id;
  INSERT INTO custom_fields (organization_id, name, field_key, field_type, is_required, display_order) VALUES
    (v_org_id, 'Newsletter Subscribed', 'newsletter_subscribed', 'boolean', false, 3) RETURNING id INTO v_cf_newsletter_id;

  INSERT INTO contacts (organization_id, department_id, owner_id, first_name, last_name, email, phone, company, job_title, city, state, country, source, created_by_user_id)
  VALUES (v_org_id, v_sales_dept_id, v_admin_user_id, 'Sarah', 'Johnson', 'sarah.johnson@techcorp.com', '(555) 123-4567', 'TechCorp Inc', 'Chief Marketing Officer', 'San Francisco', 'CA', 'USA', 'referral', v_admin_user_id)
  RETURNING id INTO v_contact1_id;

  INSERT INTO contacts (organization_id, department_id, owner_id, first_name, last_name, email, phone, company, job_title, city, state, country, source, created_by_user_id)
  VALUES (v_org_id, v_sales_dept_id, v_admin_user_id, 'Michael', 'Chen', 'mchen@innovate.io', '(555) 234-5678', 'Innovate.io', 'VP of Sales', 'New York', 'NY', 'USA', 'website', v_admin_user_id)
  RETURNING id INTO v_contact2_id;

  INSERT INTO contacts (organization_id, department_id, first_name, last_name, email, phone, company, job_title, city, state, country, source, created_by_user_id)
  VALUES (v_org_id, v_sales_dept_id, 'Emily', 'Rodriguez', 'emily.r@startup.co', '(555) 345-6789', 'Startup Co', 'Founder & CEO', 'Austin', 'TX', 'USA', 'social', v_admin_user_id)
  RETURNING id INTO v_contact3_id;

  INSERT INTO contacts (organization_id, department_id, owner_id, first_name, last_name, email, phone, company, job_title, city, state, country, source, created_by_user_id)
  VALUES (v_org_id, v_ops_dept_id, v_admin_user_id, 'David', 'Kim', 'dkim@enterprise.net', '(555) 456-7890', 'Enterprise Solutions', 'Director of IT', 'Seattle', 'WA', 'USA', 'advertisement', v_admin_user_id)
  RETURNING id INTO v_contact4_id;

  INSERT INTO contacts (organization_id, department_id, first_name, last_name, email, company, city, country, source, created_by_user_id)
  VALUES (v_org_id, v_ops_dept_id, 'Lisa', 'Wang', 'lwang@globaltech.com', 'Global Tech Partners', 'Toronto', 'Canada', 'import', v_admin_user_id)
  RETURNING id INTO v_contact5_id;

  INSERT INTO contacts (organization_id, department_id, first_name, last_name, email, phone, company, job_title, source, created_by_user_id)
  VALUES (v_org_id, v_sales_dept_id, 'James', 'Miller', 'james.miller@acme.com', '(555) 567-8901', 'Acme Industries', 'Procurement Manager', 'manual', v_admin_user_id)
  RETURNING id INTO v_contact6_id;

  INSERT INTO contact_tags (contact_id, tag_id) VALUES
    (v_contact1_id, v_tag_customer_id),
    (v_contact1_id, v_tag_vip_id),
    (v_contact2_id, v_tag_lead_id),
    (v_contact2_id, v_tag_prospect_id),
    (v_contact3_id, v_tag_lead_id),
    (v_contact4_id, v_tag_customer_id),
    (v_contact4_id, v_tag_partner_id),
    (v_contact5_id, v_tag_prospect_id),
    (v_contact6_id, v_tag_lead_id);

  INSERT INTO contact_custom_field_values (contact_id, custom_field_id, value) VALUES
    (v_contact1_id, v_cf_lead_score_id, '95'),
    (v_contact1_id, v_cf_contact_method_id, '"Email"'),
    (v_contact1_id, v_cf_newsletter_id, 'true'),
    (v_contact2_id, v_cf_lead_score_id, '78'),
    (v_contact2_id, v_cf_contact_method_id, '"Phone"'),
    (v_contact3_id, v_cf_lead_score_id, '65'),
    (v_contact3_id, v_cf_newsletter_id, 'true'),
    (v_contact4_id, v_cf_lead_score_id, '88'),
    (v_contact4_id, v_cf_contact_method_id, '"In-Person"');

  IF v_admin_user_id IS NOT NULL THEN
    INSERT INTO contact_notes (contact_id, user_id, content, is_pinned) VALUES
      (v_contact1_id, v_admin_user_id, 'Had a great call with Sarah. She is very interested in our enterprise plan and wants to schedule a demo for her team next week.', true),
      (v_contact1_id, v_admin_user_id, 'Follow-up email sent with pricing information. Waiting for budget approval from her CFO.', false),
      (v_contact2_id, v_admin_user_id, 'Initial discovery call completed. Michael mentioned they are evaluating 3 vendors including us.', false),
      (v_contact3_id, v_admin_user_id, 'Met Emily at the Tech Conference. Very promising startup with Series A funding.', true);

    INSERT INTO contact_tasks (contact_id, created_by_user_id, assigned_to_user_id, title, description, due_date, priority, status) VALUES
      (v_contact1_id, v_admin_user_id, v_admin_user_id, 'Schedule product demo', 'Set up a 1-hour demo session with Sarah and her marketing team', now() + interval '3 days', 'high', 'pending'),
      (v_contact1_id, v_admin_user_id, v_admin_user_id, 'Send case studies', 'Share relevant case studies from similar companies', now() + interval '1 day', 'medium', 'pending'),
      (v_contact2_id, v_admin_user_id, v_admin_user_id, 'Follow up on proposal', 'Check if Michael has reviewed the proposal we sent', now() + interval '2 days', 'high', 'pending'),
      (v_contact3_id, v_admin_user_id, v_admin_user_id, 'Connect on LinkedIn', 'Send LinkedIn connection request', now() - interval '1 day', 'low', 'completed'),
      (v_contact4_id, v_admin_user_id, v_admin_user_id, 'Quarterly review call', 'Schedule Q1 review call to discuss renewal', now() + interval '7 days', 'medium', 'pending');

    INSERT INTO contact_timeline (contact_id, user_id, event_type, event_data) VALUES
      (v_contact1_id, v_admin_user_id, 'created', '{"created_by": "Admin User"}'),
      (v_contact1_id, v_admin_user_id, 'note_added', '{"preview": "Had a great call with Sarah..."}'),
      (v_contact1_id, v_admin_user_id, 'task_created', '{"task_title": "Schedule product demo"}'),
      (v_contact2_id, v_admin_user_id, 'created', '{"created_by": "Admin User"}'),
      (v_contact2_id, v_admin_user_id, 'tag_added', '{"tag_name": "Lead"}'),
      (v_contact3_id, v_admin_user_id, 'created', '{"created_by": "Admin User"}'),
      (v_contact4_id, v_admin_user_id, 'created', '{"created_by": "Admin User"}'),
      (v_contact5_id, v_admin_user_id, 'created', '{"created_by": "Admin User"}'),
      (v_contact6_id, v_admin_user_id, 'created', '{"created_by": "Admin User"}');
  END IF;

  RAISE NOTICE 'Sample contacts data seeded successfully';
END $$;
