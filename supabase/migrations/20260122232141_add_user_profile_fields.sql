/*
  # Add User Profile Fields

  1. Changes
    - Add `phone` field to users table for contact information
    - Add `timezone` field for user's preferred timezone
    - Add `title` field for job title/role description
    - Add `email_signature` field for custom email signatures
    - Add `profile_photo` field for profile image URL
    - Add `mfa_enabled` boolean for multi-factor authentication status
    - Add `mfa_method` field for MFA method preference (totp, sms, email)
    
  2. Security
    - All fields are nullable to allow gradual profile completion
    - Fields can be updated by the user through RLS policies (created separately)
*/

DO $$
BEGIN
  -- Add phone field if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'phone'
  ) THEN
    ALTER TABLE users ADD COLUMN phone text;
  END IF;

  -- Add timezone field if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'timezone'
  ) THEN
    ALTER TABLE users ADD COLUMN timezone text DEFAULT 'America/New_York';
  END IF;

  -- Add title field if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'title'
  ) THEN
    ALTER TABLE users ADD COLUMN title text;
  END IF;

  -- Add email_signature field if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'email_signature'
  ) THEN
    ALTER TABLE users ADD COLUMN email_signature text;
  END IF;

  -- Add profile_photo field if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'profile_photo'
  ) THEN
    ALTER TABLE users ADD COLUMN profile_photo text;
  END IF;

  -- Add mfa_enabled field if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'mfa_enabled'
  ) THEN
    ALTER TABLE users ADD COLUMN mfa_enabled boolean DEFAULT false;
  END IF;

  -- Add mfa_method field if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'mfa_method'
  ) THEN
    ALTER TABLE users ADD COLUMN mfa_method text;
  END IF;
END $$;