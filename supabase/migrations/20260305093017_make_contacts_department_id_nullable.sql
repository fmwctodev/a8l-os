/*
  # Make contacts.department_id nullable

  The department_id column on contacts has a NOT NULL constraint but it is an
  optional field — contacts don't always belong to a department, and inline
  create forms (Conversations, Dashboard, etc.) don't capture it. This was
  causing a 400 Bad Request whenever a user without a department_id tried to
  create a contact.

  ## Changes
  - `contacts.department_id` — drop NOT NULL constraint (allow NULL)
*/

ALTER TABLE contacts ALTER COLUMN department_id DROP NOT NULL;
