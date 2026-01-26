/*
  # Add Remaining Foreign Key Indexes

  This migration adds missing indexes on foreign key columns that were identified
  during security audit. Proper indexing on FK columns improves:
  - JOIN performance
  - ON DELETE CASCADE operations
  - RLS policy evaluation speed

  1. Tables with Missing FK Indexes
    - ai_action_guardrails: created_by_user_id
    - ai_drafts: enrollment_id, workflow_ai_run_id
    - ai_workflow_learning_signals: agent_id, contact_id, conversation_id
    - content_ai_generations: brand_kit_id, brand_voice_id
    - social_post_ai_metadata: brand_kit_id, brand_voice_id
    - social_post_content: account_id
    - social_post_media: account_id
    - workflow_action_retries: org_id
    - workflow_ai_runs: conversation_id, workflow_id
    - workflow_condition_waits: org_id
    - workflow_enrollments: goal_id
    - workflow_trigger_audit_log: user_id
    - workflow_triggers: created_by_user_id
*/

-- ai_action_guardrails indexes
CREATE INDEX IF NOT EXISTS idx_ai_action_guardrails_created_by 
  ON ai_action_guardrails(created_by_user_id);

-- ai_drafts indexes
CREATE INDEX IF NOT EXISTS idx_ai_drafts_enrollment 
  ON ai_drafts(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_ai_drafts_workflow_ai_run 
  ON ai_drafts(workflow_ai_run_id);

-- ai_workflow_learning_signals indexes
CREATE INDEX IF NOT EXISTS idx_ai_workflow_learning_signals_agent 
  ON ai_workflow_learning_signals(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_workflow_learning_signals_contact 
  ON ai_workflow_learning_signals(contact_id);
CREATE INDEX IF NOT EXISTS idx_ai_workflow_learning_signals_conversation 
  ON ai_workflow_learning_signals(conversation_id);

-- content_ai_generations indexes
CREATE INDEX IF NOT EXISTS idx_content_ai_generations_brand_kit 
  ON content_ai_generations(brand_kit_id);
CREATE INDEX IF NOT EXISTS idx_content_ai_generations_brand_voice 
  ON content_ai_generations(brand_voice_id);

-- social_post_ai_metadata indexes
CREATE INDEX IF NOT EXISTS idx_social_post_ai_metadata_brand_kit 
  ON social_post_ai_metadata(brand_kit_id);
CREATE INDEX IF NOT EXISTS idx_social_post_ai_metadata_brand_voice 
  ON social_post_ai_metadata(brand_voice_id);

-- social_post_content indexes
CREATE INDEX IF NOT EXISTS idx_social_post_content_account 
  ON social_post_content(account_id);

-- social_post_media indexes
CREATE INDEX IF NOT EXISTS idx_social_post_media_account 
  ON social_post_media(account_id);

-- workflow_action_retries indexes
CREATE INDEX IF NOT EXISTS idx_workflow_action_retries_org 
  ON workflow_action_retries(org_id);

-- workflow_ai_runs indexes
CREATE INDEX IF NOT EXISTS idx_workflow_ai_runs_conversation 
  ON workflow_ai_runs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_workflow_ai_runs_workflow 
  ON workflow_ai_runs(workflow_id);

-- workflow_condition_waits indexes
CREATE INDEX IF NOT EXISTS idx_workflow_condition_waits_org 
  ON workflow_condition_waits(org_id);

-- workflow_enrollments indexes
CREATE INDEX IF NOT EXISTS idx_workflow_enrollments_goal 
  ON workflow_enrollments(goal_id);

-- workflow_trigger_audit_log indexes
CREATE INDEX IF NOT EXISTS idx_workflow_trigger_audit_log_user 
  ON workflow_trigger_audit_log(user_id);

-- workflow_triggers indexes
CREATE INDEX IF NOT EXISTS idx_workflow_triggers_created_by 
  ON workflow_triggers(created_by_user_id);
