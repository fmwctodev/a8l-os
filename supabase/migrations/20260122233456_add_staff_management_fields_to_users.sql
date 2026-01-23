/*
  # Add Staff Management Fields to Users Table

  1. Changes
    - Add `invited_by` (uuid) - References the user who sent the invite
    - Add `disabled_at` (timestamptz) - When the user was disabled
    - Add `disabled_by` (uuid) - References the user who disabled this user
    - Update status check constraint to include 'invited' and 'disabled' statuses

  2. Security
    - Foreign key constraints reference users table
    - Nullable fields to support existing users

  3. Notes
    - Existing users with 'pending' status represent invited users
    - We normalize status to use 'invited' for clarity going forward
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'invited_by'
  ) THEN
    ALTER TABLE public.users ADD COLUMN invited_by uuid REFERENCES public.users(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'disabled_at'
  ) THEN
    ALTER TABLE public.users ADD COLUMN disabled_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'disabled_by'
  ) THEN
    ALTER TABLE public.users ADD COLUMN disabled_by uuid REFERENCES public.users(id);
  END IF;
END $$;

ALTER TABLE public.users 
  DROP CONSTRAINT IF EXISTS users_status_check;

ALTER TABLE public.users 
  ADD CONSTRAINT users_status_check 
  CHECK (status IN ('active', 'inactive', 'pending', 'invited', 'disabled'));

UPDATE public.users 
SET status = 'invited' 
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);
CREATE INDEX IF NOT EXISTS idx_users_invited_by ON public.users(invited_by);
CREATE INDEX IF NOT EXISTS idx_users_disabled_by ON public.users(disabled_by);
