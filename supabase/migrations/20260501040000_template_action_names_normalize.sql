/*
  # Normalize legacy action types in seeded automation_template_versions

  Three of our seeded system templates use action type identifiers that pre-date
  the current ACTION_OPTIONS palette. The workflow-processor accepts both, but
  the builder UI only renders the canonical names. Normalize them in-place so
  freshly instantiated workflows from these templates open cleanly in the
  builder.

  Renames applied (only inside system-template version snapshots):
    assign_owner          -> assign_contact_owner
    create_note           -> add_note
    internal_notification -> notify_user

  Existing org-level workflows that were already instantiated from these
  templates carry their own copy of the definition, so they remain on the
  legacy names and continue to execute (the processor's switch handles both).

  This migration is idempotent: it only updates rows whose nodes still
  contain at least one of the three legacy action types.
*/

UPDATE automation_template_versions
SET definition_snapshot = (
  SELECT jsonb_set(
    definition_snapshot,
    '{nodes}',
    (
      SELECT jsonb_agg(
        CASE
          WHEN n->>'type' = 'action'
               AND (n->'data'->>'actionType') IN ('assign_owner','create_note','internal_notification')
          THEN jsonb_set(
            n,
            '{data,actionType}',
            to_jsonb(
              CASE n->'data'->>'actionType'
                WHEN 'assign_owner'           THEN 'assign_contact_owner'
                WHEN 'create_note'            THEN 'add_note'
                WHEN 'internal_notification'  THEN 'notify_user'
              END
            )
          )
          ELSE n
        END
      )
      FROM jsonb_array_elements(definition_snapshot->'nodes') n
    )
  )
)
WHERE template_id IN (SELECT id FROM automation_templates WHERE is_system = true)
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(definition_snapshot->'nodes') n
    WHERE n->>'type' = 'action'
      AND n->'data'->>'actionType' IN ('assign_owner','create_note','internal_notification')
  );
