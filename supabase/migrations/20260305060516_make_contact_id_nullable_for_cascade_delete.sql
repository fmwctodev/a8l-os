/*
  # Make contact_id nullable on financial and project tables

  ## Summary
  The previous migration set ON DELETE SET NULL on invoices, payments, projects,
  and recurring_profiles, but those columns have a NOT NULL constraint which
  prevents the cascade from working. This migration removes the NOT NULL constraint
  so contacts can be deleted while preserving the related records.

  ## Tables Modified
  - `invoices.contact_id` - made nullable
  - `payments.contact_id` - made nullable
  - `projects.contact_id` - made nullable
  - `recurring_profiles.contact_id` - made nullable
*/

ALTER TABLE invoices ALTER COLUMN contact_id DROP NOT NULL;
ALTER TABLE payments ALTER COLUMN contact_id DROP NOT NULL;
ALTER TABLE projects ALTER COLUMN contact_id DROP NOT NULL;
ALTER TABLE recurring_profiles ALTER COLUMN contact_id DROP NOT NULL;
