/*
  # Create RLS Policies for User Profile Tables

  1. Policies for `users` table (profile fields)
    - Users can view their own profile
    - Users can update their own profile fields
    
  2. Policies for `user_preferences` table
    - Users can view their own preferences
    - Users can insert their own preferences
    - Users can update their own preferences
    
  3. Policies for `user_notification_preferences` table
    - Users can view their own notification preferences
    - Users can insert their own notification preferences
    - Users can update their own notification preferences
    - Users can delete their own notification preferences
    
  4. Policies for `user_connected_accounts` table
    - Users can view their own connected accounts
    - Users can insert their own connected accounts
    - Users can update their own connected accounts
    - Users can delete their own connected accounts

  Note: All policies restrict access to authenticated users viewing/modifying only their own data
*/

-- Users table policies for profile fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Users can view own profile data'
  ) THEN
    CREATE POLICY "Users can view own profile data"
      ON users FOR SELECT
      TO authenticated
      USING (auth.uid() = id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Users can update own profile data'
  ) THEN
    CREATE POLICY "Users can update own profile data"
      ON users FOR UPDATE
      TO authenticated
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- User preferences policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_preferences' AND policyname = 'Users can view own preferences'
  ) THEN
    CREATE POLICY "Users can view own preferences"
      ON user_preferences FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_preferences' AND policyname = 'Users can insert own preferences'
  ) THEN
    CREATE POLICY "Users can insert own preferences"
      ON user_preferences FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_preferences' AND policyname = 'Users can update own preferences'
  ) THEN
    CREATE POLICY "Users can update own preferences"
      ON user_preferences FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- User notification preferences policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_notification_preferences' AND policyname = 'Users can view own notification preferences'
  ) THEN
    CREATE POLICY "Users can view own notification preferences"
      ON user_notification_preferences FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_notification_preferences' AND policyname = 'Users can insert own notification preferences'
  ) THEN
    CREATE POLICY "Users can insert own notification preferences"
      ON user_notification_preferences FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_notification_preferences' AND policyname = 'Users can update own notification preferences'
  ) THEN
    CREATE POLICY "Users can update own notification preferences"
      ON user_notification_preferences FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_notification_preferences' AND policyname = 'Users can delete own notification preferences'
  ) THEN
    CREATE POLICY "Users can delete own notification preferences"
      ON user_notification_preferences FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- User connected accounts policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_connected_accounts' AND policyname = 'Users can view own connected accounts'
  ) THEN
    CREATE POLICY "Users can view own connected accounts"
      ON user_connected_accounts FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_connected_accounts' AND policyname = 'Users can insert own connected accounts'
  ) THEN
    CREATE POLICY "Users can insert own connected accounts"
      ON user_connected_accounts FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_connected_accounts' AND policyname = 'Users can update own connected accounts'
  ) THEN
    CREATE POLICY "Users can update own connected accounts"
      ON user_connected_accounts FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_connected_accounts' AND policyname = 'Users can delete own connected accounts'
  ) THEN
    CREATE POLICY "Users can delete own connected accounts"
      ON user_connected_accounts FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;