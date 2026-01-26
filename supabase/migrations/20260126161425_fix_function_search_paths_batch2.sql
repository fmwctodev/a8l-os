/*
  # Fix Function Search Paths - Batch 2

  This migration fixes more functions with mutable search_path.

  1. Functions Fixed
    - Brand voice/kit version functions
    - Various updated_at trigger functions
*/

-- Brand voice version functions
DROP FUNCTION IF EXISTS public.set_brand_voice_version_number() CASCADE;
CREATE FUNCTION public.set_brand_voice_version_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.version_number := public.get_next_brand_voice_version(NEW.brand_voice_id);
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.get_next_brand_voice_version(uuid);
CREATE FUNCTION public.get_next_brand_voice_version(p_voice_id uuid)
RETURNS integer
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  max_version integer;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) INTO max_version
  FROM public.brand_voice_versions
  WHERE brand_voice_id = p_voice_id;
  RETURN max_version + 1;
END;
$$;

-- Brand kit version functions
DROP FUNCTION IF EXISTS public.set_brand_kit_version_number() CASCADE;
CREATE FUNCTION public.set_brand_kit_version_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.version_number := public.get_next_brand_kit_version(NEW.brand_kit_id);
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.get_next_brand_kit_version(uuid);
CREATE FUNCTION public.get_next_brand_kit_version(p_kit_id uuid)
RETURNS integer
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  max_version integer;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) INTO max_version
  FROM public.brand_kit_versions
  WHERE brand_kit_id = p_kit_id;
  RETURN max_version + 1;
END;
$$;

-- Recreate brand version triggers
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'brand_voice_versions') THEN
    DROP TRIGGER IF EXISTS set_brand_voice_version_number ON public.brand_voice_versions;
    CREATE TRIGGER set_brand_voice_version_number
      BEFORE INSERT ON public.brand_voice_versions
      FOR EACH ROW EXECUTE FUNCTION public.set_brand_voice_version_number();
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'brand_kit_versions') THEN
    DROP TRIGGER IF EXISTS set_brand_kit_version_number ON public.brand_kit_versions;
    CREATE TRIGGER set_brand_kit_version_number
      BEFORE INSERT ON public.brand_kit_versions
      FOR EACH ROW EXECUTE FUNCTION public.set_brand_kit_version_number();
  END IF;
END $$;

-- Knowledge version function
DROP FUNCTION IF EXISTS public.get_next_knowledge_version(uuid);
CREATE FUNCTION public.get_next_knowledge_version(p_collection_id uuid)
RETURNS integer
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  max_version integer;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) INTO max_version
  FROM public.knowledge_versions
  WHERE collection_id = p_collection_id;
  RETURN max_version + 1;
END;
$$;

-- Fix workflow goals updated_at
DROP FUNCTION IF EXISTS public.update_workflow_goals_updated_at() CASCADE;
CREATE FUNCTION public.update_workflow_goals_updated_at()
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
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workflow_goals') THEN
    DROP TRIGGER IF EXISTS update_workflow_goals_updated_at ON public.workflow_goals;
    CREATE TRIGGER update_workflow_goals_updated_at
      BEFORE UPDATE ON public.workflow_goals
      FOR EACH ROW EXECUTE FUNCTION public.update_workflow_goals_updated_at();
  END IF;
END $$;

-- Fix custom field groups updated_at
DROP FUNCTION IF EXISTS public.update_custom_field_groups_updated_at() CASCADE;
CREATE FUNCTION public.update_custom_field_groups_updated_at()
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
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'custom_field_groups') THEN
    DROP TRIGGER IF EXISTS update_custom_field_groups_updated_at ON public.custom_field_groups;
    CREATE TRIGGER update_custom_field_groups_updated_at
      BEFORE UPDATE ON public.custom_field_groups
      FOR EACH ROW EXECUTE FUNCTION public.update_custom_field_groups_updated_at();
  END IF;
END $$;

-- Fix custom values updated_at
DROP FUNCTION IF EXISTS public.update_custom_values_updated_at() CASCADE;
CREATE FUNCTION public.update_custom_values_updated_at()
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
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'custom_values') THEN
    DROP TRIGGER IF EXISTS update_custom_values_updated_at ON public.custom_values;
    CREATE TRIGGER update_custom_values_updated_at
      BEFORE UPDATE ON public.custom_values
      FOR EACH ROW EXECUTE FUNCTION public.update_custom_values_updated_at();
  END IF;
END $$;

-- Fix LLM model catalog updated_at
DROP FUNCTION IF EXISTS public.update_llm_model_catalog_updated_at() CASCADE;
CREATE FUNCTION public.update_llm_model_catalog_updated_at()
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
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'llm_model_catalog') THEN
    DROP TRIGGER IF EXISTS llm_model_catalog_updated_at ON public.llm_model_catalog;
    CREATE TRIGGER llm_model_catalog_updated_at
      BEFORE UPDATE ON public.llm_model_catalog
      FOR EACH ROW EXECUTE FUNCTION public.update_llm_model_catalog_updated_at();
  END IF;
END $$;

-- Fix workflow updated_at
DROP FUNCTION IF EXISTS public.update_workflow_updated_at() CASCADE;
CREATE FUNCTION public.update_workflow_updated_at()
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
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workflows') THEN
    DROP TRIGGER IF EXISTS update_workflow_updated_at ON public.workflows;
    CREATE TRIGGER update_workflow_updated_at
      BEFORE UPDATE ON public.workflows
      FOR EACH ROW EXECUTE FUNCTION public.update_workflow_updated_at();
  END IF;
END $$;
