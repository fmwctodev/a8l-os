/*
  # RLS Policies for AI Settings Extended Tables

  This migration creates Row Level Security policies for the new AI settings
  tables: usage limits, response style defaults, voice defaults, safety prompts,
  custom LLM providers, and usage logs.

  1. Policies Created
    - ai_usage_limits: View/manage for org members with ai.settings permissions
    - ai_response_style_defaults: View/manage for org members with ai.settings permissions
    - ai_voice_defaults: View/manage for org members with ai.settings permissions
    - ai_safety_prompts: View/manage for org members with ai.settings permissions
    - custom_llm_providers: View/manage for org members with ai.models permissions
    - ai_usage_logs: View for org members with ai.settings.view permission

  2. Security Notes
    - All tables require authenticated access
    - Management operations require appropriate admin permissions
    - Usage logs are read-only for most users
*/

-- Helper function to check AI settings view permission
CREATE OR REPLACE FUNCTION has_ai_settings_view_permission(p_user_id uuid, p_org_id uuid)
RETURNS boolean AS $$
DECLARE
  v_user_role_id uuid;
  v_has_permission boolean;
BEGIN
  SELECT role_id INTO v_user_role_id FROM users WHERE id = p_user_id AND organization_id = p_org_id;
  IF v_user_role_id IS NULL THEN
    RETURN false;
  END IF;
  
  SELECT EXISTS (
    SELECT 1 FROM role_permissions rp
    JOIN permissions p ON p.id = rp.permission_id
    WHERE rp.role_id = v_user_role_id
    AND p.key IN ('ai.settings.view', 'ai.settings.manage')
  ) INTO v_has_permission;
  
  RETURN v_has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check AI settings manage permission
CREATE OR REPLACE FUNCTION has_ai_settings_manage_permission(p_user_id uuid, p_org_id uuid)
RETURNS boolean AS $$
DECLARE
  v_user_role_id uuid;
  v_has_permission boolean;
BEGIN
  SELECT role_id INTO v_user_role_id FROM users WHERE id = p_user_id AND organization_id = p_org_id;
  IF v_user_role_id IS NULL THEN
    RETURN false;
  END IF;
  
  SELECT EXISTS (
    SELECT 1 FROM role_permissions rp
    JOIN permissions p ON p.id = rp.permission_id
    WHERE rp.role_id = v_user_role_id
    AND p.key = 'ai.settings.manage'
  ) INTO v_has_permission;
  
  RETURN v_has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ai_usage_limits policies
DROP POLICY IF EXISTS "Users can view org usage limits" ON ai_usage_limits;
CREATE POLICY "Users can view org usage limits"
  ON ai_usage_limits FOR SELECT
  TO authenticated
  USING (
    has_ai_settings_view_permission(auth.uid(), org_id)
  );

DROP POLICY IF EXISTS "Admins can insert org usage limits" ON ai_usage_limits;
CREATE POLICY "Admins can insert org usage limits"
  ON ai_usage_limits FOR INSERT
  TO authenticated
  WITH CHECK (
    has_ai_settings_manage_permission(auth.uid(), org_id)
  );

DROP POLICY IF EXISTS "Admins can update org usage limits" ON ai_usage_limits;
CREATE POLICY "Admins can update org usage limits"
  ON ai_usage_limits FOR UPDATE
  TO authenticated
  USING (has_ai_settings_manage_permission(auth.uid(), org_id))
  WITH CHECK (has_ai_settings_manage_permission(auth.uid(), org_id));

-- ai_response_style_defaults policies
DROP POLICY IF EXISTS "Users can view org response style defaults" ON ai_response_style_defaults;
CREATE POLICY "Users can view org response style defaults"
  ON ai_response_style_defaults FOR SELECT
  TO authenticated
  USING (
    has_ai_settings_view_permission(auth.uid(), org_id)
  );

DROP POLICY IF EXISTS "Admins can insert org response style defaults" ON ai_response_style_defaults;
CREATE POLICY "Admins can insert org response style defaults"
  ON ai_response_style_defaults FOR INSERT
  TO authenticated
  WITH CHECK (
    has_ai_settings_manage_permission(auth.uid(), org_id)
  );

