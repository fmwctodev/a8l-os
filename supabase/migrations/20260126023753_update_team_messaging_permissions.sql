/*
  # Update Team Messaging Permissions

  ## Overview
  Updates team messaging permissions to reflect in-house messaging system
  instead of Google Chat integration.

  ## Changes
  - Update permission descriptions to reflect new functionality
  - Add permission for creating group channels (admins only)
*/

-- Update existing team messaging permissions
UPDATE permissions
SET description = 'View team messaging channels and messages'
WHERE key = 'team_messaging.view';

UPDATE permissions
SET description = 'Send messages in team channels'
WHERE key = 'team_messaging.send';

UPDATE permissions
SET description = 'Create and manage group channels'
WHERE key = 'team_messaging.manage';

-- Add permission for group creation to admin roles
DO $$
DECLARE
  v_admin_role_id uuid;
  v_super_admin_role_id uuid;
  v_permission_id uuid;
BEGIN
  -- Get role IDs
  SELECT id INTO v_admin_role_id FROM roles WHERE name = 'Admin' LIMIT 1;
  SELECT id INTO v_super_admin_role_id FROM roles WHERE name = 'Super Admin' LIMIT 1;
  
  -- Get team_messaging.manage permission ID
  SELECT id INTO v_permission_id FROM permissions WHERE key = 'team_messaging.manage' LIMIT 1;
  
  -- Ensure Admin has manage permission
  IF v_admin_role_id IS NOT NULL AND v_permission_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    VALUES (v_admin_role_id, v_permission_id)
    ON CONFLICT DO NOTHING;
  END IF;
  
  -- Ensure Super Admin has manage permission
  IF v_super_admin_role_id IS NOT NULL AND v_permission_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    VALUES (v_super_admin_role_id, v_permission_id)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
