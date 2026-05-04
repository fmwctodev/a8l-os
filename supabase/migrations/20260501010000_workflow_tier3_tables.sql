/*
  # Workflow Tier 3 — supporting tables for course/community access + marketing audience pushes

  Adds three small tables consumed by the Tier 3 workflow actions added in this commit:

  - `course_enrollments` — tracks which contacts have access to which course offers.
    The `grant_course_access` / `revoke_course_access` actions upsert / soft-delete here.
  - `community_members` — same idea for paid communities / groups.
  - `marketing_event_outbox` — outbox queue read by an external worker to fan out FB Custom Audience
    add/remove, FB Conversion API events, Google Ads events, and GA4 events.

  None of these existed yet. Indexes scoped to organization for RLS.
*/

CREATE TABLE IF NOT EXISTS course_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  course_id uuid NOT NULL,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  granted_via text DEFAULT 'manual',
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  UNIQUE(course_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_course_enrollments_org ON course_enrollments(org_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_contact ON course_enrollments(contact_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_active ON course_enrollments(course_id) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS community_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  community_id uuid NOT NULL,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  joined_via text DEFAULT 'manual',
  joined_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  UNIQUE(community_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_community_members_org ON community_members(org_id);
CREATE INDEX IF NOT EXISTS idx_community_members_contact ON community_members(contact_id);
CREATE INDEX IF NOT EXISTS idx_community_members_active ON community_members(community_id) WHERE removed_at IS NULL;

CREATE TABLE IF NOT EXISTS marketing_event_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  audience_id text,
  event_name text,
  event_value numeric,
  currency text,
  custom_data jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_outbox_pending ON marketing_event_outbox(status, created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_marketing_outbox_org ON marketing_event_outbox(org_id);

ALTER TABLE course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_event_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view course_enrollments" ON course_enrollments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.organization_id = course_enrollments.org_id)
);
CREATE POLICY "Org members can manage course_enrollments" ON course_enrollments FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.organization_id = course_enrollments.org_id)
);

CREATE POLICY "Org members can view community_members" ON community_members FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.organization_id = community_members.org_id)
);
CREATE POLICY "Org members can manage community_members" ON community_members FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.organization_id = community_members.org_id)
);

CREATE POLICY "Org members can view marketing_event_outbox" ON marketing_event_outbox FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.organization_id = marketing_event_outbox.org_id)
);
