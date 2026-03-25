/*
  # Fix payments webhook trigger referencing non-existent columns

  1. Problem
    - The webhook_payment_completed trigger on payments references
      NEW.status and NEW.paid_at, but the payments table has neither column
    - This would crash on any UPDATE to the payments table

  2. Fix
    - Drop the broken trigger
    - Recreate it to use the correct column: received_at and payment_method
      as indicators of a completed payment
*/

DROP TRIGGER IF EXISTS webhook_payment_completed ON payments;

CREATE OR REPLACE FUNCTION public.trigger_webhook_payment_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  invoice_record RECORD;
BEGIN
  IF NEW.received_at IS NOT NULL AND OLD.received_at IS NULL THEN
    SELECT i.org_id, i.contact_id, c.first_name, c.last_name, c.email
    INTO invoice_record
    FROM invoices i
    LEFT JOIN contacts c ON c.id = i.contact_id
    WHERE i.id = NEW.invoice_id;

    IF invoice_record IS NOT NULL THEN
      PERFORM queue_webhook_delivery(
        invoice_record.org_id,
        'payment_completed',
        NEW.id,
        jsonb_build_object(
          'event_type', 'payment_completed',
          'timestamp', now(),
          'data', jsonb_build_object(
            'id', NEW.id,
            'invoice_id', NEW.invoice_id,
            'contact_id', invoice_record.contact_id,
            'contact_name', COALESCE(invoice_record.first_name, '') || ' ' || COALESCE(invoice_record.last_name, ''),
            'contact_email', invoice_record.email,
            'amount', NEW.amount,
            'payment_method', NEW.payment_method,
            'received_at', NEW.received_at
          )
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER webhook_payment_completed
  AFTER UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_webhook_payment_completed();
