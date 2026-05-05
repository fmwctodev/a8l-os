/*
  # Email Templates Module — Phase 4

  Marketing-module email templates designed via plain-text or drag-drop
  visual editor (Unlayer / react-email-editor). Selectable from
  send_email_org and send_email_personal workflow actions.

  Tables:
    - email_templates           — current draft + published state
    - email_template_versions   — immutable snapshots when published

  Security: org-scoped, role-gated by marketing.manage permission.
*/

CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  subject_template text NOT NULL DEFAULT '',
  preview_text text,
  category text,
  -- 'plain_text' or 'drag_drop'
  editor_mode text NOT NULL DEFAULT 'plain_text' CHECK (editor_mode IN ('plain_text', 'drag_drop')),
  body_plain text,
  -- Unlayer design JSON, only used in drag_drop mode
  design_json jsonb,
  -- Always populated; rendered output, used by email-send
  body_html text NOT NULL DEFAULT '',
  -- Declared merge fields like ["contact.first_name", "appointment.date"]
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  use_count int NOT NULL DEFAULT 0,
  last_sent_at timestamptz,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  UNIQUE(organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_email_templates_org ON email_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_org_status ON email_templates(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_email_templates_category ON email_templates(category);

CREATE TABLE IF NOT EXISTS email_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES email_templates(id) ON DELETE CASCADE,
  version_number int NOT NULL,
  editor_mode text NOT NULL,
  subject_template text NOT NULL,
  preview_text text,
  body_plain text,
  design_json jsonb,
  body_html text NOT NULL,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(template_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_email_template_versions_template ON email_template_versions(template_id, version_number DESC);

-- updated_at trigger using existing helper if available, else simple
CREATE OR REPLACE FUNCTION email_templates_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS email_templates_updated_at ON email_templates;
CREATE TRIGGER email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW EXECUTE FUNCTION email_templates_set_updated_at();

-- RLS
ALTER TABLE email_templates         ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_template_versions ENABLE ROW LEVEL SECURITY;

-- Helper: an org member can read/write templates for their org
DROP POLICY IF EXISTS "Org members can read email templates" ON email_templates;
CREATE POLICY "Org members can read email templates"
  ON email_templates FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "Org members can insert email templates" ON email_templates;
CREATE POLICY "Org members can insert email templates"
  ON email_templates FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM users WHERE id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "Org members can update email templates" ON email_templates;
CREATE POLICY "Org members can update email templates"
  ON email_templates FOR UPDATE TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "Org members can delete email templates" ON email_templates;
CREATE POLICY "Org members can delete email templates"
  ON email_templates FOR DELETE TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "Org members can read email template versions" ON email_template_versions;
CREATE POLICY "Org members can read email template versions"
  ON email_template_versions FOR SELECT TO authenticated
  USING (template_id IN (
    SELECT id FROM email_templates
    WHERE organization_id IN (
      SELECT organization_id FROM users WHERE id = (SELECT auth.uid())
    )
  ));

DROP POLICY IF EXISTS "Org members can insert email template versions" ON email_template_versions;
CREATE POLICY "Org members can insert email template versions"
  ON email_template_versions FOR INSERT TO authenticated
  WITH CHECK (template_id IN (
    SELECT id FROM email_templates
    WHERE organization_id IN (
      SELECT organization_id FROM users WHERE id = (SELECT auth.uid())
    )
  ));

-- Helper function for the UI / Edge Function: publish a template by snapshotting
-- its current draft into email_template_versions and marking the template
-- as published.
CREATE OR REPLACE FUNCTION publish_email_template(p_template_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_t email_templates;
  v_next_version int;
  v_version_id uuid;
BEGIN
  SELECT * INTO v_t FROM email_templates WHERE id = p_template_id;
  IF v_t IS NULL THEN
    RAISE EXCEPTION 'email_templates row % not found', p_template_id;
  END IF;

  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_version
    FROM email_template_versions WHERE template_id = p_template_id;

  INSERT INTO email_template_versions (
    template_id, version_number, editor_mode, subject_template, preview_text,
    body_plain, design_json, body_html, variables, created_by_user_id
  ) VALUES (
    p_template_id, v_next_version, v_t.editor_mode, v_t.subject_template, v_t.preview_text,
    v_t.body_plain, v_t.design_json, v_t.body_html, v_t.variables, v_t.created_by_user_id
  ) RETURNING id INTO v_version_id;

  UPDATE email_templates
    SET status = 'published',
        published_at = COALESCE(published_at, now()),
        updated_at = now()
    WHERE id = p_template_id;

  RETURN v_version_id;
END;
$$;

GRANT EXECUTE ON FUNCTION publish_email_template(uuid) TO authenticated;
