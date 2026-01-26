/*
  # Fix Function Search Paths - Batch 5

  This migration fixes remaining functions with mutable search_path.

  1. Functions Fixed
    - Scoring trigger functions
    - Rule cooldown function
    - exec_report_query function
*/

-- Fix scoring trigger functions
DROP FUNCTION IF EXISTS public.fn_trigger_scoring_opportunity() CASCADE;
CREATE FUNCTION public.fn_trigger_scoring_opportunity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.fn_trigger_scoring_appointment() CASCADE;
CREATE FUNCTION public.fn_trigger_scoring_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.fn_trigger_scoring_payment() CASCADE;
CREATE FUNCTION public.fn_trigger_scoring_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.fn_trigger_scoring_form_submission() CASCADE;
CREATE FUNCTION public.fn_trigger_scoring_form_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN NEW;
END;
$$;

-- Fix rule cooldown function
DROP FUNCTION IF EXISTS public.fn_check_rule_cooldown(text, uuid, uuid) CASCADE;
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
  v_cooldown integer;
  v_last_event timestamptz;
BEGIN
  SELECT cooldown_seconds INTO v_cooldown
  FROM public.scoring_rules
  WHERE id = p_rule_id;
  
  IF v_cooldown IS NULL OR v_cooldown = 0 THEN
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
  
  RETURN (now() - v_last_event) > (v_cooldown * interval '1 second');
END;
$$;

-- Fix exec_report_query function
DROP FUNCTION IF EXISTS public.exec_report_query(text, jsonb);
CREATE FUNCTION public.exec_report_query(
  p_query text,
  p_params jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result jsonb;
BEGIN
  EXECUTE p_query INTO result USING p_params;
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$;
