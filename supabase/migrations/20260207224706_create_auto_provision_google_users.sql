/*
  # Auto-provision public.users row for new Google OAuth sign-ins

  1. New Function
    - `handle_new_auth_user()` -- trigger function on auth.users
      - Creates a row in public.users when a new auth user is inserted
      - Extracts name and avatar from Google metadata
      - Assigns the Admin role (3b9b6139-fd2b-4f9a-89e0-da4e6d7ffb29)
      - Assigns the default organization (00000000-0000-0000-0000-000000000001)
      - Uses ON CONFLICT DO NOTHING so manually-provisioned users are never overwritten

  2. New Trigger
    - `on_auth_user_created` fires AFTER INSERT on auth.users

  3. Important Notes
    - Only users who do NOT already exist in public.users are created
    - The Admin role gives full org management without SuperAdmin privileges
    - Google populates raw_user_meta_data with full_name and avatar_url
*/

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (
    id,
    organization_id,
    role_id,
    email,
    name,
    avatar_url,
    status,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    '00000000-0000-0000-0000-000000000001',
    '3b9b6139-fd2b-4f9a-89e0-da4e6d7ffb29',
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    'active',
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_auth_user();
  END IF;
END $$;
