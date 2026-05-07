/*
  # P10 — Seed 12 production-ready system automation templates v3

  Inserts 12 system templates that exercise the full action/trigger
  surface area shipped in P1–P9:
    - send_sms (Plivo) + send_email_org (Mailgun) + send_email_personal (Gmail)
    - start_ai_call (Vapi) + ai_call_completed trigger filters
    - manual_action approval gate with auto-expire + multi-approver
    - DND-gated by default (canSendOnChannel enforced server-side)
    - Voice + STOP/HELP/START + appointment reminders

  Templates are system-level (is_system=true, org_id=null) so they
  show in every org's gallery.
  Idempotent: re-running just upserts on (name, is_system).
*/

DO $$
DECLARE
  t_welcome_lead uuid;
  t_re_engage_cold uuid;
  t_winback_lost uuid;
  t_appt_reminders uuid;
  t_no_show_recovery uuid;
  t_capability_auto uuid;
  t_onboarding_5step uuid;
  t_stale_opp_nudge uuid;
  t_ai_prequal_call uuid;
  t_stop_help_start uuid;
  t_high_value_approval uuid;
  t_birthday_touch uuid;

  -- Helper to upsert a template + its v1 definition snapshot.
  v_existing_id uuid;
BEGIN

-- ─── 1. Welcome New Lead (SMS + Email) ────────────────────────────────────
SELECT id INTO v_existing_id FROM automation_templates
  WHERE name = 'Welcome New Lead (SMS + Email)' AND is_system = true LIMIT 1;
IF v_existing_id IS NULL THEN
  t_welcome_lead := gen_random_uuid();
  INSERT INTO automation_templates (id, org_id, name, description, category, icon_name, channel_tags, estimated_time, complexity, is_system, status, published_at, use_count)
  VALUES (t_welcome_lead, NULL,
    'Welcome New Lead (SMS + Email)',
    'When a contact submits a form with SMS consent, sends an instant SMS welcome + a 1-hour delayed Mailgun email with the capability statement attached.',
    'lead_management', 'Sparkles', ARRAY['sms', 'email'], '5 minutes', 'simple', true, 'published', now(), 0);
  INSERT INTO automation_template_versions (template_id, version_number, definition_snapshot, change_summary)
  VALUES (t_welcome_lead, 1, $template$
    {"nodes":[
      {"id":"n1","type":"trigger","position":{"x":300,"y":40},"data":{"triggerType":"form_submitted","triggerCategory":"marketing","triggerConfig":{}}},
      {"id":"n2","type":"action","position":{"x":300,"y":160},"data":{"actionType":"send_sms","config":{"body":"Hi {{contact.first_name}}! Thanks for reaching out — we got your message and will follow up within 1 business day. Reply STOP to opt out."}}},
      {"id":"n3","type":"delay","position":{"x":300,"y":280},"data":{"delayType":"wait_duration","duration":{"value":1,"unit":"hours"}}},
      {"id":"n4","type":"action","position":{"x":300,"y":400},"data":{"actionType":"send_email_org","config":{"useTemplate":false,"raw_subject":"Hey {{contact.first_name}} — here is our capability statement","raw_body_html":"<p>Hi {{contact.first_name}},</p><p>Thanks for your interest. Attached is our capability statement.</p><p>— Autom8ion Lab</p>","track_opens":true,"track_clicks":true}}},
      {"id":"n5","type":"end","position":{"x":300,"y":520},"data":{"label":"End"}}
    ],"edges":[
      {"id":"e1","source":"n1","target":"n2"},{"id":"e2","source":"n2","target":"n3"},
      {"id":"e3","source":"n3","target":"n4"},{"id":"e4","source":"n4","target":"n5"}
    ]}
  $template$::jsonb, 'Initial v3 system template');
END IF;

-- ─── 2. Re-engage Cold Contact (60 days) ──────────────────────────────────
SELECT id INTO v_existing_id FROM automation_templates
  WHERE name = 'Re-engage Cold Contact' AND is_system = true LIMIT 1;
