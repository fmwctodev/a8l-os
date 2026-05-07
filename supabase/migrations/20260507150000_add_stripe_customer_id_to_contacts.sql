/*
  # Add stripe_customer_id to contacts

  Links a contact to its Stripe Customer object. Phase C of the Stripe
  integration uses this to:
  - Avoid creating duplicate customers in Stripe when invoices are
    issued for the same contact across multiple sessions
  - Power the "Stripe Customer" panel on ContactDetail
  - Filter Stripe payment lists to a specific contact's payments

  Indexed (partial) for fast lookup by Stripe customer ID — webhook
  handlers use this to find the local contact when Stripe sends a
  charge/refund/dispute event with `customer = cus_...`.

  Idempotent: ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS.
*/

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

CREATE INDEX IF NOT EXISTS idx_contacts_stripe_customer
  ON contacts(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
