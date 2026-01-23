/*
  # Fix Scoring RLS Permission Helper Function

  1. Updates
    - Fix `user_has_scoring_permission` function to use correct column names
    - Uses `key` instead of `code` for permissions table
*/

CREATE OR REPLACE FUNCTION user_has_scoring_permission(p_permission text)
RETURNS boolean AS $$
DECLARE
  v_user_id uuid;
  v_has_permission boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1 
    FROM users u
    JOIN role_permissions rp ON rp.role_id = u.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE u.id = v_user_id 
      AND p.key = p_permission
  ) INTO v_has_permission;

  RETURN v_has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