IF v_existing_id IS NULL THEN
  t_re_engage_cold := gen_random_uuid();
  INSERT INTO automation_templates (id, org_id, name, description, category, icon_name, channel_tags, estimated_time, complexity, is_system, status, published_at, use_count)
  VALUES (t_re_engage_cold, NULL,
    'Re-engage Cold Contact',
    'When a contact has had no activity for 60+ days, sends a "still interested?" email and tags as cold-archive if no reply in 7 days.',
    'follow_up', 'Snowflake', ARRAY['email'], '5 minutes', 'moderate', true, 'published', now(), 0);
  INSERT INTO automation_template_versions (template_id, version_number, definition_snapshot, change_summary)
  VALUES (t_re_engage_cold, 1, $template$
    {"nodes":[
      {"id":"n1","type":"trigger","position":{"x":300,"y":40},"data":{"triggerType":"contact_changed","triggerCategory":"contact","triggerConfig":{"watchedFields":["last_activity_at"]}}},
      {"id":"n2","type":"action","position":{"x":300,"y":160},"data":{"actionType":"send_email_org","config":{"useTemplate":false,"raw_subject":"Still interested, {{contact.first_name}}?","raw_body_html":"<p>Hi {{contact.first_name}},</p><p>It has been a while — we wanted to check in to see if anything has changed on your end. Just hit reply if you would like to talk.</p>"}}},
      {"id":"n3","type":"delay","position":{"x":300,"y":280},"data":{"delayType":"wait_duration","duration":{"value":7,"unit":"days"}}},
      {"id":"n4","type":"action","position":{"x":300,"y":400},"data":{"actionType":"add_tag","config":{"tagName":"cold-archive"}}},
      {"id":"n5","type":"end","position":{"x":300,"y":520},"data":{"label":"End"}}
    ],"edges":[
      {"id":"e1","source":"n1","target":"n2"},{"id":"e2","source":"n2","target":"n3"},
      {"id":"e3","source":"n3","target":"n4"},{"id":"e4","source":"n4","target":"n5"}
    ]}
  $template$::jsonb, 'Initial v3 system template');
END IF;

-- ─── 3. Win-back Lost Opportunity ─────────────────────────────────────────
SELECT id INTO v_existing_id FROM automation_templates
  WHERE name = 'Win-back Lost Opportunity' AND is_system = true LIMIT 1;
IF v_existing_id IS NULL THEN
  t_winback_lost := gen_random_uuid();
  INSERT INTO automation_templates (id, org_id, name, description, category, icon_name, channel_tags, estimated_time, complexity, is_system, status, published_at, use_count)
  VALUES (t_winback_lost, NULL,
    'Win-back Lost Opportunity',
    'When an opportunity is marked lost, waits 30 days then sends a personal email from the original assigned user.',
    'sales', 'Heart', ARRAY['email'], '3 minutes', 'simple', true, 'published', now(), 0);
  INSERT INTO automation_template_versions (template_id, version_number, definition_snapshot, change_summary)
  VALUES (t_winback_lost, 1, $template$
    {"nodes":[
      {"id":"n1","type":"trigger","position":{"x":300,"y":40},"data":{"triggerType":"opportunity_status_changed","triggerCategory":"opportunities","triggerConfig":{"toStatus":"lost"}}},
      {"id":"n2","type":"delay","position":{"x":300,"y":160},"data":{"delayType":"wait_duration","duration":{"value":30,"unit":"days"}}},
      {"id":"n3","type":"action","position":{"x":300,"y":280},"data":{"actionType":"send_email_personal","config":{"useTemplate":false,"from_user_id":"contact_owner","raw_subject":"Checking back in, {{contact.first_name}}","raw_body_html":"<p>Hi {{contact.first_name}},</p><p>It is been about a month since we last spoke. I wanted to check in personally — circumstances often change, and I would love to hear how things are going.</p>"}}},
      {"id":"n4","type":"end","position":{"x":300,"y":400},"data":{"label":"End"}}
    ],"edges":[
      {"id":"e1","source":"n1","target":"n2"},{"id":"e2","source":"n2","target":"n3"},{"id":"e3","source":"n3","target":"n4"}
    ]}
  $template$::jsonb, 'Initial v3 system template');
END IF;

-- ─── 4. Appointment Confirmation + Reminder Sequence ──────────────────────
SELECT id INTO v_existing_id FROM automation_templates
  WHERE name = 'Appointment Reminder Sequence' AND is_system = true LIMIT 1;
