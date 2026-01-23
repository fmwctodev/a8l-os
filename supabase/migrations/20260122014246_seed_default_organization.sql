/*
  # Seed Default Organization

  ## Overview
  Creates the default organization for Autom8ion Lab that will be used for the SuperAdmin account.

  ## 1. Organizations
  - Creates "Autom8ion Lab" as the default organization
  
  ## 2. Notes
  - The SuperAdmin user will be created via the bootstrap Edge Function
  - This organization ID is used by the bootstrap process
*/

INSERT INTO organizations (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Autom8ion Lab')
ON CONFLICT (id) DO NOTHING;