/*
  # Backfill contract total_value from linked proposals

  ## Summary
  Contracts created before the improved value-extraction logic have total_value = 0
  even though their source proposals contain pricing information. This migration
  copies total_value and currency from the source proposal to any contract where:
    - total_value is 0 or NULL
    - the contract has a proposal_id link
    - the linked proposal has a total_value > 0
*/

UPDATE contracts c
SET
  total_value = p.total_value,
  currency    = COALESCE(NULLIF(p.currency, ''), c.currency, 'USD'),
  updated_at  = now()
FROM proposals p
WHERE c.proposal_id = p.id
  AND (c.total_value IS NULL OR c.total_value = 0)
  AND p.total_value > 0;
