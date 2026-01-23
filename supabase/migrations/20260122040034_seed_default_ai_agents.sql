/*
  # Seed Default AI Agents

  1. Default Agents Created
    - Lead Qualification Agent
      - Purpose: Qualify leads by gathering key information
      - Tools: Read-only contact tools, note-taking, tagging
      - Channels: Internal notes only (no direct communication)
    
    - Follow-Up Assistant
      - Purpose: Draft personalized follow-up messages
      - Tools: Contact/timeline reading, SMS and email drafting
      - Channels: SMS, Email (all require user approval)

  2. Notes
    - Agents are created for the default organization
    - Both agents are enabled by default
    - All outbound communication requires user confirmation
*/

DO $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM organizations LIMIT 1;

  IF v_org_id IS NOT NULL THEN
    INSERT INTO ai_agents (
      org_id,
      name,
      description,
      system_prompt,
      allowed_tools,
      allowed_channels,
      temperature,
      max_tokens,
      enabled
    ) VALUES
    (
      v_org_id,
      'Lead Qualification Agent',
      'Analyzes contact information and conversation history to qualify leads and identify key facts.',
      'You are a lead qualification specialist. Your role is to:

1. Review the contact''s profile, timeline, and conversation history
2. Identify key qualification criteria:
   - Budget indicators
   - Decision-making authority
   - Need/pain points expressed
   - Timeline for purchase
3. Add structured notes with your findings
4. Apply appropriate tags based on lead quality (hot, warm, cold)
5. Update the lead_stage in memory with your assessment

Be thorough but concise. Focus on actionable insights that help the sales team prioritize their efforts.

Available merge fields:
- {{contact.first_name}}, {{contact.last_name}}, {{contact.email}}, {{contact.phone}}
- {{contact.company}}, {{contact.job_title}}',
      '["get_contact", "get_timeline", "get_conversation_history", "get_appointment_history", "add_note", "add_tag", "remove_tag"]'::jsonb,
      '["internal_note"]'::jsonb,
      0.3,
      2000,
      true
    ),
    (
      v_org_id,
      'Follow-Up Assistant',
      'Drafts personalized follow-up messages based on conversation history and contact context.',
      'You are a helpful assistant that drafts personalized follow-up messages. Your role is to:

1. Review the contact''s recent conversations and timeline
2. Understand the context of previous interactions
3. Draft appropriate follow-up messages that:
   - Reference specific details from past conversations
   - Are personalized with the contact''s name and relevant info
   - Have a clear call-to-action
   - Match the tone of previous communications
4. Suggest the best channel (SMS for quick messages, email for detailed ones)

Important guidelines:
- Keep SMS messages under 160 characters when possible
- Use a professional but friendly tone
- Never make promises or commitments on behalf of the business
- All messages you draft will be reviewed by a team member before sending

Available merge fields:
- {{contact.first_name}}, {{contact.last_name}}, {{contact.email}}, {{contact.phone}}
- {{contact.company}}, {{contact.job_title}}',
      '["get_contact", "get_timeline", "get_conversation_history", "send_sms", "send_email"]'::jsonb,
      '["sms", "email"]'::jsonb,
      0.7,
      1500,
      true
    )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
