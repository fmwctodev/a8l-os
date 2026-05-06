/*
  # Extend workflow_trigger_type enum with Vapi AI events

  P6 — adds 4 new trigger types so workflows can fire on Vapi-emitted events:
    - ai_call_completed         — Vapi reports a call ended
    - ai_voicemail_received     — Vapi handled an inbound call to voicemail
    - ai_agent_handoff_requested — Vapi assistant escalates to human
    - ai_call_started           — Outbound Vapi call connected

  Pure additive enum extension. Existing triggers unaffected.
*/

ALTER TYPE workflow_trigger_type ADD VALUE IF NOT EXISTS 'ai_call_completed';
ALTER TYPE workflow_trigger_type ADD VALUE IF NOT EXISTS 'ai_voicemail_received';
ALTER TYPE workflow_trigger_type ADD VALUE IF NOT EXISTS 'ai_agent_handoff_requested';
ALTER TYPE workflow_trigger_type ADD VALUE IF NOT EXISTS 'ai_call_started';
