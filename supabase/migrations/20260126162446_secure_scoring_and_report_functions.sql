/*
  # Secure Scoring and Report Functions - Fix Search Path Vulnerabilities

  This migration fixes security vulnerabilities in functions that were missing
  the `SET search_path TO ''` configuration, which could allow search path
  injection attacks.

  ## Problem
  Previous migrations created secured function versions with different parameter
  signatures, leaving the original vulnerable versions in place. This resulted
  in duplicate functions where only the unused versions were secured.

  ## Solution
  1. Drop the unused secured function versions (different signatures)
  2. Recreate the USED function versions with proper security settings:
     - `SET search_path TO ''` to prevent search path injection
     - Explicit schema references (public.) for all table/function calls

  ## Functions Fixed
  1. `exec_report_query(query_text text)` - AI reporting query execution
  2. `fn_check_rule_cooldown(...)` - Scoring rule cooldown check (5 params)
  3. `fn_apply_score_change(...)` - Apply score changes (9 params)
  4. `fn_process_scoring_event(...)` - Process scoring events (5 params)

  ## Unused Versions Dropped
  - `exec_report_query(p_query text, p_params jsonb)`
  - `fn_check_rule_cooldown(p_entity_type text, p_entity_id uuid, p_rule_id uuid)`
  - `fn_apply_score_change(p_org_id uuid, p_entity_type text, p_entity_id uuid, p_model_id uuid, p_delta integer)`
  - `fn_process_scoring_event()` (empty trigger stub)
*/

-- Drop unused secured versions that have different signatures
DROP FUNCTION IF EXISTS public.exec_report_query(text, jsonb);
DROP FUNCTION IF EXISTS public.fn_check_rule_cooldown(text, uuid, uuid);
DROP FUNCTION IF EXISTS public.fn_apply_score_change(uuid, text, uuid, uuid, integer);
DROP FUNCTION IF EXISTS public.fn_process_scoring_event();

