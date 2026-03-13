/*
  # Seed 10 System Automation Templates (Sales Category)

  Inserts 10 pre-built system templates into automation_templates and
  their corresponding version snapshots into automation_template_versions.

  1. Templates Created
    - New Lead Welcome Sequence
    - Lead Qualification Workflow
    - Follow-Up After No Response
    - Appointment Reminder Sequence
    - Post-Meeting Follow-Up
    - Proposal Sent Nurture
    - Deal Won Onboarding
    - Deal Lost Re-engagement
    - Review Request After Service
    - Hot Lead Fast Response

  2. Notes
    - All templates are system-level (is_system = true, org_id = null)
    - All templates are published immediately
    - Each has a version 1 with the full workflow definition snapshot
    - Definitions use realistic node layouts and merge field placeholders
*/

DO $$ 
DECLARE
  t1_id uuid := gen_random_uuid();
  t2_id uuid := gen_random_uuid();
  t3_id uuid := gen_random_uuid();
  t4_id uuid := gen_random_uuid();
  t5_id uuid := gen_random_uuid();
  t6_id uuid := gen_random_uuid();
  t7_id uuid := gen_random_uuid();
  t8_id uuid := gen_random_uuid();
  t9_id uuid := gen_random_uuid();
  t10_id uuid := gen_random_uuid();
BEGIN

-- 1. New Lead Welcome Sequence
INSERT INTO automation_templates (id, org_id, name, description, category, icon_name, channel_tags, estimated_time, complexity, is_system, status, published_at, use_count)
VALUES (t1_id, NULL, 'New Lead Welcome Sequence', 'Automatically welcome new contacts with a personalized email, follow up with an SMS after 1 day, and tag them as welcomed.', 'sales', 'Zap', ARRAY['email','sms'], '5 minutes', 'simple', true, 'published', now(), 0);

INSERT INTO automation_template_versions (template_id, version_number, definition_snapshot, change_summary)
VALUES (t1_id, 1, '{
  "nodes": [
    {"id":"n1","type":"trigger","position":{"x":300,"y":40},"data":{"triggerType":"contact_created","triggerCategory":"event"}},
    {"id":"n2","type":"action","position":{"x":300,"y":160},"data":{"actionType":"send_email","config":{"subject":"Welcome, {{contact.first_name}}!","body":"Hi {{contact.first_name}},\n\nThank you for your interest. We are excited to connect with you.\n\nBest regards"}}},
    {"id":"n3","type":"delay","position":{"x":300,"y":280},"data":{"delayType":"wait_duration","duration":{"value":1,"unit":"days"}}},
    {"id":"n4","type":"action","position":{"x":300,"y":400},"data":{"actionType":"send_sms","config":{"body":"Hi {{contact.first_name}}, thanks for connecting with us! Reply if you have any questions."}}},
    {"id":"n5","type":"action","position":{"x":300,"y":520},"data":{"actionType":"add_tag","config":{"tagId":"","tagName":"welcomed"}}},
    {"id":"n6","type":"end","position":{"x":300,"y":640},"data":{"label":"End"}}
  ],
  "edges": [
    {"id":"e1","source":"n1","target":"n2"},
    {"id":"e2","source":"n2","target":"n3"},
    {"id":"e3","source":"n3","target":"n4"},
    {"id":"e4","source":"n4","target":"n5"},
    {"id":"e5","source":"n5","target":"n6"}
  ],
  "viewport":{"x":0,"y":0,"zoom":1}
}'::jsonb, 'Initial system template');

-- 2. Lead Qualification Workflow
INSERT INTO automation_templates (id, org_id, name, description, category, icon_name, channel_tags, estimated_time, complexity, is_system, status, published_at, use_count)
VALUES (t2_id, NULL, 'Lead Qualification Workflow', 'Use AI to qualify new leads automatically. Tags hot leads and assigns them to sales reps, while routing cold leads to a nurture path.', 'sales', 'Target', ARRAY['ai'], '10 minutes', 'moderate', true, 'published', now(), 0);

