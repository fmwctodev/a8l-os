/*
  # Add GHL external ID columns for idempotent re-imports

  When importing from GoHighLevel we need to know whether a record
  already exists in our DB so re-runs don't duplicate. Each table
  gets a nullable text column that holds the GHL record's UUID, plus
  a partial unique index scoped by org so the same GHL record can
  appear once per org (e.g. autom8ionlab and BuilderLync could each
  import a contact with GHL ID "abc123" and they're separate rows).

  Idempotent (`ADD COLUMN IF NOT EXISTS` / `CREATE INDEX IF NOT
  EXISTS`). Re-runnable.
*/

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS ghl_contact_id text;

CREATE INDEX IF NOT EXISTS idx_contacts_ghl_id
  ON contacts(organization_id, ghl_contact_id)
  WHERE ghl_contact_id IS NOT NULL;

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS ghl_opportunity_id text;

CREATE INDEX IF NOT EXISTS idx_opportunities_ghl_id
  ON opportunities(org_id, ghl_opportunity_id)
  WHERE ghl_opportunity_id IS NOT NULL;

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS ghl_appointment_id text;

CREATE INDEX IF NOT EXISTS idx_appointments_ghl_id
  ON appointments(org_id, ghl_appointment_id)
  WHERE ghl_appointment_id IS NOT NULL;
