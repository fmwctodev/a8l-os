/*
  # tracked_links

  A small URL-shortener / click-tracker used by the `trigger_link_clicked`
  workflow trigger. When a contact (or anyone) hits the `link-redirect`
  edge function, we record a click row and emit an event_outbox event so
  any workflow listening on `trigger_link_clicked` fires.

  Columns:
  - `slug`             — short token used in the redirect URL
  - `destination_url`  — where to send the user
  - `name`             — human-readable label shown in builder UI
  - `contact_id`       — optional; if known, click is attributed to this contact
  - `metadata`         — anything the producer wants to attach
  - `click_count`      — total clicks recorded
  - `last_clicked_at`  — denormalized for quick "last seen" reads

  We also create `tracked_link_clicks` as the immutable click log, so
  reporting/analytics can group by referrer, IP, ua etc. without bloating
  the parent row.
*/

CREATE TABLE IF NOT EXISTS tracked_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  slug            TEXT NOT NULL UNIQUE,
  destination_url TEXT NOT NULL,
  name            TEXT,
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  workflow_id     UUID REFERENCES workflows(id) ON DELETE SET NULL,
  metadata        JSONB DEFAULT '{}'::jsonb,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  expires_at      TIMESTAMPTZ,
  click_count     INTEGER NOT NULL DEFAULT 0,
  last_clicked_at TIMESTAMPTZ,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tracked_links_org_id   ON tracked_links(org_id);
CREATE INDEX IF NOT EXISTS idx_tracked_links_slug     ON tracked_links(slug);
CREATE INDEX IF NOT EXISTS idx_tracked_links_contact  ON tracked_links(contact_id);
CREATE INDEX IF NOT EXISTS idx_tracked_links_workflow ON tracked_links(workflow_id);

CREATE TABLE IF NOT EXISTS tracked_link_clicks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tracked_link_id UUID NOT NULL REFERENCES tracked_links(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  ip_address      TEXT,
  user_agent      TEXT,
  referrer        TEXT,
  query_params    JSONB,
  clicked_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tracked_link_clicks_link    ON tracked_link_clicks(tracked_link_id, clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracked_link_clicks_contact ON tracked_link_clicks(contact_id, clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracked_link_clicks_org     ON tracked_link_clicks(org_id, clicked_at DESC);

ALTER TABLE tracked_links       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracked_link_clicks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tracked_links_org_select" ON tracked_links;
CREATE POLICY "tracked_links_org_select" ON tracked_links
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "tracked_links_org_insert" ON tracked_links;
CREATE POLICY "tracked_links_org_insert" ON tracked_links
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "tracked_links_org_update" ON tracked_links;
CREATE POLICY "tracked_links_org_update" ON tracked_links
  FOR UPDATE TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()))
  WITH CHECK (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "tracked_links_org_delete" ON tracked_links;
CREATE POLICY "tracked_links_org_delete" ON tracked_links
  FOR DELETE TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "tracked_link_clicks_org_select" ON tracked_link_clicks;
CREATE POLICY "tracked_link_clicks_org_select" ON tracked_link_clicks
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_tracked_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tracked_links_updated_at ON tracked_links;
CREATE TRIGGER tracked_links_updated_at
  BEFORE UPDATE ON tracked_links
  FOR EACH ROW EXECUTE FUNCTION update_tracked_links_updated_at();
