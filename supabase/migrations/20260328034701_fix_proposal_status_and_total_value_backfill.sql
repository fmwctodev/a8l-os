/*
  # Fix Proposal Status and Total Value Backfill

  ## Summary
  Two issues fixed:
  1. Proposals that have been sent for signature have signature_status = 'pending_signature'
     but status remains 'draft'. This migration updates status to 'sent' for those proposals.
  2. All proposals have total_value = 0 because the value is embedded in HTML sections
     content rather than stored in the DB field. This migration extracts total values
     using regex patterns from the pricing section content.

  ## Changes
  - Updates proposal status from 'draft' to 'sent' where signature_status = 'pending_signature'
  - Extracts and stores total_value from pricing section HTML content using regex
*/

-- Step 1: Update proposal status to 'sent' when signature request has been sent
UPDATE proposals
SET
  status = 'sent',
  updated_at = now()
WHERE signature_status IN ('pending_signature', 'viewed')
  AND status = 'draft'
  AND archived_at IS NULL;

-- Step 2: Backfill total_value from pricing section content using regex extraction
-- Extract the largest dollar amount from the pricing section for each proposal
-- that still has total_value = 0
UPDATE proposals p
SET
  total_value = extracted.val,
  updated_at = now()
FROM (
  SELECT
    ps.proposal_id,
    MAX(
      CASE
        -- Match patterns like $42,000 or AUD $127,500 or $14,400/year - get numeric value
        WHEN ps.content ~ '\$[0-9]{1,3}(,[0-9]{3})*(\.[0-9]+)?' THEN
          (
            SELECT MAX(REPLACE(REPLACE(m[1], ',', ''), '.', '')::numeric)
            FROM regexp_matches(
              ps.content,
              '\$([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?)',
              'g'
            ) AS m
            WHERE REPLACE(REPLACE(m[1], ',', ''), '.', '')::numeric >= 1000
          )
        ELSE NULL
      END
    ) AS val
  FROM proposal_sections ps
  WHERE ps.section_type = 'pricing'
  GROUP BY ps.proposal_id
) extracted
WHERE p.id = extracted.proposal_id
  AND (p.total_value IS NULL OR p.total_value = 0)
  AND extracted.val IS NOT NULL
  AND extracted.val > 0;
