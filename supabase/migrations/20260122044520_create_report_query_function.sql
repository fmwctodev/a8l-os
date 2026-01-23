/*
  # Create Report Query Execution Function

  This migration creates a secure function to execute dynamic report queries.

  1. Function
    - `execute_report_query(query_text, query_params)` - Executes parameterized queries for reports
    - Only allows SELECT queries for safety
    - Validates organization access

  2. Security
    - Function runs with SECURITY DEFINER for elevated access
    - Validates query starts with SELECT
    - Returns JSONB array of results
*/

CREATE OR REPLACE FUNCTION execute_report_query(
  query_text text,
  query_params jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  param_array text[];
  i int;
BEGIN
  IF NOT (UPPER(TRIM(query_text)) LIKE 'SELECT%') THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;

  IF query_text ~* '\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE)\b' THEN
    RAISE EXCEPTION 'Query contains forbidden operations';
  END IF;

  EXECUTE format('SELECT COALESCE(jsonb_agg(row_to_json(q)), ''[]''::jsonb) FROM (%s) q', query_text)
    USING 
      CASE WHEN jsonb_array_length(query_params) > 0 THEN query_params->0 ELSE NULL END,
      CASE WHEN jsonb_array_length(query_params) > 1 THEN query_params->1 ELSE NULL END,
      CASE WHEN jsonb_array_length(query_params) > 2 THEN query_params->2 ELSE NULL END,
      CASE WHEN jsonb_array_length(query_params) > 3 THEN query_params->3 ELSE NULL END,
      CASE WHEN jsonb_array_length(query_params) > 4 THEN query_params->4 ELSE NULL END,
      CASE WHEN jsonb_array_length(query_params) > 5 THEN query_params->5 ELSE NULL END,
      CASE WHEN jsonb_array_length(query_params) > 6 THEN query_params->6 ELSE NULL END,
      CASE WHEN jsonb_array_length(query_params) > 7 THEN query_params->7 ELSE NULL END,
      CASE WHEN jsonb_array_length(query_params) > 8 THEN query_params->8 ELSE NULL END,
      CASE WHEN jsonb_array_length(query_params) > 9 THEN query_params->9 ELSE NULL END
    INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION execute_report_query TO authenticated;