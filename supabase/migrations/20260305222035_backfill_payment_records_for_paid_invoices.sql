/*
  # Backfill payment records for paid invoices

  1. Problem
    - QBO invoice sync marked invoices as 'paid' but never created
      corresponding rows in the payments table
    - The Contact Detail Payments tab calculates Total Paid from the
      payments table, so it showed $0.00 for these invoices

  2. Changes
    - Inserts a payment record for every invoice with status = 'paid'
      that has no matching row in the payments table
    - Uses the invoice total as the payment amount
    - Sets payment_method to 'other' since the original method is unknown
    - Uses the invoice paid_at timestamp as received_at

  3. Safety
    - Only targets invoices that are missing payment records
    - Does not modify any existing data
    - Idempotent: re-running will not create duplicates
*/

INSERT INTO payments (org_id, contact_id, invoice_id, amount, currency, payment_method, received_at)
SELECT
  i.org_id,
  i.contact_id,
  i.id,
  i.total,
  i.currency,
  'other',
  COALESCE(i.paid_at, now())
FROM invoices i
WHERE i.status = 'paid'
  AND NOT EXISTS (
    SELECT 1 FROM payments p WHERE p.invoice_id = i.id
  );
