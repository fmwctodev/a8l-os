/*
  # Re-run contract total_value backfill

  Now that proposals have correct total_value populated, re-run the backfill
  to copy proposal total_value into contracts that still show $0.00.
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