INSERT INTO automation_template_versions (template_id, version_number, definition_snapshot, change_summary)
VALUES (t2_id, 1, '{
  "nodes": [
    {"id":"n1","type":"trigger","position":{"x":300,"y":40},"data":{"triggerType":"contact_created","triggerCategory":"event"}},
    {"id":"n2","type":"action","position":{"x":300,"y":160},"data":{"actionType":"ai_lead_qualification","config":{"instructions":"Evaluate this lead based on company size, job title, and engagement level."}}},
    {"id":"n3","type":"condition","position":{"x":300,"y":300},"data":{"conditions":{"logic":"and","rules":[{"id":"r1","field":"tags","operator":"has_tag","value":"qualified"}]}}},
    {"id":"n4","type":"action","position":{"x":120,"y":440},"data":{"actionType":"add_tag","config":{"tagId":"","tagName":"hot-lead"}}},
    {"id":"n5","type":"action","position":{"x":120,"y":560},"data":{"actionType":"assign_owner","config":{"userId":"","userName":"Sales Rep"}}},
    {"id":"n6","type":"action","position":{"x":480,"y":440},"data":{"actionType":"add_tag","config":{"tagId":"","tagName":"nurture"}}},
    {"id":"n7","type":"end","position":{"x":120,"y":680},"data":{"label":"End"}},
    {"id":"n8","type":"end","position":{"x":480,"y":560},"data":{"label":"End"}}
  ],
  "edges": [
    {"id":"e1","source":"n1","target":"n2"},
    {"id":"e2","source":"n2","target":"n3"},
    {"id":"e3","source":"n3","target":"n4","sourceHandle":"true"},
    {"id":"e4","source":"n3","target":"n6","sourceHandle":"false"},
    {"id":"e5","source":"n4","target":"n5"},
    {"id":"e6","source":"n5","target":"n7"},
    {"id":"e7","source":"n6","target":"n8"}
  ],
  "viewport":{"x":0,"y":0,"zoom":1}
}'::jsonb, 'Initial system template');

-- 3. Follow-Up After No Response
INSERT INTO automation_templates (id, org_id, name, description, category, icon_name, channel_tags, estimated_time, complexity, is_system, status, published_at, use_count)
VALUES (t3_id, NULL, 'Follow-Up After No Response', 'Sends follow-up email and SMS after waiting periods when a lead does not respond. Tags unresponsive contacts after final attempt.', 'sales', 'Send', ARRAY['email','sms'], '5 minutes', 'moderate', true, 'published', now(), 0);

INSERT INTO automation_template_versions (template_id, version_number, definition_snapshot, change_summary)
VALUES (t3_id, 1, '{
  "nodes": [
    {"id":"n1","type":"trigger","position":{"x":300,"y":40},"data":{"triggerType":"contact_created","triggerCategory":"event"}},
    {"id":"n2","type":"delay","position":{"x":300,"y":160},"data":{"delayType":"wait_duration","duration":{"value":2,"unit":"days"}}},
    {"id":"n3","type":"action","position":{"x":300,"y":280},"data":{"actionType":"send_email","config":{"subject":"Just checking in, {{contact.first_name}}","body":"Hi {{contact.first_name}},\n\nI wanted to follow up on my earlier message. Do you have a few minutes to chat?\n\nBest regards"}}},
    {"id":"n4","type":"delay","position":{"x":300,"y":400},"data":{"delayType":"wait_duration","duration":{"value":3,"unit":"days"}}},
    {"id":"n5","type":"action","position":{"x":300,"y":520},"data":{"actionType":"send_sms","config":{"body":"Hi {{contact.first_name}}, just following up - would love to connect when you have a moment."}}},
    {"id":"n6","type":"action","position":{"x":300,"y":640},"data":{"actionType":"add_tag","config":{"tagId":"","tagName":"unresponsive"}}},
    {"id":"n7","type":"end","position":{"x":300,"y":760},"data":{"label":"End"}}
  ],
  "edges": [
    {"id":"e1","source":"n1","target":"n2"},
    {"id":"e2","source":"n2","target":"n3"},
    {"id":"e3","source":"n3","target":"n4"},
    {"id":"e4","source":"n4","target":"n5"},
    {"id":"e5","source":"n5","target":"n6"},
    {"id":"e6","source":"n6","target":"n7"}
  ],
  "viewport":{"x":0,"y":0,"zoom":1}
}'::jsonb, 'Initial system template');