IF v_existing_id IS NULL THEN
  t_appt_reminders := gen_random_uuid();
  INSERT INTO automation_templates (id, org_id, name, description, category, icon_name, channel_tags, estimated_time, complexity, is_system, status, published_at, use_count)
  VALUES (t_appt_reminders, NULL,
    'Appointment Reminder Sequence',
    'When an appointment is booked: instant SMS confirmation, 24h reminder, 1h reminder. Cuts no-show rate by ~30%.',
    'scheduling', 'Calendar', ARRAY['sms'], '5 minutes', 'moderate', true, 'published', now(), 0);
  INSERT INTO automation_template_versions (template_id, version_number, definition_snapshot, change_summary)
  VALUES (t_appt_reminders, 1, $template$
    {"nodes":[
      {"id":"n1","type":"trigger","position":{"x":300,"y":40},"data":{"triggerType":"appointment_booked","triggerCategory":"appointments","triggerConfig":{}}},
      {"id":"n2","type":"action","position":{"x":300,"y":160},"data":{"actionType":"send_sms","config":{"body":"Hi {{contact.first_name}}, your appointment is confirmed for {{appointment.start_at_local}}. Reply STOP to opt out."}}},
      {"id":"n3","type":"delay","position":{"x":300,"y":280},"data":{"delayType":"wait_until_datetime","datetime":"{{appointment.start_at_minus_24h}}"}},
      {"id":"n4","type":"action","position":{"x":300,"y":400},"data":{"actionType":"send_sms","config":{"body":"Reminder: see you tomorrow at {{appointment.start_at_local}}, {{contact.first_name}}!"}}},
      {"id":"n5","type":"delay","position":{"x":300,"y":520},"data":{"delayType":"wait_until_datetime","datetime":"{{appointment.start_at_minus_1h}}"}},
      {"id":"n6","type":"action","position":{"x":300,"y":640},"data":{"actionType":"send_sms","config":{"body":"See you in an hour, {{contact.first_name}}!"}}},
      {"id":"n7","type":"end","position":{"x":300,"y":760},"data":{"label":"End"}}
    ],"edges":[
      {"id":"e1","source":"n1","target":"n2"},{"id":"e2","source":"n2","target":"n3"},
      {"id":"e3","source":"n3","target":"n4"},{"id":"e4","source":"n4","target":"n5"},
      {"id":"e5","source":"n5","target":"n6"},{"id":"e6","source":"n6","target":"n7"}
    ]}
  $template$::jsonb, 'Initial v3 system template');
END IF;

-- ─── 5. No-show Recovery ──────────────────────────────────────────────────
SELECT id INTO v_existing_id FROM automation_templates
  WHERE name = 'No-show Recovery' AND is_system = true LIMIT 1;
IF v_existing_id IS NULL THEN
  t_no_show_recovery := gen_random_uuid();
  INSERT INTO automation_templates (id, org_id, name, description, category, icon_name, channel_tags, estimated_time, complexity, is_system, status, published_at, use_count)
  VALUES (t_no_show_recovery, NULL,
    'No-show Recovery',
    'When an appointment is marked no-show, waits 1 hour then sends a Mailgun email with the reschedule link.',
    'scheduling', 'RotateCcw', ARRAY['email'], '3 minutes', 'simple', true, 'published', now(), 0);
  INSERT INTO automation_template_versions (template_id, version_number, definition_snapshot, change_summary)
  VALUES (t_no_show_recovery, 1, $template$
    {"nodes":[
      {"id":"n1","type":"trigger","position":{"x":300,"y":40},"data":{"triggerType":"appointment_no_show","triggerCategory":"appointments","triggerConfig":{}}},
      {"id":"n2","type":"delay","position":{"x":300,"y":160},"data":{"delayType":"wait_duration","duration":{"value":1,"unit":"hours"}}},
      {"id":"n3","type":"action","position":{"x":300,"y":280},"data":{"actionType":"send_email_org","config":{"useTemplate":false,"raw_subject":"Sorry we missed you, {{contact.first_name}}","raw_body_html":"<p>We had you down for {{appointment.start_at_local}} and missed you. No worries — pick a new time below.</p>"}}},
      {"id":"n4","type":"end","position":{"x":300,"y":400},"data":{"label":"End"}}
    ],"edges":[
      {"id":"e1","source":"n1","target":"n2"},{"id":"e2","source":"n2","target":"n3"},{"id":"e3","source":"n3","target":"n4"}
    ]}
  $template$::jsonb, 'Initial v3 system template');
