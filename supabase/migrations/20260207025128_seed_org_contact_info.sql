/*
  # Seed default organization contact info

  1. Modified Data
    - Updates all existing organizations with Autom8ion Lab contact details
      - `email`: info@autom8ionlab.com
      - `phone`: 1 (855) 508-6062
      - `website`: https://autom8ionlab.com

  2. Notes
    - Only updates rows where these fields are currently NULL
*/

UPDATE organizations
SET
  email = 'info@autom8ionlab.com',
  phone = '1 (855) 508-6062',
  website = 'https://autom8ionlab.com'
WHERE email IS NULL AND phone IS NULL AND website IS NULL;