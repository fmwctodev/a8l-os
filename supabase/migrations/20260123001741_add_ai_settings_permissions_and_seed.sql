/*
  # AI Settings Permissions and Seed Data

  This migration adds new permissions for AI settings management and seeds
  initial data for the AI settings module.

  1. New Permissions
    - ai.settings.view - View AI settings pages
    - ai.settings.manage - Manage general AI settings
    - ai.models.manage - Manage LLM providers and models
    - ai.voices.manage - Manage ElevenLabs voices
    - ai.knowledge.manage - Manage knowledge collections
    - ai.prompts.manage - Manage prompt templates

  2. Role Assignments
    - SuperAdmin: All permissions
    - Admin: All permissions
    - Manager: view, knowledge, prompts management
    - Sales/Ops: view only
    - ReadOnly: view only

  3. Seed Data
    - Sample prompt templates for common use cases
    - Default AI agent settings for default org
*/

-- Insert new permissions
INSERT INTO permissions (key, description, module_name)
VALUES 
  ('ai.settings.view', 'View AI agent settings pages', 'ai_agents'),
  ('ai.settings.manage', 'Manage general AI agent settings', 'ai_agents'),
  ('ai.models.manage', 'Manage LLM providers and models', 'ai_agents'),
  ('ai.voices.manage', 'Manage ElevenLabs voice settings', 'ai_agents'),
  ('ai.knowledge.manage', 'Manage AI knowledge collections', 'ai_agents'),
  ('ai.prompts.manage', 'Manage AI prompt templates', 'ai_agents')
ON CONFLICT (key) DO NOTHING;

-- Grant permissions to roles
-- SuperAdmin gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'SuperAdmin'
  AND p.key IN (
    'ai.settings.view',
    'ai.settings.manage',
    'ai.models.manage',
    'ai.voices.manage',
    'ai.knowledge.manage',
    'ai.prompts.manage'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Admin gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Admin'
  AND p.key IN (
    'ai.settings.view',
    'ai.settings.manage',
    'ai.models.manage',
    'ai.voices.manage',
    'ai.knowledge.manage',
    'ai.prompts.manage'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Manager gets view and content management permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Manager'
  AND p.key IN (
    'ai.settings.view',
    'ai.settings.manage',
    'ai.knowledge.manage',
    'ai.prompts.manage'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Sales gets view only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Sales'
  AND p.key IN ('ai.settings.view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Ops gets view only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Ops'
  AND p.key IN ('ai.settings.view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ReadOnly gets view only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'ReadOnly'
  AND p.key IN ('ai.settings.view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Seed default AI agent settings for the default organization
INSERT INTO ai_agent_settings_defaults (org_id, default_allowed_tools, require_human_approval_default, max_outbound_per_run_default)
SELECT id, 
  '["get_contact", "get_timeline", "get_conversation_history", "get_appointment_history", "add_note"]'::jsonb,
  true,
  5
FROM organizations
WHERE NOT EXISTS (
  SELECT 1 FROM ai_agent_settings_defaults WHERE org_id = organizations.id
)
LIMIT 1;

-- Seed sample prompt templates for default organization
DO $$
DECLARE
  v_org_id uuid;
  v_template_id uuid;
BEGIN
  -- Get the default organization
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  
  IF v_org_id IS NOT NULL THEN
    -- Lead Qualification Framework template
    INSERT INTO prompt_templates (org_id, name, category, status)
    VALUES (v_org_id, 'Lead Qualification Framework', 'lead_qualification', 'active')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_template_id;
    
    IF v_template_id IS NOT NULL THEN
      INSERT INTO prompt_template_versions (template_id, version_number, body)
      VALUES (v_template_id, 1, 'When qualifying leads, evaluate the following criteria:

1. **Budget**: Does {{contact_name}} have budget authority or access to funds?
2. **Authority**: Is this the decision maker or do they need to involve others?
3. **Need**: What specific problem are they trying to solve?
4. **Timeline**: When do they need a solution implemented?

Based on the conversation history, determine the lead quality score:
- Hot Lead: Ready to buy, has budget, is decision maker
- Warm Lead: Interested but missing 1-2 qualification criteria
- Cold Lead: Early stage, needs nurturing

Provide a brief summary and recommended next action.');
    END IF;
    
    -- Appointment Booking template
    INSERT INTO prompt_templates (org_id, name, category, status)
    VALUES (v_org_id, 'Appointment Scheduling', 'appointment_booking', 'active')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_template_id;
    
    IF v_template_id IS NOT NULL THEN
      INSERT INTO prompt_template_versions (template_id, version_number, body)
      VALUES (v_template_id, 1, 'Help schedule an appointment with {{contact_name}}.

Guidelines:
- Be professional and courteous
- Offer 2-3 specific time slots when suggesting availability
- Confirm the appointment details before finalizing
- Send a confirmation message after booking

If the contact needs to reschedule, be accommodating and offer alternatives.
Always confirm the timezone and meeting format (phone, video, in-person).');
    END IF;
    
    -- Follow-Up Sequence template
    INSERT INTO prompt_templates (org_id, name, category, status)
    VALUES (v_org_id, 'Follow-Up Sequence', 'follow_up', 'active')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_template_id;
    
    IF v_template_id IS NOT NULL THEN
      INSERT INTO prompt_template_versions (template_id, version_number, body)
      VALUES (v_template_id, 1, 'Follow up with {{contact_name}} based on previous interactions.

Review the conversation history to understand:
- What was discussed previously
- Any commitments or next steps mentioned
- The contact''s level of engagement

Craft a personalized follow-up that:
- References the previous conversation
- Provides value (information, resource, or insight)
- Has a clear call-to-action
- Maintains a professional but friendly tone

If no response after 3 follow-ups, suggest the contact may need more time and recommend a check-in in 30 days.');
    END IF;

    -- Objection Handling template
    INSERT INTO prompt_templates (org_id, name, category, status)
    VALUES (v_org_id, 'Objection Handling', 'objection_handling', 'active')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_template_id;
    
    IF v_template_id IS NOT NULL THEN
      INSERT INTO prompt_template_versions (template_id, version_number, body)
      VALUES (v_template_id, 1, 'Address objections from {{contact_name}} thoughtfully.

Common objections and responses:
- **Price**: Focus on value and ROI, not just cost
- **Timing**: Understand their timeline and create urgency appropriately
- **Competition**: Highlight unique differentiators without disparaging competitors
- **Need for approval**: Offer to help prepare materials for decision makers

Always:
1. Acknowledge the objection without being defensive
2. Ask clarifying questions to understand the root concern
3. Provide relevant information or examples
4. Suggest a logical next step');
    END IF;

    -- Company Overview knowledge collection
    INSERT INTO knowledge_collections (org_id, name, description, status, apply_to_all_agents)
    VALUES (
      v_org_id, 
      'Company Overview', 
      'General information about our company, products, and services that all AI agents should know.',
      'active',
      true
    )
    ON CONFLICT DO NOTHING;
    
  END IF;
END $$;