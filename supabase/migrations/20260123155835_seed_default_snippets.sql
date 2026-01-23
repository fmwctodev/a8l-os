/*
  # Seed Default System Snippets

  ## Overview
  Creates default system-wide snippets that are available to all users.
  These provide common response templates for typical scenarios.

  ## 1. Default Snippets
  - Greeting: Welcome message for new conversations
  - Follow-up: Check-in after previous interaction
  - Out of Office: Away notification
  - Scheduling: Appointment booking prompt
  - Thank You: Appreciation response
  - Confirmation: Order/booking confirmation
*/

DO $$
DECLARE
  v_org_id uuid;
  v_admin_id uuid;
BEGIN
  -- Get the default organization
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  
  -- Get an admin user to be the creator
  SELECT u.id INTO v_admin_id
  FROM users u
  JOIN roles r ON r.id = u.role_id
  WHERE u.organization_id = v_org_id
  AND r.name IN ('SuperAdmin', 'Admin')
  LIMIT 1;

  -- Only insert if we have an org and admin
  IF v_org_id IS NOT NULL AND v_admin_id IS NOT NULL THEN
    -- Greeting snippet
    INSERT INTO snippets (organization_id, created_by_user_id, name, content, channel_support, scope)
    VALUES (
      v_org_id,
      v_admin_id,
      'Greeting',
      'Hi {{contact.first_name}}! Thanks for reaching out. How can I help you today?',
      ARRAY['sms', 'email'],
      'system'
    )
    ON CONFLICT DO NOTHING;

    -- Follow-up snippet
    INSERT INTO snippets (organization_id, created_by_user_id, name, content, channel_support, scope)
    VALUES (
      v_org_id,
      v_admin_id,
      'Follow Up',
      'Hi {{contact.first_name}}, I wanted to follow up on our previous conversation. Is there anything else I can help you with?',
      ARRAY['sms', 'email'],
      'system'
    )
    ON CONFLICT DO NOTHING;

    -- Out of Office snippet
    INSERT INTO snippets (organization_id, created_by_user_id, name, content, channel_support, scope)
    VALUES (
      v_org_id,
      v_admin_id,
      'Out of Office',
      'Thank you for your message. I''m currently out of the office and will respond as soon as I return. For urgent matters, please contact our main office.',
      ARRAY['sms', 'email'],
      'system'
    )
    ON CONFLICT DO NOTHING;

    -- Scheduling snippet
    INSERT INTO snippets (organization_id, created_by_user_id, name, content, channel_support, scope)
    VALUES (
      v_org_id,
      v_admin_id,
      'Schedule Meeting',
      'I''d love to schedule a time to chat! You can book a meeting directly using our calendar: [booking link]. Let me know if you have any questions!',
      ARRAY['sms', 'email'],
      'system'
    )
    ON CONFLICT DO NOTHING;

    -- Thank You snippet
    INSERT INTO snippets (organization_id, created_by_user_id, name, content, channel_support, scope)
    VALUES (
      v_org_id,
      v_admin_id,
      'Thank You',
      'Thank you so much, {{contact.first_name}}! I really appreciate your time and business. Please don''t hesitate to reach out if you need anything else.',
      ARRAY['sms', 'email'],
      'system'
    )
    ON CONFLICT DO NOTHING;

    -- Confirmation snippet (email only)
    INSERT INTO snippets (organization_id, created_by_user_id, name, content, channel_support, scope)
    VALUES (
      v_org_id,
      v_admin_id,
      'Confirmation',
      'Hi {{contact.first_name}},

This email confirms your recent request. Here are the details:

[Add details here]

If you have any questions or need to make changes, please reply to this email or give us a call.

Best regards',
      ARRAY['email'],
      'system'
    )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