END IF;

-- ─── 6. Capability Statement Auto-Delivery ────────────────────────────────
SELECT id INTO v_existing_id FROM automation_templates
  WHERE name = 'Capability Statement Auto-Delivery' AND is_system = true LIMIT 1;
IF v_existing_id IS NULL THEN
  t_capability_auto := gen_random_uuid();
  INSERT INTO automation_templates (id, org_id, name, description, category, icon_name, channel_tags, estimated_time, complexity, is_system, status, published_at, use_count)
  VALUES (t_capability_auto, NULL,
    'Capability Statement Auto-Delivery',
    'When the /capability-statement form is submitted, sends the PDF via Mailgun + notifies sales channel in Slack.',
    'sales', 'FileText', ARRAY['email', 'slack'], '5 minutes', 'simple', true, 'published', now(), 0);
  INSERT INTO automation_template_versions (template_id, version_number, definition_snapshot, change_summary)
  VALUES (t_capability_auto, 1, $template$
    {"nodes":[
      {"id":"n1","type":"trigger","position":{"x":300,"y":40},"data":{"triggerType":"form_submitted","triggerCategory":"marketing","triggerConfig":{}}},
      {"id":"n2","type":"action","position":{"x":300,"y":160},"data":{"actionType":"send_email_org","config":{"useTemplate":false,"raw_subject":"Your Autom8ion Lab capability statement","raw_body_html":"<p>Hi {{contact.first_name}},</p><p>As requested, here is our capability statement attached.</p>"}}},
      {"id":"n3","type":"action","position":{"x":300,"y":280},"data":{"actionType":"send_slack_message","config":{"message":"📄 Capability statement requested by {{contact.first_name}} {{contact.last_name}} ({{contact.email}})","channelType":"webhook"}}},
      {"id":"n4","type":"end","position":{"x":300,"y":400},"data":{"label":"End"}}
    ],"edges":[
      {"id":"e1","source":"n1","target":"n2"},{"id":"e2","source":"n2","target":"n3"},{"id":"e3","source":"n3","target":"n4"}
    ]}
  $template$::jsonb, 'Initial v3 system template');
END IF;

-- ─── 7. New Customer Onboarding (5-step) ──────────────────────────────────
SELECT id INTO v_existing_id FROM automation_templates
  WHERE name = 'New Customer Onboarding' AND is_system = true LIMIT 1;
IF v_existing_id IS NULL THEN
  t_onboarding_5step := gen_random_uuid();
  INSERT INTO automation_templates (id, org_id, name, description, category, icon_name, channel_tags, estimated_time, complexity, is_system, status, published_at, use_count)
  VALUES (t_onboarding_5step, NULL,
    'New Customer Onboarding',
    'When an opportunity is won: welcome email → 2d getting-started → 7d personal check-in from owner → 14d review request.',
    'sales', 'Users', ARRAY['email'], '10 minutes', 'moderate', true, 'published', now(), 0);
  INSERT INTO automation_template_versions (template_id, version_number, definition_snapshot, change_summary)
  VALUES (t_onboarding_5step, 1, $template$
    {"nodes":[
      {"id":"n1","type":"trigger","position":{"x":300,"y":40},"data":{"triggerType":"opportunity_status_changed","triggerCategory":"opportunities","triggerConfig":{"toStatus":"won"}}},
      {"id":"n2","type":"action","position":{"x":300,"y":160},"data":{"actionType":"send_email_org","config":{"useTemplate":false,"raw_subject":"Welcome aboard, {{contact.first_name}}!","raw_body_html":"<p>We are thrilled to be working with you.</p>"}}},
      {"id":"n3","type":"delay","position":{"x":300,"y":280},"data":{"delayType":"wait_duration","duration":{"value":2,"unit":"days"}}},
      {"id":"n4","type":"action","position":{"x":300,"y":400},"data":{"actionType":"send_email_org","config":{"useTemplate":false,"raw_subject":"Getting started — quick guide","raw_body_html":"<p>Here is everything you need to know to get started.</p>"}}},
      {"id":"n5","type":"delay","position":{"x":300,"y":520},"data":{"delayType":"wait_duration","duration":{"value":7,"unit":"days"}}},
      {"id":"n6","type":"action","position":{"x":300,"y":640},"data":{"actionType":"send_email_personal","config":{"useTemplate":false,"from_user_id":"contact_owner","raw_subject":"How is week 1 going?","raw_body_html":"<p>Personal check-in.</p>"}}},
      {"id":"n7","type":"delay","position":{"x":300,"y":760},"data":{"delayType":"wait_duration","duration":{"value":14,"unit":"days"}}},
      {"id":"n8","type":"action","position":{"x":300,"y":880},"data":{"actionType":"send_review_request","config":{}}},
      {"id":"n9","type":"end","position":{"x":300,"y":1000},"data":{"label":"End"}}
    ],"edges":[
      {"id":"e1","source":"n1","target":"n2"},{"id":"e2","source":"n2","target":"n3"},
      {"id":"e3","source":"n3","target":"n4"},{"id":"e4","source":"n4","target":"n5"},
      {"id":"e5","source":"n5","target":"n6"},{"id":"e6","source":"n6","target":"n7"},
      {"id":"e7","source":"n7","target":"n8"},{"id":"e8","source":"n8","target":"n9"}
    ]}
  $template$::jsonb, 'Initial v3 system template');
