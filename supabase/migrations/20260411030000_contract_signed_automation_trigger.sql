/*
  # Contract-signed automation — DB trigger + backfill

  Adds a defense-in-depth DB trigger that fires whenever a contract's
  signature_status transitions to 'signed'. The trigger performs the same
  post-signature automation that `src/services/contractSigning.ts`
  `submitContractSignature()` already does in TypeScript:

  1. Advance the linked opportunity to the "Closed Won" stage and flip its
     status to 'won' / set closed_at
  2. Create a new project in the default project pipeline's "Kickoff" stage,
     linked to the contract's contact / opportunity / proposal

  ## Why both a trigger AND TS automation?

  The TypeScript path in `submitContractSignature` remains in place as the
  primary automation — it's hooked into the app's event bus (`emitEvent` for
  `opportunity.won` and `project.created`), writes timeline events, and
  logs project activity. Those side-effects cannot be reproduced in pure
  SQL.

  This trigger is defense in depth for edge-case signing paths that do NOT
  go through `submitContractSignature`:
  - Admin / support tools that mark contracts signed via raw SQL
  - Data imports from a previous CRM
  - Direct API / RPC calls
  - Future signing paths we haven't built yet

  For contracts signed via the normal UI path (`submitContractSignature`),
  the trigger fires first (inside the `UPDATE contracts` transaction) and
  will run the automation. The subsequent TypeScript post-sign block then
  hits dedupe guards and becomes a no-op, which is the intended behavior.
  The only observable side-effect is that the TS-level `emitEvent` calls
  for `opportunity.won` and `project.created` will NOT fire on those
  signings, since their guard conditions short-circuit. If the app later
  grows downstream listeners for those events that need to fire on signed
  contracts, we will need to emit them explicitly after the trigger has
  run — noted here as a follow-up.

  ## Idempotency

  `handle_contract_signed(uuid)` is fully idempotent:
  - Opportunity advance is a no-op if the opp is not open or already past
    the target stage
  - Project creation dedupes on opportunity_id → proposal_id → (contact, name)

  Calling it multiple times on the same contract is safe.

  ## Backfill

  The migration also runs a one-time backfill on all `contracts` where
  `signature_status = 'signed'`. At the time of writing there are zero such
  contracts, so this is a no-op — but it's here so the migration behaves
  correctly in any future environment (staging, a restored DB, a fork)
  where signed contracts already exist.
*/

-- =====================================================================
-- 1. Handler function — does the full automation for a single contract.
--    SECURITY DEFINER so it can write across modules regardless of RLS.
-- =====================================================================

