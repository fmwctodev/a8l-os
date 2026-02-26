/*
  # Restrict Social Guidelines to SuperAdmin Only & Remove Personal Rows

  1. Changes
    - Deletes all personal guideline rows (where user_id IS NOT NULL)
    - Replaces INSERT policy so only SuperAdmin users can create guidelines
    - Replaces UPDATE policy so only SuperAdmin users can modify guidelines
    - Replaces DELETE policy so only SuperAdmin users can delete guidelines
    - Keeps SELECT policy unchanged so all org members can read guidelines

  2. Security
    - Only users with the SuperAdmin role (hierarchy_level = 1) can write to social_guidelines
    - All authenticated org members retain read access
    - RLS remains enabled on the table

  3. Important Notes
    - Personal guideline rows (user_id IS NOT NULL) are removed since guidelines
      are now organization-wide system defaults managed by the System Administrator
    - The unique constraint on (organization_id, user_id) remains; going forward
      only rows with user_id = NULL will exist
*/

DELETE FROM social_guidelines WHERE user_id IS NOT NULL;

DROP POLICY IF EXISTS "Users can create guidelines in own org" ON social_guidelines;
DROP POLICY IF EXISTS "Users can update own or workspace guidelines" ON social_guidelines;
DROP POLICY IF EXISTS "Users can delete own guidelines" ON social_guidelines;

CREATE POLICY "SuperAdmin can create guidelines"
  ON social_guidelines FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT u.organization_id FROM public.users u
      INNER JOIN public.roles r ON r.id = u.role_id
      WHERE u.id = auth.uid() AND r.name = 'SuperAdmin'
    )
  );

CREATE POLICY "SuperAdmin can update guidelines"
  ON social_guidelines FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT u.organization_id FROM public.users u
      INNER JOIN public.roles r ON r.id = u.role_id
      WHERE u.id = auth.uid() AND r.name = 'SuperAdmin'
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT u.organization_id FROM public.users u
      INNER JOIN public.roles r ON r.id = u.role_id
      WHERE u.id = auth.uid() AND r.name = 'SuperAdmin'
    )
  );

CREATE POLICY "SuperAdmin can delete guidelines"
  ON social_guidelines FOR DELETE TO authenticated
  USING (
    organization_id IN (
      SELECT u.organization_id FROM public.users u
      INNER JOIN public.roles r ON r.id = u.role_id
      WHERE u.id = auth.uid() AND r.name = 'SuperAdmin'
    )
  );
