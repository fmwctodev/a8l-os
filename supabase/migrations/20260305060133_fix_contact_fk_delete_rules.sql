/*
  # Fix Contact Foreign Key Delete Rules

  ## Summary
  Changes 4 foreign key constraints on the `contacts` table from RESTRICT to SET NULL,
  allowing admins and system admins to delete contacts even when related records exist.

  ## Tables Modified
  - `invoices.contact_id` - SET NULL on contact delete (invoice is preserved, contact reference cleared)
  - `payments.contact_id` - SET NULL on contact delete (payment record preserved)
  - `projects.contact_id` - SET NULL on contact delete (project preserved)
  - `recurring_profiles.contact_id` - SET NULL on contact delete (profile preserved)

  ## Notes
  Financial and project records are preserved; only the contact reference is cleared.
*/

ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_contact_id_fkey,
  ADD CONSTRAINT invoices_contact_id_fkey
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_contact_id_fkey,
  ADD CONSTRAINT payments_contact_id_fkey
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;

ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_contact_id_fkey,
  ADD CONSTRAINT projects_contact_id_fkey
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;

ALTER TABLE recurring_profiles
  DROP CONSTRAINT IF EXISTS recurring_profiles_contact_id_fkey,
  ADD CONSTRAINT recurring_profiles_contact_id_fkey
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
