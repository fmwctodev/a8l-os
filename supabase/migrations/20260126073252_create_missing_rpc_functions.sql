/*
  # Create Missing RPC Functions

  1. New Functions
    - `check_rls_enabled()` - Returns a table of all public tables and their RLS status
      - Used by health check service to verify database security
      - Returns: table_name (text), rls_enabled (boolean)
    
    - `increment_template_usage(template_id uuid)` - Increments usage counter for agent templates
      - Used when an agent template is used to create a new agent
      - Parameter: template_id - The UUID of the template being used
      - Returns: void (updates times_used column atomically)

  2. Security
    - Both functions use SECURITY DEFINER to run with elevated privileges
    - Execute permissions granted to authenticated users only
    - check_rls_enabled is read-only and safe
    - increment_template_usage only allows incrementing (no direct value setting)

  3. Notes
    - These functions are referenced in services but were not previously defined
    - check_rls_enabled queries pg_class system catalog
    - increment_template_usage uses atomic increment to prevent race conditions
*/

-- Function to check RLS status on all tables (used by health check)
CREATE OR REPLACE FUNCTION check_rls_enabled()
RETURNS TABLE(table_name text, rls_enabled boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    c.relname::text AS table_name,
    c.relrowsecurity AS rls_enabled
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relname NOT LIKE 'pg_%'
    AND c.relname NOT LIKE 'schema_%'
  ORDER BY c.relname;
$$;

GRANT EXECUTE ON FUNCTION check_rls_enabled() TO authenticated;

-- Function to increment template usage count (used when creating agents from templates)
CREATE OR REPLACE FUNCTION increment_template_usage(p_template_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE agent_templates
  SET 
    times_used = COALESCE(times_used, 0) + 1,
    updated_at = now()
  WHERE id = p_template_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template with id % not found', p_template_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_template_usage(uuid) TO authenticated;
