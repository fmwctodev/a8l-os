/*
  # Clara Memory Decay System

  1. New Functions
    - `decrement_clara_memory_score` - Safely decrements importance_score by 1 for a given memory
      - Uses SECURITY DEFINER so it can be called from edge functions via service role
      - Ensures score never goes below 0

  2. Cron Job
    - `clara-memory-decay` - Runs weekly on Sunday at 3 AM UTC
    - Calls the clara-memory-decay edge function to process stale memories
    - Memories not accessed in 90 days get importance_score reduced by 1
    - Memories with importance_score <= 0 are deleted (except strategic_context)
*/

CREATE OR REPLACE FUNCTION decrement_clara_memory_score(p_memory_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE clara_memories
  SET importance_score = GREATEST(importance_score - 1, 0),
      updated_at = now()
  WHERE id = p_memory_id;
END;
$$;

SELECT cron.schedule(
  'clara-memory-decay',
  '0 3 * * 0',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/clara-memory-decay',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  )
  $$
);