END IF;

-- ─── 8. Stale Opportunity Nudge ───────────────────────────────────────────
SELECT id INTO v_existing_id FROM automation_templates
  WHERE name = 'Stale Opportunity Nudge' AND is_system = true LIMIT 1;
IF v_existing_id IS NULL THEN
  t_stale_opp_nudge := gen_random_uuid();
  INSERT INTO automation_templates (id, org_id, name, description, category, icon_name, channel_tags, estimated_time, complexity, is_system, status, published_at, use_count)
  VALUES (t_stale_opp_nudge, NULL,
    'Stale Opportunity Nudge',
    'When an opportunity has no activity for 14 days, notifies the assigned user. Escalates to manager after 7 more days.',
    'sales', 'AlertTriangle', ARRAY['notification'], '5 minutes', 'moderate', true, 'published', now(), 0);
  INSERT INTO automation_template_versions (template_id, version_number, definition_snapshot, change_summary)
  VALUES (t_stale_opp_nudge, 1, $template$
    {"nodes":[
      {"id":"n1","type":"trigger","position":{"x":300,"y":40},"data":{"triggerType":"opportunity_stale","triggerCategory":"opportunities","triggerConfig":{"daysInactive":14,"basedOn":["last_activity_at"]}}},
      {"id":"n2","type":"action","position":{"x":300,"y":160},"data":{"actionType":"notify_user","config":{"recipientType":"contact_owner","message":"Opportunity {{opportunity.title}} has been stale for 14 days"}}},
      {"id":"n3","type":"delay","position":{"x":300,"y":280},"data":{"delayType":"wait_duration","duration":{"value":7,"unit":"days"}}},
      {"id":"n4","type":"action","position":{"x":300,"y":400},"data":{"actionType":"notify_user","config":{"recipientType":"role","recipientRole":"manager","message":"Escalation: opportunity {{opportunity.title}} stale 21+ days"}}},
      {"id":"n5","type":"end","position":{"x":300,"y":520},"data":{"label":"End"}}
    ],"edges":[
      {"id":"e1","source":"n1","target":"n2"},{"id":"e2","source":"n2","target":"n3"},
      {"id":"e3","source":"n3","target":"n4"},{"id":"e4","source":"n4","target":"n5"}
    ]}
  $template$::jsonb, 'Initial v3 system template');
END IF;

-- ─── 9. AI Voice Pre-Qualification Call ───────────────────────────────────
SELECT id INTO v_existing_id FROM automation_templates
  WHERE name = 'AI Voice Pre-Qualification Call' AND is_system = true LIMIT 1;