-- Drop and recreate exec_report_query with security settings
DROP FUNCTION IF EXISTS public.exec_report_query(text);
CREATE FUNCTION public.exec_report_query(query_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  result jsonb;
  clean_query text;
BEGIN
  clean_query := trim(query_text);
  
  IF NOT (upper(clean_query) LIKE 'SELECT%') THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;
  
  IF clean_query ~* '\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|GRANT|REVOKE)\b' THEN
    RAISE EXCEPTION 'Query contains disallowed operations';
  END IF;
  
  EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || clean_query || ' LIMIT 1000) t'
  INTO result;
  
  RETURN COALESCE(result, '[]'::jsonb);
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Query execution failed: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION public.exec_report_query(text) IS 'Executes a read-only SQL query for AI reporting. Only SELECT queries are allowed. Secured with search_path.';

-- Drop and recreate fn_check_rule_cooldown with security settings
DROP FUNCTION IF EXISTS public.fn_check_rule_cooldown(uuid, uuid, text, integer, text);
CREATE FUNCTION public.fn_check_rule_cooldown(
  p_rule_id uuid,
  p_entity_id uuid,
  p_frequency_type text,
  p_cooldown_interval integer,
  p_cooldown_unit text
)
RETURNS boolean
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_last_execution timestamptz;
  v_cooldown_seconds integer;
BEGIN
  IF p_frequency_type = 'unlimited' THEN
    RETURN true;
  END IF;

  IF p_frequency_type = 'once' THEN
    SELECT executed_at INTO v_last_execution
    FROM public.scoring_rule_executions
    WHERE rule_id = p_rule_id AND entity_id = p_entity_id
    LIMIT 1;
    
    RETURN v_last_execution IS NULL;
  END IF;

  IF p_frequency_type = 'interval' THEN
    v_cooldown_seconds := CASE p_cooldown_unit
      WHEN 'minutes' THEN p_cooldown_interval * 60
      WHEN 'hours' THEN p_cooldown_interval * 3600
      WHEN 'days' THEN p_cooldown_interval * 86400
      ELSE 0
    END;

    SELECT executed_at INTO v_last_execution
    FROM public.scoring_rule_executions
    WHERE rule_id = p_rule_id AND entity_id = p_entity_id
    ORDER BY executed_at DESC
    LIMIT 1;

    IF v_last_execution IS NULL THEN
      RETURN true;
    END IF;

    RETURN (EXTRACT(EPOCH FROM (now() - v_last_execution)) >= v_cooldown_seconds);
  END IF;

  RETURN false;
END;
$$;

-- Drop and recreate fn_apply_score_change with security settings
DROP FUNCTION IF EXISTS public.fn_apply_score_change(uuid, uuid, text, uuid, integer, text, text, uuid, uuid);
CREATE FUNCTION public.fn_apply_score_change(
  p_org_id uuid,
  p_model_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_points_delta integer,
  p_reason text,
  p_source text,
  p_rule_id uuid DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_current_score integer;
  v_new_score integer;
  v_max_score integer;
  v_starting_score integer;
  v_score_record public.entity_scores%ROWTYPE;
BEGIN
  SELECT max_score, starting_score INTO v_max_score, v_starting_score
  FROM public.scoring_models
  WHERE id = p_model_id;

  SELECT * INTO v_score_record
  FROM public.entity_scores
  WHERE model_id = p_model_id AND entity_type = p_entity_type AND entity_id = p_entity_id
  FOR UPDATE;

  IF v_score_record.id IS NULL THEN
    v_current_score := COALESCE(v_starting_score, 0);
    v_new_score := v_current_score + p_points_delta;
    
    IF v_max_score IS NOT NULL AND v_new_score > v_max_score THEN
      v_new_score := v_max_score;
    END IF;
    IF v_new_score < 0 THEN
      v_new_score := 0;
    END IF;

    INSERT INTO public.entity_scores (org_id, model_id, entity_type, entity_id, current_score, last_updated_at)
    VALUES (p_org_id, p_model_id, p_entity_type, p_entity_id, v_new_score, now());
  ELSE
    v_current_score := v_score_record.current_score;
    v_new_score := v_current_score + p_points_delta;
    
    IF v_max_score IS NOT NULL AND v_new_score > v_max_score THEN
      v_new_score := v_max_score;
    END IF;
    IF v_new_score < 0 THEN
      v_new_score := 0;
    END IF;

    UPDATE public.entity_scores
    SET current_score = v_new_score, last_updated_at = now()
    WHERE id = v_score_record.id;
  END IF;

  INSERT INTO public.score_events (org_id, model_id, entity_type, entity_id, rule_id, points_delta, previous_score, new_score, reason, source, created_by)
  VALUES (p_org_id, p_model_id, p_entity_type, p_entity_id, p_rule_id, p_points_delta, v_current_score, v_new_score, p_reason, p_source, p_created_by);

  RETURN v_new_score;
END;
$$;

-- Drop and recreate fn_process_scoring_event with security settings
DROP FUNCTION IF EXISTS public.fn_process_scoring_event(uuid, text, uuid, text, jsonb);
CREATE FUNCTION public.fn_process_scoring_event(
  p_org_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_trigger_type text,
  p_trigger_data jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_rule RECORD;
  v_can_execute boolean;
BEGIN
  FOR v_rule IN
    SELECT sr.*, sm.org_id as model_org_id
    FROM public.scoring_rules sr
    JOIN public.scoring_models sm ON sr.model_id = sm.id
    WHERE sm.org_id = p_org_id
      AND sm.scope = p_entity_type
      AND sm.active = true
      AND sr.active = true
      AND sr.trigger_type = p_trigger_type
  LOOP
    v_can_execute := public.fn_check_rule_cooldown(
      v_rule.id,
      p_entity_id,
      v_rule.frequency_type,
      v_rule.cooldown_interval,
      v_rule.cooldown_unit
    );

    IF v_can_execute THEN
      PERFORM public.fn_apply_score_change(
        p_org_id,
        v_rule.model_id,
        p_entity_type,
        p_entity_id,
        v_rule.points,
        v_rule.name,
        'rule',
        v_rule.id
      );

      INSERT INTO public.scoring_rule_executions (rule_id, entity_id, executed_at)
      VALUES (v_rule.id, p_entity_id, now());
    END IF;
  END LOOP;
END;
$$;
