/*
  # Add missing updated_at column to payments table

  1. Modified Tables
    - `payments` - Add `updated_at` column (timestamptz, default now())

  2. Problem
    - The payments table has a BEFORE UPDATE trigger (update_payments_updated_at)
      that sets NEW.updated_at = now(), but the table has no updated_at column
    - When a contact is deleted, the SET NULL cascade on payments.contact_id
      fires the update trigger, crashing with:
      "record 'new' has no field 'updated_at'"

  3. Fix
    - Add the missing updated_at column to payments
    - Backfill existing rows with created_at value
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE payments ADD COLUMN updated_at timestamptz DEFAULT now();
    UPDATE payments SET updated_at = created_at WHERE updated_at IS NULL;
  END IF;
END $$;
