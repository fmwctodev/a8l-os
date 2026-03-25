/*
  # Add portal_token column to project_client_portals

  1. Modified Tables
    - `project_client_portals`
      - Added `portal_token` (text) - stores the raw portal token so links remain permanent and recoverable
  
  2. Notes
    - Previously only the SHA-256 hash was stored, making the portal URL unrecoverable after initial creation
    - This change ensures portal links are permanent and do not need to be regenerated
    - The hash column is retained for token verification lookups
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_client_portals' AND column_name = 'portal_token'
  ) THEN
    ALTER TABLE project_client_portals ADD COLUMN portal_token text;
  END IF;
END $$;
