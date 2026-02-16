/*
  # Add contact_id indexes for timeline performance

  Adds missing indexes on contact_id columns used by the contact detail
  timeline aggregation queries. These tables are queried in parallel when
  loading a contact's activity timeline.

  1. New Indexes
    - `messages(contact_id)` - speeds up message history lookup
    - `appointments(contact_id)` - speeds up appointment history lookup
    - `invoices(contact_id)` - speeds up invoice history lookup

  2. Important Notes
    - These queries were previously doing sequential scans
    - The contact_timeline, contact_notes, and contact_tasks tables
      already have proper indexes
*/

CREATE INDEX IF NOT EXISTS idx_messages_contact_id
  ON messages (contact_id);

CREATE INDEX IF NOT EXISTS idx_appointments_contact_id
  ON appointments (contact_id);

CREATE INDEX IF NOT EXISTS idx_invoices_contact_id
  ON invoices (contact_id);
