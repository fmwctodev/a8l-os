/*
  # Seed qbo_connections from integration_connections

  1. Purpose
    - Copy the existing QuickBooks Online connection data from `integration_connections`
      into the `qbo_connections` table so the Payments module can detect it
    - The Payments module reads from `qbo_connections` while the Integrations settings
      page wrote to `integration_connections`, causing a disconnect

  2. Changes
    - Inserts one row into `qbo_connections` by extracting data from `integration_connections`
      joined with `integrations` where key = 'quickbooks_online' and status = 'connected'
    - Maps `account_info->>'realm_id'` to `realm_id`
    - Maps `account_info->>'company_name'` to `company_name`
    - Maps `token_expires_at` to `token_expiry`
    - Skips if a row already exists for the same org_id

  3. Important Notes
    - This is a one-time data migration to bridge the two systems
    - No destructive operations are performed
*/

INSERT INTO qbo_connections (
  id,
  org_id,
  realm_id,
  company_name,
  access_token_encrypted,
  refresh_token_encrypted,
  token_expiry,
  connected_by,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  ic.org_id,
  ic.account_info->>'realm_id',
  COALESCE(ic.account_info->>'company_name', 'QuickBooks Company'),
  ic.access_token_encrypted,
  ic.refresh_token_encrypted,
  COALESCE(ic.token_expires_at, now() + interval '1 hour'),
  ic.connected_by,
  now(),
  now()
FROM integration_connections ic
JOIN integrations i ON i.id = ic.integration_id
WHERE i.key = 'quickbooks_online'
  AND ic.status = 'connected'
  AND ic.account_info->>'realm_id' IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM qbo_connections qc WHERE qc.org_id = ic.org_id
  );
