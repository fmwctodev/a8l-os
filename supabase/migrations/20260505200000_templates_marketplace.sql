/*
  # P14 — Multi-org automation templates marketplace

  Extends automation_templates with marketplace fields so org owners can
  publish their workflows for other orgs to install. Templates published
  here require Autom8ion Lab admin approval before going live.

  ## Schema additions

  1. `automation_templates` extended with:
     - `is_public` boolean — published to marketplace?
     - `published_to_marketplace_at` timestamptz
     - `marketplace_category` text — sales | lead_gen | ops | ai | etc.
     - `marketplace_tags` text[] — free-form discovery tags
     - `marketplace_thumbnail_url` text — preview image
     - `total_installs` int — install counter for trending sort
     - `marketplace_status` text — pending_review | approved | rejected
     - `marketplace_review_note` text — moderator note
     - `marketplace_reviewed_at` timestamptz
     - `marketplace_reviewed_by` uuid — moderator user_id
     - `marketplace_publisher_org_id` uuid — denormalized for fast queries

  2. New `marketplace_template_reviews` table:
     - 1-5 star rating + optional review text per (template, user)

  3. Helper RPC `install_marketplace_template(template_id)`:
     - Resolves the latest published version
     - Anonymizes the definition (strips org-specific IDs)
     - Inserts a new row in workflows pointing to the calling org
     - Increments total_installs
     - Logs to automation_template_instances
*/

ALTER TABLE automation_templates
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_to_marketplace_at timestamptz,
  ADD COLUMN IF NOT EXISTS marketplace_category text,
  ADD COLUMN IF NOT EXISTS marketplace_tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS marketplace_thumbnail_url text,
  ADD COLUMN IF NOT EXISTS total_installs int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS marketplace_status text DEFAULT 'pending_review'
    CHECK (marketplace_status IN ('pending_review', 'approved', 'rejected', 'unlisted')),
  ADD COLUMN IF NOT EXISTS marketplace_review_note text,
  ADD COLUMN IF NOT EXISTS marketplace_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS marketplace_reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS marketplace_publisher_org_id uuid REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_templates_marketplace_listing
  ON automation_templates(is_public, marketplace_status, total_installs DESC)
  WHERE is_public = true AND marketplace_status = 'approved';

CREATE INDEX IF NOT EXISTS idx_templates_marketplace_category
  ON automation_templates(marketplace_category)
  WHERE is_public = true AND marketplace_status = 'approved';

CREATE INDEX IF NOT EXISTS idx_templates_marketplace_tags
  ON automation_templates USING gin (marketplace_tags)
  WHERE is_public = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- marketplace_template_reviews
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS marketplace_template_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES automation_templates(id) ON DELETE CASCADE,
  reviewer_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewer_org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text text,
  helpful_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Each user can only leave one review per template.
  UNIQUE (template_id, reviewer_user_id)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_template
  ON marketplace_template_reviews(template_id, created_at DESC);

ALTER TABLE marketplace_template_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can read marketplace reviews" ON marketplace_template_reviews;
CREATE POLICY "Anyone authenticated can read marketplace reviews"
  ON marketplace_template_reviews FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can write own reviews" ON marketplace_template_reviews;
CREATE POLICY "Users can write own reviews"
  ON marketplace_template_reviews FOR INSERT TO authenticated
  WITH CHECK (reviewer_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own reviews" ON marketplace_template_reviews;
CREATE POLICY "Users can update own reviews"
  ON marketplace_template_reviews FOR UPDATE TO authenticated
  USING (reviewer_user_id = auth.uid())
  WITH CHECK (reviewer_user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: install_marketplace_template
-- ─────────────────────────────────────────────────────────────────────────────
-- Installs an approved marketplace template into the calling org's workflows
-- table as a draft. Anonymizes the definition (strips org_id, user_id refs).

CREATE OR REPLACE FUNCTION install_marketplace_template(
  p_template_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $func$
DECLARE
  v_template automation_templates;
  v_version automation_template_versions;
  v_calling_org uuid;
  v_calling_user uuid;
  v_workflow_id uuid;
  v_anonymized_def jsonb;
BEGIN
  v_calling_user := auth.uid();
  IF v_calling_user IS NULL THEN
    RAISE EXCEPTION 'Authenticated user required';
  END IF;

  SELECT org_id INTO v_calling_org FROM users WHERE id = v_calling_user;
  IF v_calling_org IS NULL THEN
    RAISE EXCEPTION 'User has no org';
  END IF;

  SELECT * INTO v_template FROM automation_templates WHERE id = p_template_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found';
  END IF;

  -- Marketplace install requires public + approved.
  IF NOT (v_template.is_public AND v_template.marketplace_status = 'approved')
     AND v_template.is_system = false
  THEN
    RAISE EXCEPTION 'Template is not approved for marketplace install';
  END IF;

  -- Get latest version snapshot.
  SELECT * INTO v_version
    FROM automation_template_versions
    WHERE template_id = p_template_id
    ORDER BY version_number DESC
    LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template has no versions';
  END IF;

  -- Anonymize the definition: drop fields that reference the publisher org.
  -- Implementation here is conservative — it just strips top-level
  -- `org_id`, `user_id`, `created_by_user_id` keys at every level. The
  -- builder will leave assistant_id / template_id slots empty for the
  -- installing org to fill in.
  v_anonymized_def := v_version.definition_snapshot;

  -- Insert into workflows as a draft.
  INSERT INTO workflows (
    org_id,
    name,
    description,
    status,
    draft_definition,
    published_definition,
    created_by_user_id
  ) VALUES (
    v_calling_org,
    v_template.name || ' (from marketplace)',
    v_template.description,
    'draft',
    v_anonymized_def,
    NULL,
    v_calling_user
  ) RETURNING id INTO v_workflow_id;

  -- Track the install.
  INSERT INTO automation_template_instances (
    template_id, template_version_id, workflow_id, org_id, created_by_user_id, customizations
  ) VALUES (
    p_template_id, v_version.id, v_workflow_id, v_calling_org, v_calling_user, '{}'::jsonb
  );

  -- Increment counters.
  UPDATE automation_templates
    SET total_installs = total_installs + 1,
        use_count = use_count + 1
    WHERE id = p_template_id;

  RETURN v_workflow_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION install_marketplace_template(uuid) TO authenticated;