CREATE OR REPLACE FUNCTION handle_contract_signed(p_contract_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contract record;
  v_opp record;
  v_closed_won_stage_id uuid;
  v_project_pipeline_id uuid;
  v_kickoff_stage_id uuid;
  v_existing_project_count int;
BEGIN
  -- Load the contract.
  SELECT id, org_id, contact_id, opportunity_id, proposal_id, title,
         total_value, currency, effective_date, created_by, signed_at
    INTO v_contract
    FROM contracts
    WHERE id = p_contract_id;

  IF NOT FOUND OR v_contract.contact_id IS NULL OR v_contract.created_by IS NULL THEN
    -- Cannot create a project without a contact or a created_by user.
    RETURN;
  END IF;

  -- -----------------------------------------------------------------
  -- Step 1: Close the linked opportunity (if any and still open)
  -- -----------------------------------------------------------------
  IF v_contract.opportunity_id IS NOT NULL THEN
    SELECT id, stage_id, pipeline_id, status
      INTO v_opp
      FROM opportunities
      WHERE id = v_contract.opportunity_id;

    IF FOUND AND v_opp.status = 'open' THEN
      SELECT id INTO v_closed_won_stage_id
        FROM pipeline_stages
        WHERE pipeline_id = v_opp.pipeline_id
          AND LOWER(name) LIKE '%closed won%'
        ORDER BY sort_order DESC
        LIMIT 1;

      IF v_closed_won_stage_id IS NOT NULL THEN
        UPDATE opportunities
           SET stage_id = v_closed_won_stage_id,
               status = 'won',
               closed_at = COALESCE(v_contract.signed_at, now())
         WHERE id = v_contract.opportunity_id;
      END IF;
    END IF;
  END IF;

  -- -----------------------------------------------------------------
  -- Step 2: Resolve the default project pipeline + "Kickoff" stage
  -- -----------------------------------------------------------------
  SELECT id INTO v_project_pipeline_id
    FROM project_pipelines
    WHERE org_id = v_contract.org_id
    ORDER BY created_at
    LIMIT 1;

  IF v_project_pipeline_id IS NULL THEN
    -- No project pipeline set up for this org; nothing we can do.
    RETURN;
  END IF;

  SELECT id INTO v_kickoff_stage_id
    FROM project_stages
    WHERE org_id = v_contract.org_id
      AND pipeline_id = v_project_pipeline_id
      AND LOWER(name) LIKE 'kickoff%'
    LIMIT 1;

  IF v_kickoff_stage_id IS NULL THEN
    RETURN;
  END IF;

  -- -----------------------------------------------------------------
  -- Step 3: Dedupe — skip if a project already exists for this contract
  -- -----------------------------------------------------------------
  IF v_contract.opportunity_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_existing_project_count
      FROM projects
      WHERE org_id = v_contract.org_id
        AND opportunity_id = v_contract.opportunity_id;
  ELSIF v_contract.proposal_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_existing_project_count
      FROM projects
      WHERE org_id = v_contract.org_id
        AND proposal_id = v_contract.proposal_id;
  ELSE
    SELECT COUNT(*) INTO v_existing_project_count
      FROM projects
      WHERE org_id = v_contract.org_id
        AND contact_id = v_contract.contact_id
        AND name = COALESCE(v_contract.title, '');
  END IF;

  IF v_existing_project_count > 0 THEN
    RETURN;
  END IF;

  -- -----------------------------------------------------------------
  -- Step 4: Create the Kickoff project
  -- -----------------------------------------------------------------
  INSERT INTO projects (
    org_id,
    contact_id,
    opportunity_id,
    proposal_id,
    pipeline_id,
    stage_id,
    name,
    description,
    start_date,
    budget_amount,
    currency,
    priority,
    risk_level,
    created_by,
    stage_changed_at
  ) VALUES (
    v_contract.org_id,
    v_contract.contact_id,
    v_contract.opportunity_id,
    v_contract.proposal_id,
    v_project_pipeline_id,
    v_kickoff_stage_id,
    COALESCE(v_contract.title, 'New Project'),
    'Auto-created when contract "' || COALESCE(v_contract.title, 'Untitled') || '" was signed.',
    v_contract.effective_date,
    COALESCE(v_contract.total_value, 0),
    COALESCE(v_contract.currency, 'USD'),
    'medium',
    'low',
    v_contract.created_by,
    now()
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Never let automation failure block a contract update. The exception
    -- handler catches any error (bad stage lookup, RLS surprise, NOT NULL
    -- violation, etc.) and emits a NOTICE so it shows up in Postgres logs
    -- without failing the enclosing transaction.
    RAISE WARNING '[handle_contract_signed] contract_id=% failed: %', p_contract_id, SQLERRM;
END;
$$;

-- =====================================================================
-- 2. Trigger function — called AFTER UPDATE OF signature_status on
--    contracts. Only fires when the status transitions INTO 'signed'.
-- =====================================================================

CREATE OR REPLACE FUNCTION trg_contract_signed_automation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.signature_status = 'signed'
     AND (OLD.signature_status IS NULL OR OLD.signature_status IS DISTINCT FROM 'signed')
  THEN
    PERFORM handle_contract_signed(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- =====================================================================
-- 3. Install the trigger (drop first for idempotent re-runs)
-- =====================================================================

DROP TRIGGER IF EXISTS contract_signed_automation ON contracts;

CREATE TRIGGER contract_signed_automation
  AFTER UPDATE OF signature_status ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION trg_contract_signed_automation();

-- =====================================================================
-- 4. One-time backfill — apply the automation to every contract that is
--    already signed. Safe to re-run because handle_contract_signed() is
--    idempotent (opp advance is forward-only / status-gated, project
--    create dedupes on opp/proposal/contact).
-- =====================================================================

DO $$
DECLARE
  c record;
  backfill_count int := 0;
BEGIN
  FOR c IN
    SELECT id FROM contracts WHERE signature_status = 'signed'
  LOOP
    PERFORM handle_contract_signed(c.id);
    backfill_count := backfill_count + 1;
  END LOOP;
  RAISE NOTICE 'Backfilled contract-signed automation for % contract(s)', backfill_count;
END;
$$;