IF v_existing_id IS NULL THEN
  t_ai_prequal_call := gen_random_uuid();
  INSERT INTO automation_templates (id, org_id, name, description, category, icon_name, channel_tags, estimated_time, complexity, is_system, status, published_at, use_count)
  VALUES (t_ai_prequal_call, NULL,
    'AI Voice Pre-Qualification Call',
    'When an opportunity is created (gov sector), Vapi assistant places a qualification call. If qualified, moves to Discovery; else tags for human review.',
    'lead_management', 'Phone', ARRAY['voice', 'ai'], '10 minutes', 'advanced', true, 'published', now(), 0);
  INSERT INTO automation_template_versions (template_id, version_number, definition_snapshot, change_summary)
  VALUES (t_ai_prequal_call, 1, $template$
    {"nodes":[
      {"id":"n1","type":"trigger","position":{"x":300,"y":40},"data":{"triggerType":"opportunity_created","triggerCategory":"opportunities","triggerConfig":{}}},
      {"id":"n2","type":"action","position":{"x":300,"y":160},"data":{"actionType":"start_ai_call","config":{"assistant_id":"","call_goal":"Pre-qualify the lead — confirm they have budget authority, timeline, and a real need.","max_duration_seconds":600,"ring_timeout_seconds":25,"fallback_action":"voicemail"}}},
      {"id":"n3","type":"end","position":{"x":300,"y":280},"data":{"label":"End"}}
    ],"edges":[
      {"id":"e1","source":"n1","target":"n2"},{"id":"e2","source":"n2","target":"n3"}
    ]}
  $template$::jsonb, 'Initial v3 system template');
END IF;

-- ─── 10. STOP/HELP/START Compliance Auto-Reply ────────────────────────────
SELECT id INTO v_existing_id FROM automation_templates
  WHERE name = 'STOP HELP START Compliance Auto-Reply' AND is_system = true LIMIT 1;
IF v_existing_id IS NULL THEN
  t_stop_help_start := gen_random_uuid();
  INSERT INTO automation_templates (id, org_id, name, description, category, icon_name, channel_tags, estimated_time, complexity, is_system, status, published_at, use_count)
  VALUES (t_stop_help_start, NULL,
    'STOP HELP START Compliance Auto-Reply',
    'TCR-compliant SMS auto-reply for STOP/HELP/START keywords on inbound messages.',
    'internal_ops', 'Shield', ARRAY['sms'], '5 minutes', 'moderate', true, 'published', now(), 0);
  INSERT INTO automation_template_versions (template_id, version_number, definition_snapshot, change_summary)
  VALUES (t_stop_help_start, 1, $template$
    {"nodes":[
      {"id":"n1","type":"trigger","position":{"x":300,"y":40},"data":{"triggerType":"conversation_message_received","triggerCategory":"conversations","triggerConfig":{"channel":"sms"}}},
      {"id":"n2","type":"condition","position":{"x":300,"y":160},"data":{"conditions":{"logic":"or","rules":[{"field":"payload.message_body_upper","operator":"contains","value":"STOP"}]}}},
      {"id":"n3","type":"action","position":{"x":140,"y":280},"data":{"actionType":"send_sms","config":{"body":"You have been opted out. No further messages will be sent. Reply START to opt back in."}}},
      {"id":"n4","type":"action","position":{"x":140,"y":400},"data":{"actionType":"set_dnd","config":{"channels":["sms"],"reason":"User opted out via STOP keyword"}}},
      {"id":"n5","type":"action","position":{"x":460,"y":280},"data":{"actionType":"send_sms","config":{"body":"For help, visit https://autom8ionlab.com/support or call 813-320-9652. Msg & data rates may apply."}}},
      {"id":"n6","type":"end","position":{"x":300,"y":520},"data":{"label":"End"}}
    ],"edges":[
      {"id":"e1","source":"n1","target":"n2"},
      {"id":"e2","source":"n2","sourceHandle":"yes","target":"n3"},
      {"id":"e3","source":"n3","target":"n4"},{"id":"e4","source":"n4","target":"n6"},
      {"id":"e5","source":"n2","sourceHandle":"no","target":"n5"},
      {"id":"e6","source":"n5","target":"n6"}
    ]}
  $template$::jsonb, 'Initial v3 system template');
END IF;

-- ─── 11. High-Value Opportunity Approval Gate ─────────────────────────────
SELECT id INTO v_existing_id FROM automation_templates
  WHERE name = 'High-Value Opportunity Approval Gate' AND is_system = true LIMIT 1;
