/*
  # Domain-Routed User Provisioning

  Replaces handle_new_auth_user() — the trigger that runs after every
  auth.users INSERT — to look up the new user's org by their email
  domain instead of hardcoding the Autom8ion Lab UUID.

  ## Behavior

  - User signs in with Google/Microsoft/email-password
  - Supabase inserts into auth.users
  - Trigger extracts domain from email (lowercased), looks up
    organization_email_domains, and:
      * If domain not found → RAISE EXCEPTION (rolls back the auth.users
        insert, the user never lands)
      * If provider not in allowed_providers for the domain →
        RAISE EXCEPTION (e.g. blocks Microsoft sign-in for builderlync.com)
      * Otherwise → INSERT into public.users with the resolved org_id

  ## Compatibility

  - ON CONFLICT (id) DO NOTHING preserves the prior behavior of never
    overwriting manually-provisioned users
  - Email/password users get provider='email' (Supabase sets this in
    raw_app_meta_data automatically)
  - Existing autom8ionlab users keep working: their domain is seeded
    in organization_email_domains in the next migration (20260507030000)
*/

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_domain text;
  resolved_org_id uuid;
  provider text;
  allowed text[];
BEGIN
  -- Extract lowercase email domain
  user_domain := lower(split_part(NEW.email, '@', 2));

  -- Supabase populates raw_app_meta_data->>'provider' with 'google',
  -- 'azure' (Microsoft), 'email', etc. Default to 'email' for safety.
  provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');

  -- Normalize 'azure' → 'microsoft' for our allowed_providers list
  IF provider = 'azure' THEN
    provider := 'microsoft';
  END IF;

  -- Look up the org for this domain
  SELECT organization_id, allowed_providers
    INTO resolved_org_id, allowed
  FROM organization_email_domains
  WHERE lower(domain) = user_domain
  LIMIT 1;

  IF resolved_org_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_DOMAIN_NOT_AUTHORIZED: Email domain "%" is not registered with any organization', user_domain
      USING ERRCODE = 'P0001', HINT = 'Contact your administrator to register this domain.';
  END IF;

  IF NOT (provider = ANY(allowed)) THEN
    RAISE EXCEPTION 'AUTH_PROVIDER_NOT_ALLOWED: Sign-in provider "%" is not allowed for domain "%"', provider, user_domain
      USING ERRCODE = 'P0001', HINT = 'Try a different sign-in method.';
  END IF;

  -- Provision the public.users row
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
    resolved_org_id,
    -- Admin role (existing)
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

-- Trigger remains the same — only the function body changed.
-- Re-create defensively in case it was dropped.
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
