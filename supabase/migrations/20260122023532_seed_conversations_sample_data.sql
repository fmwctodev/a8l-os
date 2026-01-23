/*
  # Conversations Module - Sample Data

  ## Overview
  Seeds sample conversations and messages for development and testing.
  Links to existing sample contacts.

  ## 1. Sample Data
  - 4 conversations with different channels and statuses
  - 15+ messages across conversations
  - Sample inbox events
  - Various unread counts and statuses

  ## 2. Important Notes
  - Uses existing contacts from contacts seed migration
  - All data linked to default organization
*/

DO $$
DECLARE
  v_org_id uuid := '00000000-0000-0000-0000-000000000001';
  v_dept_id uuid;
  v_contact_id_1 uuid;
  v_contact_id_2 uuid;
  v_contact_id_3 uuid;
  v_contact_id_4 uuid;
  v_conv_id_1 uuid;
  v_conv_id_2 uuid;
  v_conv_id_3 uuid;
  v_conv_id_4 uuid;
BEGIN
  SELECT id INTO v_dept_id FROM departments WHERE organization_id = v_org_id LIMIT 1;

  SELECT id INTO v_contact_id_1 FROM contacts
    WHERE organization_id = v_org_id AND email = 'john.smith@acme.com' LIMIT 1;

  SELECT id INTO v_contact_id_2 FROM contacts
    WHERE organization_id = v_org_id AND email = 'sarah.johnson@techstart.io' LIMIT 1;

  SELECT id INTO v_contact_id_3 FROM contacts
    WHERE organization_id = v_org_id AND email = 'mike.wilson@globalcorp.com' LIMIT 1;

  SELECT id INTO v_contact_id_4 FROM contacts
    WHERE organization_id = v_org_id AND email = 'emily.chen@innovate.co' LIMIT 1;

  IF v_contact_id_1 IS NULL THEN
    INSERT INTO contacts (organization_id, department_id, first_name, last_name, email, phone, company, source, status)
    VALUES (v_org_id, v_dept_id, 'John', 'Smith', 'john.smith@acme.com', '+15551234567', 'Acme Corp', 'manual', 'active')
    RETURNING id INTO v_contact_id_1;
  END IF;

  IF v_contact_id_2 IS NULL THEN
    INSERT INTO contacts (organization_id, department_id, first_name, last_name, email, phone, company, source, status)
    VALUES (v_org_id, v_dept_id, 'Sarah', 'Johnson', 'sarah.johnson@techstart.io', '+15559876543', 'TechStart', 'manual', 'active')
    RETURNING id INTO v_contact_id_2;
  END IF;

  IF v_contact_id_3 IS NULL THEN
    INSERT INTO contacts (organization_id, department_id, first_name, last_name, email, phone, company, source, status)
    VALUES (v_org_id, v_dept_id, 'Mike', 'Wilson', 'mike.wilson@globalcorp.com', '+15555551234', 'Global Corp', 'manual', 'active')
    RETURNING id INTO v_contact_id_3;
  END IF;

  IF v_contact_id_4 IS NULL THEN
    INSERT INTO contacts (organization_id, department_id, first_name, last_name, email, phone, company, source, status)
    VALUES (v_org_id, v_dept_id, 'Emily', 'Chen', 'emily.chen@innovate.co', '+15558887777', 'Innovate Co', 'webchat', 'active')
    RETURNING id INTO v_contact_id_4;
  END IF;

  v_conv_id_1 := gen_random_uuid();
  INSERT INTO conversations (id, organization_id, contact_id, department_id, status, unread_count, last_message_at)
  VALUES (v_conv_id_1, v_org_id, v_contact_id_1, v_dept_id, 'open', 2, now() - interval '5 minutes');

  INSERT INTO messages (organization_id, conversation_id, contact_id, channel, direction, body, status, sent_at, metadata) VALUES
    (v_org_id, v_conv_id_1, v_contact_id_1, 'sms', 'inbound', 'Hi, I have a question about my account.', 'delivered', now() - interval '2 hours', '{"from_number": "+15551234567"}'),
    (v_org_id, v_conv_id_1, v_contact_id_1, 'sms', 'outbound', 'Hello John! Id be happy to help. What would you like to know?', 'delivered', now() - interval '1 hour 55 minutes', '{"to_number": "+15551234567"}'),
    (v_org_id, v_conv_id_1, v_contact_id_1, 'sms', 'inbound', 'I want to upgrade my plan to the premium tier.', 'delivered', now() - interval '1 hour 50 minutes', '{"from_number": "+15551234567"}'),
    (v_org_id, v_conv_id_1, v_contact_id_1, 'sms', 'outbound', 'Great choice! The premium tier includes additional features. Let me send you the details.', 'delivered', now() - interval '1 hour 45 minutes', '{"to_number": "+15551234567"}'),
    (v_org_id, v_conv_id_1, v_contact_id_1, 'sms', 'inbound', 'Thanks! Also, can you confirm my billing date?', 'delivered', now() - interval '10 minutes', '{"from_number": "+15551234567"}'),
    (v_org_id, v_conv_id_1, v_contact_id_1, 'sms', 'inbound', 'And my current payment method on file?', 'delivered', now() - interval '5 minutes', '{"from_number": "+15551234567"}');

  INSERT INTO inbox_events (organization_id, conversation_id, event_type, payload)
  VALUES (v_org_id, v_conv_id_1, 'conversation_created', '{"channel": "sms", "contact_name": "John Smith"}');

  v_conv_id_2 := gen_random_uuid();
  INSERT INTO conversations (id, organization_id, contact_id, department_id, status, unread_count, last_message_at)
  VALUES (v_conv_id_2, v_org_id, v_contact_id_2, v_dept_id, 'pending', 0, now() - interval '1 day');

  INSERT INTO messages (organization_id, conversation_id, contact_id, channel, direction, body, subject, status, sent_at, metadata) VALUES
    (v_org_id, v_conv_id_2, v_contact_id_2, 'email', 'inbound', 'Hi team,

I am interested in your enterprise plan. Could you send me more information about pricing and features?

Best regards,
Sarah', 'Enterprise Plan Inquiry', 'delivered', now() - interval '2 days', '{"from_email": "sarah.johnson@techstart.io", "thread_id": "thread_123"}'),
    (v_org_id, v_conv_id_2, v_contact_id_2, 'email', 'outbound', 'Hello Sarah,

Thank you for your interest in our enterprise plan! I have attached our pricing guide and feature comparison.

Would you be available for a call this week to discuss your specific needs?

Best,
Support Team', 'Re: Enterprise Plan Inquiry', 'delivered', now() - interval '1 day 20 hours', '{"to_email": "sarah.johnson@techstart.io", "thread_id": "thread_123"}'),
    (v_org_id, v_conv_id_2, v_contact_id_2, 'email', 'inbound', 'Thanks for the information. Yes, I am available Thursday afternoon. Would 2 PM work?', 'Re: Enterprise Plan Inquiry', 'delivered', now() - interval '1 day', '{"from_email": "sarah.johnson@techstart.io", "thread_id": "thread_123"}');

  INSERT INTO inbox_events (organization_id, conversation_id, event_type, payload) VALUES
    (v_org_id, v_conv_id_2, 'conversation_created', '{"channel": "email", "contact_name": "Sarah Johnson"}'),
    (v_org_id, v_conv_id_2, 'status_changed', '{"new_status": "pending"}');

  v_conv_id_3 := gen_random_uuid();
  INSERT INTO conversations (id, organization_id, contact_id, department_id, status, unread_count, last_message_at)
  VALUES (v_conv_id_3, v_org_id, v_contact_id_3, v_dept_id, 'closed', 0, now() - interval '3 days');

  INSERT INTO messages (organization_id, conversation_id, contact_id, channel, direction, body, status, sent_at, metadata) VALUES
    (v_org_id, v_conv_id_3, v_contact_id_3, 'voice', 'inbound', 'Phone call received - 3 minutes 45 seconds', 'delivered', now() - interval '4 days', '{"call_sid": "CA123abc", "duration": 225, "from_number": "+15555551234"}'),
    (v_org_id, v_conv_id_3, v_contact_id_3, 'sms', 'outbound', 'Hi Mike, following up on our call. Here is the link to schedule your demo: https://demo.example.com', 'delivered', now() - interval '3 days 23 hours', '{"to_number": "+15555551234"}'),
    (v_org_id, v_conv_id_3, v_contact_id_3, 'sms', 'inbound', 'Got it, thanks! I have booked a slot for next Tuesday.', 'delivered', now() - interval '3 days 22 hours', '{"from_number": "+15555551234"}'),
    (v_org_id, v_conv_id_3, v_contact_id_3, 'sms', 'outbound', 'Perfect! Looking forward to it. Let me know if you have any questions before then.', 'delivered', now() - interval '3 days', '{"to_number": "+15555551234"}');

  INSERT INTO call_logs (organization_id, conversation_id, contact_id, twilio_call_sid, direction, from_number, to_number, duration, status)
  VALUES (v_org_id, v_conv_id_3, v_contact_id_3, 'CA123abc', 'inbound', '+15555551234', '+18005551000', 225, 'completed');

  INSERT INTO inbox_events (organization_id, conversation_id, event_type, payload) VALUES
    (v_org_id, v_conv_id_3, 'conversation_created', '{"channel": "voice", "contact_name": "Mike Wilson"}'),
    (v_org_id, v_conv_id_3, 'status_changed', '{"new_status": "closed"}');

  v_conv_id_4 := gen_random_uuid();
  INSERT INTO conversations (id, organization_id, contact_id, department_id, status, unread_count, last_message_at)
  VALUES (v_conv_id_4, v_org_id, v_contact_id_4, v_dept_id, 'open', 1, now() - interval '30 minutes');

  INSERT INTO messages (organization_id, conversation_id, contact_id, channel, direction, body, status, sent_at, metadata) VALUES
    (v_org_id, v_conv_id_4, v_contact_id_4, 'webchat', 'inbound', 'Hello! I am browsing your website and have a question.', 'delivered', now() - interval '35 minutes', '{"visitor_id": "v_abc123", "visitor_name": "Emily Chen"}'),
    (v_org_id, v_conv_id_4, v_contact_id_4, 'webchat', 'outbound', 'Hi Emily! Welcome! How can I help you today?', 'delivered', now() - interval '34 minutes', '{}'),
    (v_org_id, v_conv_id_4, v_contact_id_4, 'webchat', 'inbound', 'Do you offer a free trial?', 'delivered', now() - interval '33 minutes', '{"visitor_id": "v_abc123"}'),
    (v_org_id, v_conv_id_4, v_contact_id_4, 'webchat', 'outbound', 'Yes! We offer a 14-day free trial with full access to all features. Would you like me to set one up for you?', 'delivered', now() - interval '32 minutes', '{}'),
    (v_org_id, v_conv_id_4, v_contact_id_4, 'webchat', 'inbound', 'That would be great! My email is emily.chen@innovate.co', 'delivered', now() - interval '30 minutes', '{"visitor_id": "v_abc123"}');

  INSERT INTO webchat_sessions (organization_id, conversation_id, visitor_id, visitor_name, visitor_email, metadata, last_activity_at)
  VALUES (v_org_id, v_conv_id_4, 'v_abc123', 'Emily Chen', 'emily.chen@innovate.co', '{"page": "/pricing", "referrer": "google.com"}', now() - interval '30 minutes');

  INSERT INTO inbox_events (organization_id, conversation_id, event_type, payload)
  VALUES (v_org_id, v_conv_id_4, 'conversation_created', '{"channel": "webchat", "contact_name": "Emily Chen"}');

END $$;