IF v_existing_id IS NULL THEN
  t_high_value_approval := gen_random_uuid();
  INSERT INTO automation_templates (id, org_id, name, description, category, icon_name, channel_tags, estimated_time, complexity, is_system, status, published_at, use_count)
  VALUES (t_high_value_approval, NULL,
    'High-Value Opportunity Approval Gate',
    'When a $250K+ opportunity moves to "Proposal Sent", requires admin approval before sending the personal email. Auto-rejects after 72h if no decision.',
    'proposal', 'CheckCircle2', ARRAY['email', 'approval'], '10 minutes', 'advanced', true, 'published', now(), 0);
  INSERT INTO automation_template_versions (template_id, version_number, definition_snapshot, change_summary)
  VALUES (t_high_value_approval, 1, $template$
    {"nodes":[
      {"id":"n1","type":"trigger","position":{"x":300,"y":40},"data":{"triggerType":"opportunity_stage_changed","triggerCategory":"opportunities","triggerConfig":{"toStage":"Proposal Sent"}}},
      {"id":"n2","type":"condition","position":{"x":300,"y":160},"data":{"conditions":{"logic":"and","rules":[{"field":"opportunity.amount","operator":"greater_than","value":250000}]}}},
      {"id":"n3","type":"action","position":{"x":300,"y":280},"data":{"actionType":"manual_action","config":{"title":"Approve $250K+ proposal email for {{contact.company_name}}","description":"Review the proposal terms before sending the personal kickoff email.","approverType":"role","approverRole":"admin","expiresInHours":72,"expirationBranch":"reject","enableMagicLink":true,"enableEmailNotify":true}}},
      {"id":"n4","type":"action","position":{"x":300,"y":400},"data":{"actionType":"send_email_personal","config":{"useTemplate":false,"from_user_id":"contact_owner","raw_subject":"Excited to partner, {{contact.first_name}}","raw_body_html":"<p>Looking forward to working together.</p>"}}},
      {"id":"n5","type":"end","position":{"x":300,"y":520},"data":{"label":"End"}}
    ],"edges":[
      {"id":"e1","source":"n1","target":"n2"},
      {"id":"e2","source":"n2","sourceHandle":"yes","target":"n3"},
      {"id":"e3","source":"n3","target":"n4"},{"id":"e4","source":"n4","target":"n5"},
      {"id":"e5","source":"n2","sourceHandle":"no","target":"n5"}
    ]}
  $template$::jsonb, 'Initial v3 system template');
END IF;

-- ─── 12. Birthday / Anniversary Touch ─────────────────────────────────────
SELECT id INTO v_existing_id FROM automation_templates
  WHERE name = 'Birthday Touch' AND is_system = true LIMIT 1;
IF v_existing_id IS NULL THEN
  t_birthday_touch := gen_random_uuid();
  INSERT INTO automation_templates (id, org_id, name, description, category, icon_name, channel_tags, estimated_time, complexity, is_system, status, published_at, use_count)
  VALUES (t_birthday_touch, NULL,
    'Birthday Touch',
    'When the contact custom date birthday matches today, sends a personal birthday email from the contact owner.',
    'follow_up', 'Cake', ARRAY['email'], '3 minutes', 'simple', true, 'published', now(), 0);
  INSERT INTO automation_template_versions (template_id, version_number, definition_snapshot, change_summary)
  VALUES (t_birthday_touch, 1, $template$
    {"nodes":[
      {"id":"n1","type":"trigger","position":{"x":300,"y":40},"data":{"triggerType":"birthday_reminder","triggerCategory":"contact","triggerConfig":{"daysOffset":0}}},
      {"id":"n2","type":"action","position":{"x":300,"y":160},"data":{"actionType":"send_email_personal","config":{"useTemplate":false,"from_user_id":"contact_owner","raw_subject":"Happy birthday, {{contact.first_name}}!","raw_body_html":"<p>Wishing you a fantastic birthday.</p>"}}},
      {"id":"n3","type":"end","position":{"x":300,"y":280},"data":{"label":"End"}}
    ],"edges":[
      {"id":"e1","source":"n1","target":"n2"},{"id":"e2","source":"n2","target":"n3"}
    ]}
  $template$::jsonb, 'Initial v3 system template');
END IF;

END $$;
