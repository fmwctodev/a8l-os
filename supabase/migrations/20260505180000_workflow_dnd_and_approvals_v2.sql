/*
  # P7 — DND suppression audit + best-practice approval queue extensions

  ## What this migration does

  1. **`workflow_dnd_suppressions`** (new) — every time a send_sms / send_email_*
     / start_ai_call / send_ai_voicemail action is suppressed because the
     contact has DND set on that channel, log a row here so audits can prove
     "we did not contact this contact through this channel."

  2. **`workflow_approval_queue`** (extend) — add best-practice columns:
     - `expires_at` — auto-expire stale approval items
     - `expiration_branch` — what to do on expire ('approve' | 'reject' | 'escalate')
     - `approver_routing` — jsonb: who to assign to (role, user_id, contact_owner, round_robin)
     - `approver_user_ids` — array of users assigned to approve
     - `approval_mode` — 'any_one' | 'all_of' | 'majority'
     - `approvals_required` — int (for 'all_of' / 'majority')
     - `approval_decisions` — jsonb array: [{user_id, decision, comment, at}]
     - `magic_link_token_hash` — sha256 of the signed token used for
       approve-from-email (one-click)
     - `magic_link_expires_at` — separate expiry for the magic link
     - `last_reminder_sent_at` — for the 24h ping cron

  3. **`approval_decisions`** (new) — append-only audit log of every individual
     decision so we can support multi-approver / "all of N" / "majority" modes
     and have a full history per request.

  All new columns are nullable / have defaults so existing rows continue to work.
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. workflow_dnd_suppressions
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workflow_dnd_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  enrollment_id uuid REFERENCES workflow_enrollments(id) ON DELETE SET NULL,
  workflow_id uuid REFERENCES workflows(id) ON DELETE SET NULL,
  node_id text,
  action_type text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('sms', 'email', 'voice', 'all')),
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  reason text NOT NULL,
  -- Snapshot of relevant context for the audit trail.
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  suppressed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dnd_suppressions_org_time
  ON workflow_dnd_suppressions(org_id, suppressed_at DESC);
CREATE INDEX IF NOT EXISTS idx_dnd_suppressions_contact
  ON workflow_dnd_suppressions(contact_id);
CREATE INDEX IF NOT EXISTS idx_dnd_suppressions_workflow
  ON workflow_dnd_suppressions(workflow_id);

ALTER TABLE workflow_dnd_suppressions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members view dnd suppressions" ON workflow_dnd_suppressions;
CREATE POLICY "Org members view dnd suppressions"
  ON workflow_dnd_suppressions FOR SELECT TO authenticated
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- workflow-processor (service role) inserts directly, no INSERT policy needed.

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Extend workflow_approval_queue with best-practice columns
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE workflow_approval_queue
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS expiration_branch text DEFAULT 'reject'
    CHECK (expiration_branch IN ('approve', 'reject', 'escalate')),
  ADD COLUMN IF NOT EXISTS approver_routing jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS approver_user_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  ADD COLUMN IF NOT EXISTS approval_mode text NOT NULL DEFAULT 'any_one'
    CHECK (approval_mode IN ('any_one', 'all_of', 'majority')),
  ADD COLUMN IF NOT EXISTS approvals_required int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS approval_decisions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS magic_link_token_hash text,
  ADD COLUMN IF NOT EXISTS magic_link_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text;

-- Allow 'expired' as a status for auto-expired approvals (extends existing CHECK).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'workflow_approval_queue'
      AND constraint_name = 'workflow_approval_queue_status_check'
  ) THEN
    ALTER TABLE workflow_approval_queue
      DROP CONSTRAINT workflow_approval_queue_status_check;
  END IF;
END $$;

ALTER TABLE workflow_approval_queue
  ADD CONSTRAINT workflow_approval_queue_status_check
  CHECK (status IN ('pending_approval', 'approved', 'rejected', 'expired', 'escalated'));

CREATE INDEX IF NOT EXISTS idx_approval_queue_expires_at
  ON workflow_approval_queue(expires_at)
  WHERE status = 'pending_approval' AND expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_approval_queue_magic_link
  ON workflow_approval_queue(magic_link_token_hash)
  WHERE magic_link_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_approval_queue_approver_users
  ON workflow_approval_queue USING gin (approver_user_ids)
  WHERE status = 'pending_approval';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. approval_decisions — append-only audit log
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workflow_approval_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id uuid NOT NULL REFERENCES workflow_approval_queue(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  decided_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  -- Anonymous (magic-link) decisions store the email here instead.
  decided_by_email text,
  decision text NOT NULL CHECK (decision IN ('approve', 'reject', 'escalate', 'reminder_sent')),
  comment text,
  via_magic_link boolean NOT NULL DEFAULT false,
  ip_address text,
  user_agent text,
  decided_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_decisions_approval
  ON workflow_approval_decisions(approval_id, decided_at DESC);
CREATE INDEX IF NOT EXISTS idx_approval_decisions_org_time
  ON workflow_approval_decisions(org_id, decided_at DESC);

ALTER TABLE workflow_approval_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members view approval decisions" ON workflow_approval_decisions;
CREATE POLICY "Org members view approval decisions"
  ON workflow_approval_decisions FOR SELECT TO authenticated
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Helper RPC: resolve_approval_decision
-- ─────────────────────────────────────────────────────────────────────────────
-- Atomically records a decision, updates approval_decisions[], and (if
-- approvals_required is met) flips the queue row to approved/rejected.
-- Called from the AutomationApprovals UI and from approval-magic-link.

CREATE OR REPLACE FUNCTION resolve_approval_decision(
  p_approval_id uuid,
  p_decision text,
  p_user_id uuid,
  p_email text,
  p_comment text,
  p_via_magic_link boolean,
  p_ip text,
  p_ua text
) RETURNS workflow_approval_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_row workflow_approval_queue;
  v_approve_count int;
  v_reject_count int;
  v_required int;
  v_decisions jsonb;
  v_new_status text;
BEGIN
  SELECT * INTO v_row FROM workflow_approval_queue WHERE id = p_approval_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approval queue row not found';
  END IF;

  IF v_row.status NOT IN ('pending_approval') THEN
    RAISE EXCEPTION 'Approval already resolved (status=%)', v_row.status;
  END IF;

  -- Authorization: must be in approver_user_ids OR magic-link path.
  IF NOT p_via_magic_link AND p_user_id IS NOT NULL
     AND v_row.approver_user_ids IS NOT NULL
     AND array_length(v_row.approver_user_ids, 1) > 0
     AND NOT (p_user_id = ANY (v_row.approver_user_ids))
  THEN
    RAISE EXCEPTION 'User % not authorized to decide on this approval', p_user_id;
  END IF;

  -- Append the decision to the audit log.
  INSERT INTO workflow_approval_decisions (
    approval_id, org_id, decided_by_user_id, decided_by_email, decision,
    comment, via_magic_link, ip_address, user_agent
  ) VALUES (
    p_approval_id, v_row.org_id, p_user_id, p_email, p_decision,
    p_comment, p_via_magic_link, p_ip, p_ua
  );

  -- Update inline JSONB array on the queue row.
  v_decisions := COALESCE(v_row.approval_decisions, '[]'::jsonb)
    || jsonb_build_array(jsonb_build_object(
        'user_id', p_user_id, 'email', p_email, 'decision', p_decision,
        'comment', p_comment, 'via_magic_link', p_via_magic_link,
        'at', now()
      ));

  -- Determine if we have enough decisions to resolve.
  v_approve_count := (
    SELECT count(*) FROM jsonb_array_elements(v_decisions) d
    WHERE d->>'decision' = 'approve'
  );
  v_reject_count := (
    SELECT count(*) FROM jsonb_array_elements(v_decisions) d
    WHERE d->>'decision' = 'reject'
  );

  v_required := COALESCE(v_row.approvals_required, 1);
  v_new_status := 'pending_approval';

  IF v_row.approval_mode = 'any_one' THEN
    IF v_approve_count >= 1 THEN
      v_new_status := 'approved';
    ELSIF v_reject_count >= 1 THEN
      v_new_status := 'rejected';
    END IF;
  ELSIF v_row.approval_mode = 'all_of' THEN
    IF v_reject_count >= 1 THEN
      v_new_status := 'rejected';  -- one reject kills the gate
    ELSIF v_approve_count >= COALESCE(array_length(v_row.approver_user_ids, 1), v_required) THEN
      v_new_status := 'approved';
    END IF;
  ELSIF v_row.approval_mode = 'majority' THEN
    IF v_approve_count > COALESCE(array_length(v_row.approver_user_ids, 1), v_required) / 2 THEN
      v_new_status := 'approved';
    ELSIF v_reject_count > COALESCE(array_length(v_row.approver_user_ids, 1), v_required) / 2 THEN
      v_new_status := 'rejected';
    END IF;
  END IF;

  IF p_decision = 'escalate' THEN
    v_new_status := 'escalated';
  END IF;

  UPDATE workflow_approval_queue
    SET approval_decisions = v_decisions,
        status = v_new_status,
        resolved_at = CASE WHEN v_new_status <> 'pending_approval' THEN now() ELSE NULL END,
        resolved_by_user_id = CASE WHEN v_new_status <> 'pending_approval' AND p_user_id IS NOT NULL THEN p_user_id ELSE resolved_by_user_id END,
        resolution_note = CASE WHEN v_new_status <> 'pending_approval' THEN p_comment ELSE resolution_note END,
        updated_at = now()
    WHERE id = p_approval_id
    RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION resolve_approval_decision(uuid, text, uuid, text, text, boolean, text, text) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Helper RPC: expire_stale_approvals
-- ─────────────────────────────────────────────────────────────────────────────
-- Called by the approval-reminder-cron Edge Function. Walks every
-- pending row whose expires_at has passed and applies its
-- expiration_branch ('approve' | 'reject' | 'escalate').

CREATE OR REPLACE FUNCTION expire_stale_approvals()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_count int := 0;
  v_row record;
  v_status text;
BEGIN
  FOR v_row IN
    SELECT id, expiration_branch
    FROM workflow_approval_queue
    WHERE status = 'pending_approval'
      AND expires_at IS NOT NULL
      AND expires_at < now()
    FOR UPDATE SKIP LOCKED
  LOOP
    v_status := CASE v_row.expiration_branch
      WHEN 'approve' THEN 'approved'
      WHEN 'reject' THEN 'rejected'
      WHEN 'escalate' THEN 'escalated'
      ELSE 'expired'
    END;
    UPDATE workflow_approval_queue
      SET status = v_status,
          resolved_at = now(),
          resolution_note = COALESCE(resolution_note, 'Auto-expired by system'),
          updated_at = now()
      WHERE id = v_row.id;

    INSERT INTO workflow_approval_decisions (
      approval_id, org_id, decision, comment
    )
    SELECT id, org_id, v_row.expiration_branch, 'Auto-expired (TTL reached)'
    FROM workflow_approval_queue WHERE id = v_row.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION expire_stale_approvals() TO service_role;
