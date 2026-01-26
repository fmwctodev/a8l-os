/*
  # Fix Function Search Paths - Batch 3

  This migration fixes remaining functions with mutable search_path.

  1. Functions Fixed
    - More updated_at trigger functions
    - Scoring trigger functions
    - Message template functions
*/

-- Fix org opportunity custom field values updated_at
DROP FUNCTION IF EXISTS public.update_org_opp_cfv_updated_at() CASCADE;
CREATE FUNCTION public.update_org_opp_cfv_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'org_opportunity_custom_field_values') THEN
    DROP TRIGGER IF EXISTS update_org_opp_cfv_updated_at ON public.org_opportunity_custom_field_values;
    CREATE TRIGGER update_org_opp_cfv_updated_at
      BEFORE UPDATE ON public.org_opportunity_custom_field_values
      FOR EACH ROW EXECUTE FUNCTION public.update_org_opp_cfv_updated_at();
  END IF;
END $$;

-- Fix social account groups updated_at
DROP FUNCTION IF EXISTS public.update_social_account_groups_updated_at() CASCADE;
CREATE FUNCTION public.update_social_account_groups_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'social_account_groups') THEN
    DROP TRIGGER IF EXISTS update_social_account_groups_updated_at ON public.social_account_groups;
    CREATE TRIGGER update_social_account_groups_updated_at
      BEFORE UPDATE ON public.social_account_groups
      FOR EACH ROW EXECUTE FUNCTION public.update_social_account_groups_updated_at();
  END IF;
END $$;

-- Fix opportunity stage changed_at
DROP FUNCTION IF EXISTS public.update_opportunity_stage_changed_at() CASCADE;
CREATE FUNCTION public.update_opportunity_stage_changed_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    NEW.stage_changed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'opportunities') THEN
    DROP TRIGGER IF EXISTS update_opportunity_stage_changed_at ON public.opportunities;
    CREATE TRIGGER update_opportunity_stage_changed_at
      BEFORE UPDATE ON public.opportunities
      FOR EACH ROW EXECUTE FUNCTION public.update_opportunity_stage_changed_at();
  END IF;
END $$;

-- Fix AI agent memory timestamp
DROP FUNCTION IF EXISTS public.update_ai_agent_memory_timestamp() CASCADE;
CREATE FUNCTION public.update_ai_agent_memory_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_agent_memory') THEN
    DROP TRIGGER IF EXISTS update_ai_agent_memory_timestamp ON public.ai_agent_memory;
    CREATE TRIGGER update_ai_agent_memory_timestamp
      BEFORE UPDATE ON public.ai_agent_memory
      FOR EACH ROW EXECUTE FUNCTION public.update_ai_agent_memory_timestamp();
  END IF;
END $$;

-- Fix payments updated_at
DROP FUNCTION IF EXISTS public.update_payments_updated_at() CASCADE;
CREATE FUNCTION public.update_payments_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
    DROP TRIGGER IF EXISTS update_payments_updated_at ON public.payments;
    CREATE TRIGGER update_payments_updated_at
      BEFORE UPDATE ON public.payments
      FOR EACH ROW EXECUTE FUNCTION public.update_payments_updated_at();
  END IF;
END $$;

-- Fix ensure single default model catalog
DROP FUNCTION IF EXISTS public.ensure_single_default_model_catalog() CASCADE;
CREATE FUNCTION public.ensure_single_default_model_catalog()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.llm_model_catalog
    SET is_default = false
    WHERE org_id = NEW.org_id
      AND id != NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'llm_model_catalog') THEN
    DROP TRIGGER IF EXISTS ensure_single_default_model_catalog_trigger ON public.llm_model_catalog;
    CREATE TRIGGER ensure_single_default_model_catalog_trigger
      BEFORE INSERT OR UPDATE ON public.llm_model_catalog
      FOR EACH ROW
      WHEN (NEW.is_default = true)
      EXECUTE FUNCTION public.ensure_single_default_model_catalog();
  END IF;
END $$;

-- Fix opportunities updated_at
DROP FUNCTION IF EXISTS public.update_opportunities_updated_at() CASCADE;
CREATE FUNCTION public.update_opportunities_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'opportunities') THEN
    DROP TRIGGER IF EXISTS update_opportunities_updated_at ON public.opportunities;
    CREATE TRIGGER update_opportunities_updated_at
      BEFORE UPDATE ON public.opportunities
      FOR EACH ROW EXECUTE FUNCTION public.update_opportunities_updated_at();
  END IF;
END $$;

-- Fix message template functions
DROP FUNCTION IF EXISTS public.parse_message_template_variables(text);
CREATE FUNCTION public.parse_message_template_variables(content text)
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
  FOR match IN SELECT (regexp_matches(content, '\{\{([a-zA-Z_][a-zA-Z0-9_.]*)\}\}', 'g'))[1]
  LOOP
    IF NOT match = ANY(result) THEN
      result := array_append(result, match);
    END IF;
  END LOOP;
  RETURN result;
END;
$$;

DROP FUNCTION IF EXISTS public.auto_parse_message_template_variables() CASCADE;
CREATE FUNCTION public.auto_parse_message_template_variables()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.variables := public.parse_message_template_variables(NEW.content);
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'message_templates') THEN
    DROP TRIGGER IF EXISTS auto_parse_message_template_variables ON public.message_templates;
    CREATE TRIGGER auto_parse_message_template_variables
      BEFORE INSERT OR UPDATE ON public.message_templates
      FOR EACH ROW EXECUTE FUNCTION public.auto_parse_message_template_variables();
  END IF;
END $$;