-- 4. Appointment Reminder Sequence
INSERT INTO automation_templates (id, org_id, name, description, category, icon_name, channel_tags, estimated_time, complexity, is_system, status, published_at, use_count)
VALUES (t4_id, NULL, 'Appointment Reminder Sequence', 'Sends confirmation email when appointment is booked, then reminder SMS one day before and a final reminder one hour before.', 'sales', 'Calendar', ARRAY['email','sms'], '5 minutes', 'simple', true, 'published', now(), 0);

INSERT INTO automation_template_versions (template_id, version_number, definition_snapshot, change_summary)
VALUES (t4_id, 1, '{
  "nodes": [
    {"id":"n1","type":"trigger","position":{"x":300,"y":40},"data":{"triggerType":"appointment_booked","triggerCategory":"event"}},
    {"id":"n2","type":"action","position":{"x":300,"y":160},"data":{"actionType":"send_email","config":{"subject":"Appointment Confirmed","body":"Hi {{contact.first_name}},\n\nYour appointment has been confirmed. We look forward to meeting you!\n\nBest regards"}}},
    {"id":"n3","type":"delay","position":{"x":300,"y":280},"data":{"delayType":"wait_duration","duration":{"value":1,"unit":"days"}}},
    {"id":"n4","type":"action","position":{"x":300,"y":400},"data":{"actionType":"send_sms","config":{"body":"Reminder: You have an appointment tomorrow, {{contact.first_name}}. See you there!"}}},
    {"id":"n5","type":"delay","position":{"x":300,"y":520},"data":{"delayType":"wait_duration","duration":{"value":23,"unit":"hours"}}},
    {"id":"n6","type":"action","position":{"x":300,"y":640},"data":{"actionType":"send_sms","config":{"body":"{{contact.first_name}}, your appointment starts in about 1 hour. See you soon!"}}},
    {"id":"n7","type":"end","position":{"x":300,"y":760},"data":{"label":"End"}}
  ],
  "edges": [
    {"id":"e1","source":"n1","target":"n2"},
    {"id":"e2","source":"n2","target":"n3"},
    {"id":"e3","source":"n3","target":"n4"},
    {"id":"e4","source":"n4","target":"n5"},
    {"id":"e5","source":"n5","target":"n6"},
    {"id":"e6","source":"n6","target":"n7"}
  ],
  "viewport":{"x":0,"y":0,"zoom":1}
}'::jsonb, 'Initial system template');

-- 5. Post-Meeting Follow-Up
INSERT INTO automation_templates (id, org_id, name, description, category, icon_name, channel_tags, estimated_time, complexity, is_system, status, published_at, use_count)
VALUES (t5_id, NULL, 'Post-Meeting Follow-Up', 'After a meeting is processed, generates AI follow-up, sends summary email, creates a follow-up task, then checks in via SMS after 3 days.', 'sales', 'FileText', ARRAY['email','sms','ai'], '10 minutes', 'advanced', true, 'published', now(), 0);

INSERT INTO automation_template_versions (template_id, version_number, definition_snapshot, change_summary)
VALUES (t5_id, 1, '{
  "nodes": [
    {"id":"n1","type":"trigger","position":{"x":300,"y":40},"data":{"triggerType":"meeting_processed","triggerCategory":"event"}},
    {"id":"n2","type":"action","position":{"x":300,"y":160},"data":{"actionType":"generate_meeting_follow_up","config":{}}},
    {"id":"n3","type":"action","position":{"x":300,"y":280},"data":{"actionType":"send_email","config":{"subject":"Meeting Summary & Next Steps","body":"Hi {{contact.first_name}},\n\nThank you for taking the time to meet with us. Here is a summary of what we discussed and the next steps.\n\nBest regards"}}},
    {"id":"n4","type":"action","position":{"x":300,"y":400},"data":{"actionType":"create_note","config":{"content":"Follow-up task created from post-meeting workflow."}}},
    {"id":"n5","type":"delay","position":{"x":300,"y":520},"data":{"delayType":"wait_duration","duration":{"value":3,"unit":"days"}}},
    {"id":"n6","type":"action","position":{"x":300,"y":640},"data":{"actionType":"send_sms","config":{"body":"Hi {{contact.first_name}}, just checking in after our meeting. Let me know if you have any questions!"}}},
    {"id":"n7","type":"end","position":{"x":300,"y":760},"data":{"label":"End"}}
  ],
  "edges": [
    {"id":"e1","source":"n1","target":"n2"},
    {"id":"e2","source":"n2","target":"n3"},
    {"id":"e3","source":"n3","target":"n4"},
    {"id":"e4","source":"n4","target":"n5"},
    {"id":"e5","source":"n5","target":"n6"},
    {"id":"e6","source":"n6","target":"n7"}
  ],
  "viewport":{"x":0,"y":0,"zoom":1}
}'::jsonb, 'Initial system template');

