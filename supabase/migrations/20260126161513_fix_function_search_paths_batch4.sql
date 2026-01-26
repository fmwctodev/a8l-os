/*
  # Fix Function Search Paths - Batch 4

  This migration fixes remaining functions with mutable search_path.

  1. Functions Fixed
    - Brand voice/kit timestamp functions
    - Scoring trigger functions
    - Various updated_at triggers
    - exec_report_query function
*/

-- Fix brand voice timestamp
DROP FUNCTION IF EXISTS public.update_brand_voice_timestamp() CASCADE;
CREATE FUNCTION public.update_brand_voice_timestamp()
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
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'brand_voices') THEN
    DROP TRIGGER IF EXISTS update_brand_voice_timestamp ON public.brand_voices;
    CREATE TRIGGER update_brand_voice_timestamp
      BEFORE UPDATE ON public.brand_voices
      FOR EACH ROW EXECUTE FUNCTION public.update_brand_voice_timestamp();
  END IF;
END $$;

-- Fix brand kit timestamp
DROP FUNCTION IF EXISTS public.update_brand_kit_timestamp() CASCADE;
CREATE FUNCTION public.update_brand_kit_timestamp()
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
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'brand_kits') THEN
    DROP TRIGGER IF EXISTS update_brand_kit_timestamp ON public.brand_kits;
    CREATE TRIGGER update_brand_kit_timestamp
      BEFORE UPDATE ON public.brand_kits
      FOR EACH ROW EXECUTE FUNCTION public.update_brand_kit_timestamp();
  END IF;
END $$;

-- Fix AI agent updated_at
DROP FUNCTION IF EXISTS public.update_ai_agent_updated_at() CASCADE;
CREATE FUNCTION public.update_ai_agent_updated_at()
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
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_agents') THEN
    DROP TRIGGER IF EXISTS update_ai_agent_updated_at ON public.ai_agents;
    CREATE TRIGGER update_ai_agent_updated_at
      BEFORE UPDATE ON public.ai_agents
      FOR EACH ROW EXECUTE FUNCTION public.update_ai_agent_updated_at();
  END IF;
END $$;

-- Fix workflow AI runs updated_at
DROP FUNCTION IF EXISTS public.update_workflow_ai_runs_updated_at() CASCADE;
CREATE FUNCTION public.update_workflow_ai_runs_updated_at()
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
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workflow_ai_runs') THEN
    DROP TRIGGER IF EXISTS update_workflow_ai_runs_updated_at ON public.workflow_ai_runs;
    CREATE TRIGGER update_workflow_ai_runs_updated_at
      BEFORE UPDATE ON public.workflow_ai_runs
      FOR EACH ROW EXECUTE FUNCTION public.update_workflow_ai_runs_updated_at();
  END IF;
END $$;

-- Fix social post content updated_at
DROP FUNCTION IF EXISTS public.update_social_post_content_updated_at() CASCADE;
CREATE FUNCTION public.update_social_post_content_updated_at()
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
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'social_post_content') THEN
    DROP TRIGGER IF EXISTS update_social_post_content_updated_at ON public.social_post_content;
    CREATE TRIGGER update_social_post_content_updated_at
      BEFORE UPDATE ON public.social_post_content
      FOR EACH ROW EXECUTE FUNCTION public.update_social_post_content_updated_at();
  END IF;
END $$;

-- Fix custom fields updated_at
DROP FUNCTION IF EXISTS public.update_custom_fields_updated_at() CASCADE;
CREATE FUNCTION public.update_custom_fields_updated_at()
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
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'custom_fields') THEN
    DROP TRIGGER IF EXISTS update_custom_fields_updated_at ON public.custom_fields;
    CREATE TRIGGER update_custom_fields_updated_at
      BEFORE UPDATE ON public.custom_fields
      FOR EACH ROW EXECUTE FUNCTION public.update_custom_fields_updated_at();
  END IF;
END $$;

-- Fix general updated_at_column function
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
CREATE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix integrations updated_at
DROP FUNCTION IF EXISTS public.update_integrations_updated_at() CASCADE;
CREATE FUNCTION public.update_integrations_updated_at()
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
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'integrations') THEN
    DROP TRIGGER IF EXISTS update_integrations_updated_at ON public.integrations;
    CREATE TRIGGER update_integrations_updated_at
      BEFORE UPDATE ON public.integrations
      FOR EACH ROW EXECUTE FUNCTION public.update_integrations_updated_at();
  END IF;
END $$;

-- Fix social post metrics updated_at
DROP FUNCTION IF EXISTS public.update_social_post_metrics_updated_at() CASCADE;
CREATE FUNCTION public.update_social_post_metrics_updated_at()
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
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'social_post_metrics') THEN
    DROP TRIGGER IF EXISTS update_social_post_metrics_updated_at ON public.social_post_metrics;
    CREATE TRIGGER update_social_post_metrics_updated_at
      BEFORE UPDATE ON public.social_post_metrics
      FOR EACH ROW EXECUTE FUNCTION public.update_social_post_metrics_updated_at();
  END IF;
END $$;

-- Fix departments updated_at
DROP FUNCTION IF EXISTS public.update_departments_updated_at() CASCADE;
CREATE FUNCTION public.update_departments_updated_at()
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
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'departments') THEN
    DROP TRIGGER IF EXISTS update_departments_updated_at ON public.departments;
    CREATE TRIGGER update_departments_updated_at
      BEFORE UPDATE ON public.departments
      FOR EACH ROW EXECUTE FUNCTION public.update_departments_updated_at();
  END IF;
END $$;

-- Fix AI settings updated_at
DROP FUNCTION IF EXISTS public.update_ai_settings_updated_at() CASCADE;
CREATE FUNCTION public.update_ai_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix email updated_at
DROP FUNCTION IF EXISTS public.update_email_updated_at() CASCADE;
CREATE FUNCTION public.update_email_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix proposals updated_at
DROP FUNCTION IF EXISTS public.update_proposals_updated_at() CASCADE;
CREATE FUNCTION public.update_proposals_updated_at()
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
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'proposals') THEN
    DROP TRIGGER IF EXISTS update_proposals_updated_at ON public.proposals;
    CREATE TRIGGER update_proposals_updated_at
      BEFORE UPDATE ON public.proposals
      FOR EACH ROW EXECUTE FUNCTION public.update_proposals_updated_at();
  END IF;
END $$;

-- Fix conversation notes updated_at
DROP FUNCTION IF EXISTS public.update_conversation_notes_updated_at() CASCADE;
CREATE FUNCTION public.update_conversation_notes_updated_at()
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
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversation_notes') THEN
    DROP TRIGGER IF EXISTS update_conversation_notes_updated_at ON public.conversation_notes;
    CREATE TRIGGER update_conversation_notes_updated_at
      BEFORE UPDATE ON public.conversation_notes
      FOR EACH ROW EXECUTE FUNCTION public.update_conversation_notes_updated_at();
  END IF;
END $$;

-- Fix blocked slots updated_at
DROP FUNCTION IF EXISTS public.update_blocked_slots_updated_at() CASCADE;
CREATE FUNCTION public.update_blocked_slots_updated_at()
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
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'blocked_slots') THEN
    DROP TRIGGER IF EXISTS update_blocked_slots_updated_at ON public.blocked_slots;
    CREATE TRIGGER update_blocked_slots_updated_at
      BEFORE UPDATE ON public.blocked_slots
      FOR EACH ROW EXECUTE FUNCTION public.update_blocked_slots_updated_at();
  END IF;
END $$;
