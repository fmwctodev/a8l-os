/*
  # Fix Team Channels RLS Policy - Allow Creators to View Their Channels

  ## Problem
  There was a circular dependency in the RLS policies:
  1. To add yourself as a channel member, you need to verify you're the channel creator
  2. To verify you're the creator, you need to SELECT from team_channels
  3. But the SELECT policy requires you to already be a member
  
  This prevented users from creating groups or starting direct messages.

  ## Solution
  Add a new SELECT policy that allows channel creators to view their own channels,
  breaking the circular dependency.

  ## Changes
  1. New Policy: "Channel creators can view their channels"
     - Allows users to SELECT channels where they are the creator (created_by = auth.uid())
     - This runs alongside the existing "Users can view channels they are members of" policy
*/

-- Add policy allowing channel creators to view their channels
CREATE POLICY "Channel creators can view their channels"
  ON team_channels FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());