-- 6. Proposal Sent Nurture
INSERT INTO automation_templates (id, org_id, name, description, category, icon_name, channel_tags, estimated_time, complexity, is_system, status, published_at, use_count)
VALUES (t6_id, NULL, 'Proposal Sent Nurture', 'After an invoice is sent, sends a confirmation email, waits 3 days, then sends a follow-up and adds a pending tag to track engagement.', 'sales', 'FileText', ARRAY['email'], '5 minutes', 'simple', true, 'published', now(), 0);

INSERT INTO automation_template_versions (template_id, version_number, definition_snapshot, change_summary)
VALUES (t6_id, 1, '{
  "nodes": [
    {"id":"n1","type":"trigger","position":{"x":300,"y":40},"data":{"triggerType":"invoice_sent","triggerCategory":"event"}},
    {"id":"n2","type":"action","position":{"x":300,"y":160},"data":{"actionType":"send_email","config":{"subject":"Your Proposal Has Been Sent","body":"Hi {{contact.first_name}},\n\nYour proposal has been sent. Please review it at your convenience and let us know if you have any questions.\n\nBest regards"}}},
    {"id":"n3","type":"delay","position":{"x":300,"y":280},"data":{"delayType":"wait_duration","duration":{"value":3,"unit":"days"}}},
    {"id":"n4","type":"action","position":{"x":300,"y":400},"data":{"actionType":"send_email","config":{"subject":"Following Up on Your Proposal","body":"Hi {{contact.first_name}},\n\nJust following up on the proposal we sent. Happy to answer any questions or make adjustments.\n\nBest regards"}}},
    {"id":"n5","type":"action","position":{"x":300,"y":520},"data":{"actionType":"add_tag","config":{"tagId":"","tagName":"proposal-pending"}}},
    {"id":"n6","type":"end","position":{"x":300,"y":640},"data":{"label":"End"}}
  ],
  "edges": [
    {"id":"e1","source":"n1","target":"n2"},
    {"id":"e2","source":"n2","target":"n3"},
    {"id":"e3","source":"n3","target":"n4"},
    {"id":"e4","source":"n4","target":"n5"},
    {"id":"e5","source":"n5","target":"n6"}
  ],
  "viewport":{"x":0,"y":0,"zoom":1}
}'::jsonb, 'Initial system template');

-- 7. Deal Won Onboarding
INSERT INTO automation_templates (id, org_id, name, description, category, icon_name, channel_tags, estimated_time, complexity, is_system, status, published_at, use_count)
VALUES (t7_id, NULL, 'Deal Won Onboarding', 'When payment is received, tags the contact as a customer, removes prospect tag, sends onboarding email, creates an onboarding task, and notifies the team.', 'sales', 'TrendingUp', ARRAY['email','notification'], '5 minutes', 'moderate', true, 'published', now(), 0);

