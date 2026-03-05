/*
  # Remove duplicate availability_date_overrides DELETE policy
  
  The old permission-gated policy was not dropped by the previous migration
  because it had a different name. Drop it now so only the org-membership
  policy remains, allowing cascade deletes to work correctly.
*/

DROP POLICY IF EXISTS "Users with calendars.manage can delete date overrides" ON availability_date_overrides;
