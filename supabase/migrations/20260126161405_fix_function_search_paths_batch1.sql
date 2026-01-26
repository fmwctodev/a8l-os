/*
  # Fix Function Search Paths - Batch 1

  This migration fixes functions with mutable search_path to prevent
  search_path manipulation attacks.

  1. Security Issue
    - Functions without SET search_path can be exploited by malicious users
      who create objects with the same name in their schema
    - Setting search_path to '' forces explicit schema references

  2. Functions Fixed
    - Scoring and rule functions
    - Trigger functions for updated_at timestamps
*/

-- Fix scoring functions
DROP FUNCTION IF EXISTS public.fn_check_rule_cooldown(text, uuid, uuid);
CREATE FUNCTION public.fn_check_rule_cooldown(
  p_entity_type text,
  p_entity_id uuid,
  p_rule_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rule RECORD;
  v_last_event timestamptz;
BEGIN
  SELECT cooldown_seconds INTO v_rule
  FROM public.scoring_rules
  WHERE id = p_rule_id;
  
  IF v_rule.cooldown_seconds IS NULL OR v_rule.cooldown_seconds = 0 THEN
    RETURN true;
  END IF;
  
  SELECT MAX(created_at) INTO v_last_event
  FROM public.score_events
  WHERE entity_type = p_entity_type
    AND entity_id = p_entity_id
    AND rule_id = p_rule_id;
    
  IF v_last_event IS NULL THEN
    RETURN true;
  END IF;
  
  RETURN (now() - v_last_event) > (v_rule.cooldown_seconds * interval '1 second');
END;
$$;

DROP FUNCTION IF EXISTS public.fn_apply_score_change(uuid, text, uuid, uuid, integer);
CREATE FUNCTION public.fn_apply_score_change(
  p_org_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_model_id uuid,
  p_delta integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.entity_scores (org_id, entity_type, entity_id, model_id, score)
  VALUES (p_org_id, p_entity_type, p_entity_id, p_model_id, p_delta)
  ON CONFLICT (entity_type, entity_id, model_id)
  DO UPDATE SET 
    score = public.entity_scores.score + p_delta,
    updated_at = now();
END;
$$;

DROP FUNCTION IF EXISTS public.fn_check_score_threshold() CASCADE;
CREATE FUNCTION public.fn_check_score_threshold()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.fn_process_scoring_event() CASCADE;
CREATE FUNCTION public.fn_process_scoring_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN NEW;
END;
$$;

-- Fix Google Chat trigger functions
DROP FUNCTION IF EXISTS public.update_google_chat_subscriptions_updated_at() CASCADE;
CREATE FUNCTION public.update_google_chat_subscriptions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.update_google_chat_spaces_cache_updated_at() CASCADE;
CREATE FUNCTION public.update_google_chat_spaces_cache_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.update_google_chat_tokens_updated_at() CASCADE;
CREATE FUNCTION public.update_google_chat_tokens_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate triggers that were dropped with CASCADE
CREATE TRIGGER update_google_chat_subscriptions_updated_at
  BEFORE UPDATE ON public.google_chat_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_google_chat_subscriptions_updated_at();

CREATE TRIGGER update_google_chat_spaces_cache_updated_at
  BEFORE UPDATE ON public.google_chat_spaces_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_google_chat_spaces_cache_updated_at();

CREATE TRIGGER update_google_chat_tokens_updated_at
  BEFORE UPDATE ON public.google_chat_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_google_chat_tokens_updated_at();

-- Fix prompt template functions
DROP FUNCTION IF EXISTS public.parse_prompt_variables(text) CASCADE;
CREATE FUNCTION public.parse_prompt_variables(content text)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  result text[];
  match text;
BEGIN
  result := ARRAY[]::text[];
  FOR match IN SELECT (regexp_matches(content, '\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}', 'g'))[1]
  LOOP
    IF NOT match = ANY(result) THEN
      result := array_append(result, match);
    END IF;
  END LOOP;
  RETURN result;
END;
$$;

DROP FUNCTION IF EXISTS public.auto_parse_prompt_variables() CASCADE;
CREATE FUNCTION public.auto_parse_prompt_variables()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.variables := public.parse_prompt_variables(NEW.content);
  RETURN NEW;
END;
$$;

-- Recreate trigger for prompt templates
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prompt_templates') THEN
    DROP TRIGGER IF EXISTS auto_parse_prompt_variables ON public.prompt_templates;
    CREATE TRIGGER auto_parse_prompt_variables
      BEFORE INSERT OR UPDATE ON public.prompt_templates
      FOR EACH ROW EXECUTE FUNCTION public.auto_parse_prompt_variables();
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.get_next_prompt_version(uuid);
CREATE FUNCTION public.get_next_prompt_version(p_template_id uuid)
RETURNS integer
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  max_version integer;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) INTO max_version
  FROM public.prompt_template_versions
  WHERE template_id = p_template_id;
  RETURN max_version + 1;
END;
$$;