INSERT INTO automation_template_versions (template_id, version_number, definition_snapshot, change_summary)
VALUES (t7_id, 1, '{
  "nodes": [
    {"id":"n1","type":"trigger","position":{"x":300,"y":40},"data":{"triggerType":"payment_received","triggerCategory":"event"}},
    {"id":"n2","type":"action","position":{"x":300,"y":160},"data":{"actionType":"add_tag","config":{"tagId":"","tagName":"customer"}}},
    {"id":"n3","type":"action","position":{"x":300,"y":280},"data":{"actionType":"remove_tag","config":{"tagId":"","tagName":"prospect"}}},
    {"id":"n4","type":"action","position":{"x":300,"y":400},"data":{"actionType":"send_email","config":{"subject":"Welcome Aboard, {{contact.first_name}}!","body":"Hi {{contact.first_name}},\n\nWelcome! We are thrilled to have you as a customer. Here is everything you need to get started.\n\nBest regards"}}},
    {"id":"n5","type":"action","position":{"x":300,"y":520},"data":{"actionType":"create_note","config":{"content":"New customer onboarding started - payment received."}}},
    {"id":"n6","type":"action","position":{"x":300,"y":640},"data":{"actionType":"internal_notification","config":{"userIds":[],"message":"New customer onboarded: {{contact.first_name}} {{contact.last_name}}"}}},
    {"id":"n7","type":"end","position":{"x":300,"y":760},"data":{"label":"End"}}
  ],
  "edges": [
    {"id":"e1","source":"n1","target":"n2"},
    {"id":"e2","source":"n2","target":"n3"},
    {"id":"e3","source":"n3","target":"n4"},
    {"id":"e4","source":"n4","target":"n5"},
    {"id":"e5","source":"n5","target":"n6"},
    {"id":"e6","source":"n6","target":"n7"}
  ],
  "viewport":{"x":0,"y":0,"zoom":1}
}'::jsonb, 'Initial system template');

-- 8. Deal Lost Re-engagement
INSERT INTO automation_templates (id, org_id, name, description, category, icon_name, channel_tags, estimated_time, complexity, is_system, status, published_at, use_count)
VALUES (t8_id, NULL, 'Deal Lost Re-engagement', 'After an invoice becomes overdue, waits 30 days, then sends a re-engagement email to try to win back the deal. Tags the contact for tracking.', 'sales', 'TrendingUp', ARRAY['email'], '5 minutes', 'moderate', true, 'published', now(), 0);

INSERT INTO automation_template_versions (template_id, version_number, definition_snapshot, change_summary)
VALUES (t8_id, 1, '{
  "nodes": [
    {"id":"n1","type":"trigger","position":{"x":300,"y":40},"data":{"triggerType":"invoice_overdue","triggerCategory":"event"}},
    {"id":"n2","type":"delay","position":{"x":300,"y":160},"data":{"delayType":"wait_duration","duration":{"value":30,"unit":"days"}}},
    {"id":"n3","type":"action","position":{"x":300,"y":280},"data":{"actionType":"send_email","config":{"subject":"We Would Love to Reconnect, {{contact.first_name}}","body":"Hi {{contact.first_name}},\n\nIt has been a while since we last connected. We have some new offerings that might interest you.\n\nWould you like to schedule a quick call?\n\nBest regards"}}},
    {"id":"n4","type":"action","position":{"x":300,"y":400},"data":{"actionType":"add_tag","config":{"tagId":"","tagName":"re-engagement-sent"}}},
    {"id":"n5","type":"end","position":{"x":300,"y":520},"data":{"label":"End"}}
  ],
  "edges": [
    {"id":"e1","source":"n1","target":"n2"},
    {"id":"e2","source":"n2","target":"n3"},
    {"id":"e3","source":"n3","target":"n4"},
    {"id":"e4","source":"n4","target":"n5"}
  ],
  "viewport":{"x":0,"y":0,"zoom":1}
}'::jsonb, 'Initial system template');

-- 9. Review Request After Service
INSERT INTO automation_templates (id, org_id, name, description, category, icon_name, channel_tags, estimated_time, complexity, is_system, status, published_at, use_count)
VALUES (t9_id, NULL, 'Review Request After Service', 'After an appointment, waits 1 day, sends a review request email, waits 3 more days, sends an SMS reminder, and tags the contact.', 'sales', 'Star', ARRAY['email','sms'], '5 minutes', 'simple', true, 'published', now(), 0);

