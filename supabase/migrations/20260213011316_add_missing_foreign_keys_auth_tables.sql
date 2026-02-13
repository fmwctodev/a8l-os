/*
  # Add missing foreign keys for auth-related tables

  1. Changes
    - Add FK from `users.role_id` to `roles.id`
    - Add FK from `role_permissions.role_id` to `roles.id`
    - Add FK from `role_permissions.permission_id` to `permissions.id`
    - Add FK from `user_permission_overrides.user_id` to `users.id`
    - Add FK from `user_permission_overrides.permission_id` to `permissions.id`

  2. Notes
    - These referential integrity constraints were missing, which prevented
      PostgREST nested joins from resolving and caused 401 auth failures
      in edge functions using the shared auth module
    - All constraints use IF NOT EXISTS pattern via DO blocks for safety
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'users_role_id_fkey'
    AND table_name = 'users'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_role_id_fkey
      FOREIGN KEY (role_id) REFERENCES roles(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'role_permissions_role_id_fkey'
    AND table_name = 'role_permissions'
  ) THEN
    ALTER TABLE role_permissions
      ADD CONSTRAINT role_permissions_role_id_fkey
      FOREIGN KEY (role_id) REFERENCES roles(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'role_permissions_permission_id_fkey'
    AND table_name = 'role_permissions'
  ) THEN
    ALTER TABLE role_permissions
      ADD CONSTRAINT role_permissions_permission_id_fkey
      FOREIGN KEY (permission_id) REFERENCES permissions(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'user_permission_overrides_user_id_fkey'
    AND table_name = 'user_permission_overrides'
  ) THEN
    ALTER TABLE user_permission_overrides
      ADD CONSTRAINT user_permission_overrides_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'user_permission_overrides_permission_id_fkey'
    AND table_name = 'user_permission_overrides'
  ) THEN
    ALTER TABLE user_permission_overrides
      ADD CONSTRAINT user_permission_overrides_permission_id_fkey
      FOREIGN KEY (permission_id) REFERENCES permissions(id);
  END IF;
END $$;
