/*
  # Drop legacy "Anyone can view feature flags" policy

  ## Why

  The previous hotfix (`20260507060000_scope_feature_flag_select_to_active_org`)
  added a restrictive SELECT policy that scopes feature_flags reads to
  globals + the user's active org. But a legacy policy
  `"Anyone can view feature flags"` with `USING (true)` was still on
  the table — and Postgres OR-combines all SELECT policies, so the
  legacy permissive policy defeated the new restrictive one.

  Visible symptom: SuperAdmin in Autom8ion Lab still saw BuilderLync's
  per-org `projects=false` row, and the OLD frontend's `flags.find()`
  picked it non-deterministically — making Projects appear disabled.

  ## Fix

  Drop the legacy policy. The new restrictive SELECT policy now
  exclusively governs reads.

  ## After

  - Autom8ionlab user (incl. SuperAdmin in autom8ionlab context):
    sees only globals → Projects, Proposals, Contracts visible.
  - BuilderLync user (or SuperAdmin switched to BuilderLync):
    sees globals + BuilderLync's per-org overrides → modules hidden.
*/

DROP POLICY IF EXISTS "Anyone can view feature flags" ON feature_flags;