INSERT INTO automation_template_versions (template_id, version_number, definition_snapshot, change_summary)
VALUES (t9_id, 1, '{
  "nodes": [
    {"id":"n1","type":"trigger","position":{"x":300,"y":40},"data":{"triggerType":"appointment_booked","triggerCategory":"event"}},
    {"id":"n2","type":"delay","position":{"x":300,"y":160},"data":{"delayType":"wait_duration","duration":{"value":1,"unit":"days"}}},
    {"id":"n3","type":"action","position":{"x":300,"y":280},"data":{"actionType":"send_email","config":{"subject":"How Did We Do, {{contact.first_name}}?","body":"Hi {{contact.first_name}},\n\nWe hope your recent visit went well! Would you mind leaving us a quick review? Your feedback helps us serve you better.\n\nThank you!"}}},
    {"id":"n4","type":"delay","position":{"x":300,"y":400},"data":{"delayType":"wait_duration","duration":{"value":3,"unit":"days"}}},
    {"id":"n5","type":"action","position":{"x":300,"y":520},"data":{"actionType":"send_sms","config":{"body":"Hi {{contact.first_name}}, we would love to hear how your experience was. A quick review would mean a lot to us!"}}},
    {"id":"n6","type":"action","position":{"x":300,"y":640},"data":{"actionType":"add_tag","config":{"tagId":"","tagName":"review-requested"}}},
    {"id":"n7","type":"end","position":{"x":300,"y":760},"data":{"label":"End"}}
  ],
  "edges": [
    {"id":"e1","source":"n1","target":"n2"},
    {"id":"e2","source":"n2","target":"n3"},
    {"id":"e3","source":"n3","target":"n4"},
    {"id":"e4","source":"n4","target":"n5"},
    {"id":"e5","source":"n5","target":"n6"},
    {"id":"e6","source":"n6","target":"n7"}
  ],
  "viewport":{"x":0,"y":0,"zoom":1}
}'::jsonb, 'Initial system template');

-- 10. Hot Lead Fast Response
INSERT INTO automation_templates (id, org_id, name, description, category, icon_name, channel_tags, estimated_time, complexity, is_system, status, published_at, use_count)
VALUES (t10_id, NULL, 'Hot Lead Fast Response', 'When a form is submitted, instantly notifies the sales team, assigns an owner, uses AI to send a quick conversation reply, and creates a follow-up task.', 'sales', 'Zap', ARRAY['notification','ai'], '10 minutes', 'advanced', true, 'published', now(), 0);

INSERT INTO automation_template_versions (template_id, version_number, definition_snapshot, change_summary)
VALUES (t10_id, 1, '{
  "nodes": [
    {"id":"n1","type":"trigger","position":{"x":300,"y":40},"data":{"triggerType":"form_submitted","triggerCategory":"event"}},
    {"id":"n2","type":"action","position":{"x":300,"y":160},"data":{"actionType":"internal_notification","config":{"userIds":[],"message":"New hot lead from form: {{contact.first_name}} {{contact.last_name}} ({{contact.email}})"}}},
    {"id":"n3","type":"action","position":{"x":300,"y":280},"data":{"actionType":"assign_owner","config":{"userId":"","userName":"Sales Rep"}}},
    {"id":"n4","type":"action","position":{"x":300,"y":400},"data":{"actionType":"ai_conversation_reply","config":{"instructions":"Send a friendly, professional acknowledgment. Thank them for their interest and let them know a team member will follow up shortly."}}},
    {"id":"n5","type":"action","position":{"x":300,"y":520},"data":{"actionType":"create_note","config":{"content":"Hot lead - fast response sequence initiated. AI reply sent. Follow up within 1 hour."}}},
    {"id":"n6","type":"action","position":{"x":300,"y":640},"data":{"actionType":"add_tag","config":{"tagId":"","tagName":"hot-lead"}}},
    {"id":"n7","type":"end","position":{"x":300,"y":760},"data":{"label":"End"}}
  ],
  "edges": [
    {"id":"e1","source":"n1","target":"n2"},
    {"id":"e2","source":"n2","target":"n3"},
    {"id":"e3","source":"n3","target":"n4"},
    {"id":"e4","source":"n4","target":"n5"},
    {"id":"e5","source":"n5","target":"n6"},
    {"id":"e6","source":"n6","target":"n7"}
  ],
  "viewport":{"x":0,"y":0,"zoom":1}
}'::jsonb, 'Initial system template');

END $$;
