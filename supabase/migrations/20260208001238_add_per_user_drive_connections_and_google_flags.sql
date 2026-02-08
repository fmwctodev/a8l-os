/*
  # Per-User Google Drive Connections & Google Status Flags

  1. Modified Tables
    - `drive_connections`
      - Add `user_id` (uuid, FK to users, NOT NULL) -- each user connects their own Drive
      - Add `connected_by` (uuid, FK to users, nullable) -- who initiated the connection
      - Drop old UNIQUE constraint on (organization_id) -- was one-per-org
      - Add new UNIQUE constraint on (user_id) -- now one-per-user
    - `drive_files`
      - Add `user_id` (uuid, FK to users, NOT NULL) -- files belong to the user who synced them
      - Drop old UNIQUE constraint on (organization_id, drive_file_id)
      - Add new UNIQUE constraint on (user_id, drive_file_id)
    - `drive_folders`
      - Add `user_id` (uuid, FK to users, NOT NULL) -- folders belong to the user who synced them
      - Drop old UNIQUE constraint on (organization_id, drive_folder_id)
      - Add new UNIQUE constraint on (user_id, drive_folder_id)
    - `users`
      - Add `google_login_connected` (boolean, DEFAULT false)
      - Add `google_drive_connected` (boolean, DEFAULT false)

  2. Data Migration
    - Existing drive_connections rows are assigned user_id from the first admin in that org
    - Existing drive_files and drive_folders rows get user_id from their org's drive_connection

  3. New Indexes
    - idx_drive_connections_user on drive_connections(user_id)
    - idx_drive_files_user on drive_files(user_id)
    - idx_drive_files_user_file on drive_files(user_id, drive_file_id)
    - idx_drive_folders_user on drive_folders(user_id)
    - idx_drive_folders_user_folder on drive_folders(user_id, drive_folder_id)

  4. Important Notes
    - Drive is now per-user: each user in an org connects their own Google Drive
    - The google_login_connected flag tracks whether the user signed in via Google OAuth
    - The google_drive_connected flag tracks whether the user has granted Drive file access
    - Tokens are stored separately (auth tokens via Supabase Auth, Drive tokens in drive_connections)
*/

-- Step 1: Add google flags to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'google_login_connected'
  ) THEN
    ALTER TABLE users ADD COLUMN google_login_connected boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'google_drive_connected'
  ) THEN
    ALTER TABLE users ADD COLUMN google_drive_connected boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Step 2: Add user_id to drive_connections
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drive_connections' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE drive_connections ADD COLUMN user_id uuid REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drive_connections' AND column_name = 'connected_by'
  ) THEN
    ALTER TABLE drive_connections ADD COLUMN connected_by uuid REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Migrate existing data: assign user_id from first admin user in the org
UPDATE drive_connections dc
SET user_id = (
  SELECT u.id FROM users u
  WHERE u.organization_id = dc.organization_id
  AND u.status = 'active'
  ORDER BY u.created_at ASC
  LIMIT 1
),
connected_by = (
  SELECT u.id FROM users u
  WHERE u.organization_id = dc.organization_id
  AND u.status = 'active'
  ORDER BY u.created_at ASC
  LIMIT 1
)
WHERE dc.user_id IS NULL;

-- Set google flags for users who already have drive connections
UPDATE users u
SET google_drive_connected = true
FROM drive_connections dc
WHERE dc.user_id = u.id AND dc.is_active = true;

-- Now make user_id NOT NULL (after data migration)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drive_connections'
    AND column_name = 'user_id'
    AND is_nullable = 'YES'
  ) THEN
    -- Delete any rows that still have NULL user_id (orphaned)
    DELETE FROM drive_connections WHERE user_id IS NULL;
    ALTER TABLE drive_connections ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;

-- Drop old unique constraint and add new one
ALTER TABLE drive_connections DROP CONSTRAINT IF EXISTS drive_connections_org_unique;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'drive_connections_user_unique'
  ) THEN
    ALTER TABLE drive_connections ADD CONSTRAINT drive_connections_user_unique UNIQUE (user_id);
  END IF;
END $$;

-- Step 3: Add user_id to drive_files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drive_files' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE drive_files ADD COLUMN user_id uuid REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Migrate existing drive_files: set user_id from their org's drive_connection
UPDATE drive_files df
SET user_id = (
  SELECT dc.user_id FROM drive_connections dc
  WHERE dc.organization_id = df.organization_id
  AND dc.is_active = true
  LIMIT 1
)
WHERE df.user_id IS NULL;

-- Delete orphans and make NOT NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drive_files'
    AND column_name = 'user_id'
    AND is_nullable = 'YES'
  ) THEN
    DELETE FROM drive_files WHERE user_id IS NULL;
    ALTER TABLE drive_files ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;

-- Update unique constraint on drive_files
ALTER TABLE drive_files DROP CONSTRAINT IF EXISTS drive_files_org_file_unique;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'drive_files_user_file_unique'
  ) THEN
    ALTER TABLE drive_files ADD CONSTRAINT drive_files_user_file_unique UNIQUE (user_id, drive_file_id);
  END IF;
END $$;

-- Step 4: Add user_id to drive_folders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drive_folders' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE drive_folders ADD COLUMN user_id uuid REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Migrate existing drive_folders
UPDATE drive_folders df
SET user_id = (
  SELECT dc.user_id FROM drive_connections dc
  WHERE dc.organization_id = df.organization_id
  AND dc.is_active = true
  LIMIT 1
)
WHERE df.user_id IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drive_folders'
    AND column_name = 'user_id'
    AND is_nullable = 'YES'
  ) THEN
    DELETE FROM drive_folders WHERE user_id IS NULL;
    ALTER TABLE drive_folders ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;

-- Update unique constraint on drive_folders
ALTER TABLE drive_folders DROP CONSTRAINT IF EXISTS drive_folders_org_folder_unique;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'drive_folders_user_folder_unique'
  ) THEN
    ALTER TABLE drive_folders ADD CONSTRAINT drive_folders_user_folder_unique UNIQUE (user_id, drive_folder_id);
  END IF;
END $$;

-- Step 5: Add new indexes
CREATE INDEX IF NOT EXISTS idx_drive_connections_user ON drive_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_drive_files_user ON drive_files(user_id);
CREATE INDEX IF NOT EXISTS idx_drive_files_user_file ON drive_files(user_id, drive_file_id);
CREATE INDEX IF NOT EXISTS idx_drive_files_user_parent ON drive_files(user_id, parent_drive_folder_id);
CREATE INDEX IF NOT EXISTS idx_drive_folders_user ON drive_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_drive_folders_user_folder ON drive_folders(user_id, drive_folder_id);
CREATE INDEX IF NOT EXISTS idx_drive_folders_user_parent ON drive_folders(user_id, parent_drive_folder_id);
