/*
  # Fix ai_agent_memory timestamp trigger

  1. Problem
    - The update_ai_agent_memory_timestamp trigger function references NEW.updated_at
    - But the ai_agent_memory table uses `last_updated_at` as its column name
    - This causes "record 'new' has no field 'updated_at'" errors on any UPDATE

  2. Fix
    - Replace the trigger function to reference the correct column: last_updated_at
*/

CREATE OR REPLACE FUNCTION public.update_ai_agent_memory_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  NEW.last_updated_at = now();
  RETURN NEW;
END;
$$;
