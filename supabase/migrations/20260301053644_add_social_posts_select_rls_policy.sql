/*
  # Add SELECT RLS policy to social_posts

  1. Security Changes
    - Add SELECT policy on `social_posts` table for authenticated users
    - Users can only read posts belonging to their organization
    - Matches the existing INSERT/UPDATE/DELETE policy pattern using `get_auth_user_org_id()`

  2. Problem Solved
    - Without a SELECT policy, any query that reads social_posts (including
      `.insert().select()`) returns 403 Forbidden
    - This fixes the "Failed to publish draft" error in the social chat flow
*/

CREATE POLICY "Users can read own org social posts"
  ON social_posts
  FOR SELECT
  TO authenticated
  USING (organization_id = get_auth_user_org_id());