DROP POLICY IF EXISTS "Admins can update org response style defaults" ON ai_response_style_defaults;
CREATE POLICY "Admins can update org response style defaults"
  ON ai_response_style_defaults FOR UPDATE
  TO authenticated
  USING (has_ai_settings_manage_permission(auth.uid(), org_id))
  WITH CHECK (has_ai_settings_manage_permission(auth.uid(), org_id));

-- ai_voice_defaults policies
DROP POLICY IF EXISTS "Users can view org voice defaults" ON ai_voice_defaults;
CREATE POLICY "Users can view org voice defaults"
  ON ai_voice_defaults FOR SELECT
  TO authenticated
  USING (
    has_ai_settings_view_permission(auth.uid(), org_id)
  );

DROP POLICY IF EXISTS "Admins can insert org voice defaults" ON ai_voice_defaults;
CREATE POLICY "Admins can insert org voice defaults"
  ON ai_voice_defaults FOR INSERT
  TO authenticated
  WITH CHECK (
    has_ai_settings_manage_permission(auth.uid(), org_id)
  );

DROP POLICY IF EXISTS "Admins can update org voice defaults" ON ai_voice_defaults;
CREATE POLICY "Admins can update org voice defaults"
  ON ai_voice_defaults FOR UPDATE
  TO authenticated
  USING (has_ai_settings_manage_permission(auth.uid(), org_id))
  WITH CHECK (has_ai_settings_manage_permission(auth.uid(), org_id));

-- ai_safety_prompts policies
DROP POLICY IF EXISTS "Users can view org safety prompts" ON ai_safety_prompts;
CREATE POLICY "Users can view org safety prompts"
  ON ai_safety_prompts FOR SELECT
  TO authenticated
  USING (
    has_ai_settings_view_permission(auth.uid(), org_id)
  );

DROP POLICY IF EXISTS "Admins can insert org safety prompts" ON ai_safety_prompts;
CREATE POLICY "Admins can insert org safety prompts"
  ON ai_safety_prompts FOR INSERT
  TO authenticated
  WITH CHECK (
    has_ai_settings_manage_permission(auth.uid(), org_id)
  );

DROP POLICY IF EXISTS "Admins can update org safety prompts" ON ai_safety_prompts;
CREATE POLICY "Admins can update org safety prompts"
  ON ai_safety_prompts FOR UPDATE
  TO authenticated
  USING (has_ai_settings_manage_permission(auth.uid(), org_id))
  WITH CHECK (has_ai_settings_manage_permission(auth.uid(), org_id));

-- custom_llm_providers policies
DROP POLICY IF EXISTS "Users can view org custom llm providers" ON custom_llm_providers;
CREATE POLICY "Users can view org custom llm providers"
  ON custom_llm_providers FOR SELECT
  TO authenticated
  USING (
    has_ai_settings_view_permission(auth.uid(), org_id)
  );

DROP POLICY IF EXISTS "Admins can insert custom llm providers" ON custom_llm_providers;
CREATE POLICY "Admins can insert custom llm providers"
  ON custom_llm_providers FOR INSERT
  TO authenticated
  WITH CHECK (
    has_ai_settings_manage_permission(auth.uid(), org_id)
  );

DROP POLICY IF EXISTS "Admins can update custom llm providers" ON custom_llm_providers;
CREATE POLICY "Admins can update custom llm providers"
  ON custom_llm_providers FOR UPDATE
  TO authenticated
  USING (has_ai_settings_manage_permission(auth.uid(), org_id))
  WITH CHECK (has_ai_settings_manage_permission(auth.uid(), org_id));

DROP POLICY IF EXISTS "Admins can delete custom llm providers" ON custom_llm_providers;
CREATE POLICY "Admins can delete custom llm providers"
  ON custom_llm_providers FOR DELETE
  TO authenticated
  USING (
    has_ai_settings_manage_permission(auth.uid(), org_id)
  );

-- ai_usage_logs policies (read-only for most users)
DROP POLICY IF EXISTS "Users can view org usage logs" ON ai_usage_logs;
CREATE POLICY "Users can view org usage logs"
  ON ai_usage_logs FOR SELECT
  TO authenticated
  USING (
    has_ai_settings_view_permission(auth.uid(), org_id)
  );

DROP POLICY IF EXISTS "System can insert usage logs" ON ai_usage_logs;
CREATE POLICY "System can insert usage logs"
  ON ai_usage_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND organization_id = org_id
    )
  );
