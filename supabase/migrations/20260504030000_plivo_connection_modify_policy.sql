/*
  # plivo_connection — INSERT/UPDATE/DELETE policy

  Initial migration only created a SELECT policy on plivo_connection.
  The plivo-connection edge function calls Supabase with the user's JWT
  attached as the global Authorization header, so PostgREST applies RLS
  for the user's role (not service role). The 'connect' upsert was
  failing with "new row violates row-level security policy" until this
  FOR ALL policy was added.

  plivo_numbers already has the equivalent FOR ALL policy from the
  original migration — this brings plivo_connection in line.
*/

DROP POLICY IF EXISTS plivo_connection_org_modify ON plivo_connection;
CREATE POLICY plivo_connection_org_modify ON plivo_connection
  FOR ALL TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()))
  WITH CHECK (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));
