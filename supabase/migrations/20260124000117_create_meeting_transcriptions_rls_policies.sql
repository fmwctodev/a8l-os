/*
  # Create RLS Policies for Meeting Transcriptions Module

  This migration creates Row Level Security policies for all Meeting Transcription tables.

  ## Security Model
  - Organization-based visibility for all users
  - Users can view all meeting transcriptions in their org
  - Users can import/create meeting transcriptions
  - Only admins can delete transcriptions

  ## Policies Created

  ### meeting_transcriptions
  - SELECT: Users can view transcriptions in their org
  - INSERT: Users can import transcriptions to their org
  - UPDATE: Users can update transcriptions in their org
  - DELETE: Only admins can delete transcriptions

  ### meeting_transcription_contacts
  - Follows transcription permissions

  ### contact_meeting_notes
  - Users can view/create/edit their own notes
  - Admins can see all notes

  ### proposal_meeting_contexts
  - Follows proposal permissions
*/

-- Helper function to check if user can access meeting transcription
CREATE OR REPLACE FUNCTION can_access_meeting_transcription(user_id uuid, trans_org_id uuid)
RETURNS boolean AS $$
DECLARE
  user_org_id uuid;
BEGIN
  SELECT organization_id INTO user_org_id
  FROM users
  WHERE id = user_id;
  
  RETURN user_org_id = trans_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- MEETING TRANSCRIPTIONS POLICIES
-- ============================================

CREATE POLICY "Users can view transcriptions in their org"
  ON meeting_transcriptions FOR SELECT
  TO authenticated
  USING (can_access_meeting_transcription(auth.uid(), org_id));

CREATE POLICY "Users can import transcriptions to their org"
  ON meeting_transcriptions FOR INSERT
  TO authenticated
  WITH CHECK (
    can_access_meeting_transcription(auth.uid(), org_id)
    AND imported_by = auth.uid()
  );

CREATE POLICY "Users can update transcriptions in their org"
  ON meeting_transcriptions FOR UPDATE
  TO authenticated
  USING (can_access_meeting_transcription(auth.uid(), org_id))
  WITH CHECK (can_access_meeting_transcription(auth.uid(), org_id));

CREATE POLICY "Admins can delete transcriptions"
  ON meeting_transcriptions FOR DELETE
  TO authenticated
  USING (
    can_access_meeting_transcription(auth.uid(), org_id)
    AND is_proposal_admin(auth.uid())
  );

-- ============================================
-- MEETING TRANSCRIPTION CONTACTS POLICIES
-- ============================================

CREATE POLICY "Users can view transcription contacts in their org"
  ON meeting_transcription_contacts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM meeting_transcriptions mt
      WHERE mt.id = meeting_transcription_id
      AND can_access_meeting_transcription(auth.uid(), mt.org_id)
    )
  );

CREATE POLICY "Users can link contacts to transcriptions"
  ON meeting_transcription_contacts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meeting_transcriptions mt
      WHERE mt.id = meeting_transcription_id
      AND can_access_meeting_transcription(auth.uid(), mt.org_id)
    )
  );

CREATE POLICY "Users can update transcription contact links"
  ON meeting_transcription_contacts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM meeting_transcriptions mt
      WHERE mt.id = meeting_transcription_id
      AND can_access_meeting_transcription(auth.uid(), mt.org_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meeting_transcriptions mt
      WHERE mt.id = meeting_transcription_id
      AND can_access_meeting_transcription(auth.uid(), mt.org_id)
    )
  );

CREATE POLICY "Users can unlink contacts from transcriptions"
  ON meeting_transcription_contacts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM meeting_transcriptions mt
      WHERE mt.id = meeting_transcription_id
      AND can_access_meeting_transcription(auth.uid(), mt.org_id)
    )
  );

-- ============================================
-- CONTACT MEETING NOTES POLICIES
-- ============================================

CREATE POLICY "Users can view meeting notes in their org"
  ON contact_meeting_notes FOR SELECT
  TO authenticated
  USING (can_access_meeting_transcription(auth.uid(), org_id));

CREATE POLICY "Users can create meeting notes"
  ON contact_meeting_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    can_access_meeting_transcription(auth.uid(), org_id)
    AND created_by = auth.uid()
  );

CREATE POLICY "Users can update their own meeting notes"
  ON contact_meeting_notes FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete their own meeting notes"
  ON contact_meeting_notes FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- ============================================
-- PROPOSAL MEETING CONTEXTS POLICIES
-- ============================================

CREATE POLICY "Users can view proposal meeting contexts"
  ON proposal_meeting_contexts FOR SELECT
  TO authenticated
  USING (can_access_proposal_by_id(auth.uid(), proposal_id));

CREATE POLICY "Users can link meetings to proposals"
  ON proposal_meeting_contexts FOR INSERT
  TO authenticated
  WITH CHECK (can_access_proposal_by_id(auth.uid(), proposal_id));

CREATE POLICY "Users can update proposal meeting contexts"
  ON proposal_meeting_contexts FOR UPDATE
  TO authenticated
  USING (can_access_proposal_by_id(auth.uid(), proposal_id))
  WITH CHECK (can_access_proposal_by_id(auth.uid(), proposal_id));

CREATE POLICY "Users can unlink meetings from proposals"
  ON proposal_meeting_contexts FOR DELETE
  TO authenticated
  USING (can_access_proposal_by_id(auth.uid(), proposal_id));
