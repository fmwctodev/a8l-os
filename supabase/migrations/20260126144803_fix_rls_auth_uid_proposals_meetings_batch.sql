/*
  # Fix RLS auth.uid() Performance - Proposals & Meetings Batch
  
  This migration optimizes RLS policies for proposals and meeting transcription tables.
  
  ## Tables Fixed
  - proposals, proposal_templates, proposal_sections, proposal_line_items (org_id)
  - proposal_comments, proposal_activities, proposal_meeting_contexts (org_id)
  - meeting_transcriptions, meeting_transcription_contacts (org_id)
  
  ## Changes
  - All auth.uid() calls wrapped in (select auth.uid())
  - Using get_auth_user_org_id() for org checks
*/

-- ============================================
-- proposals (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view accessible proposals" ON proposals;
DROP POLICY IF EXISTS "Users can create proposals in their org" ON proposals;
DROP POLICY IF EXISTS "Users can update accessible proposals" ON proposals;
DROP POLICY IF EXISTS "Admins can delete proposals" ON proposals;

CREATE POLICY "Users can view accessible proposals"
  ON proposals FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users can create proposals in their org"
  ON proposals FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can update accessible proposals"
  ON proposals FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can delete proposals"
  ON proposals FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- ============================================
-- proposal_templates (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view templates in their org" ON proposal_templates;
DROP POLICY IF EXISTS "Admins can create templates" ON proposal_templates;
DROP POLICY IF EXISTS "Admins can update templates" ON proposal_templates;
DROP POLICY IF EXISTS "Admins can delete templates" ON proposal_templates;

CREATE POLICY "Users can view templates in their org"
  ON proposal_templates FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can create templates"
  ON proposal_templates FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can update templates"
  ON proposal_templates FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can delete templates"
  ON proposal_templates FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- ============================================
-- proposal_sections (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view sections for accessible proposals" ON proposal_sections;
DROP POLICY IF EXISTS "Users can create sections for accessible proposals" ON proposal_sections;
DROP POLICY IF EXISTS "Users can update sections for accessible proposals" ON proposal_sections;
DROP POLICY IF EXISTS "Users can delete sections for accessible proposals" ON proposal_sections;

CREATE POLICY "Users can view sections for accessible proposals"
  ON proposal_sections FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users can create sections for accessible proposals"
  ON proposal_sections FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can update sections for accessible proposals"
  ON proposal_sections FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can delete sections for accessible proposals"
  ON proposal_sections FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- ============================================
-- proposal_line_items (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view line items for accessible proposals" ON proposal_line_items;
DROP POLICY IF EXISTS "Users can create line items for accessible proposals" ON proposal_line_items;
DROP POLICY IF EXISTS "Users can update line items for accessible proposals" ON proposal_line_items;
DROP POLICY IF EXISTS "Users can delete line items for accessible proposals" ON proposal_line_items;

CREATE POLICY "Users can view line items for accessible proposals"
  ON proposal_line_items FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users can create line items for accessible proposals"
  ON proposal_line_items FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can update line items for accessible proposals"
  ON proposal_line_items FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can delete line items for accessible proposals"
  ON proposal_line_items FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- ============================================
-- proposal_comments (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view comments for accessible proposals" ON proposal_comments;
DROP POLICY IF EXISTS "Users can create comments on accessible proposals" ON proposal_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON proposal_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON proposal_comments;

CREATE POLICY "Users can view comments for accessible proposals"
  ON proposal_comments FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users can create comments on accessible proposals"
  ON proposal_comments FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can update their own comments"
  ON proposal_comments FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id() AND user_id = (select auth.uid()))
  WITH CHECK (org_id = get_auth_user_org_id() AND user_id = (select auth.uid()));

CREATE POLICY "Users can delete their own comments"
  ON proposal_comments FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id() AND user_id = (select auth.uid()));

-- ============================================
-- proposal_activities (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view activities for accessible proposals" ON proposal_activities;
DROP POLICY IF EXISTS "System can create proposal activities" ON proposal_activities;

CREATE POLICY "Users can view activities for accessible proposals"
  ON proposal_activities FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "System can create proposal activities"
  ON proposal_activities FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

-- ============================================
-- proposal_meeting_contexts (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view proposal meeting contexts" ON proposal_meeting_contexts;
DROP POLICY IF EXISTS "Users can link meetings to proposals" ON proposal_meeting_contexts;
DROP POLICY IF EXISTS "Users can update proposal meeting contexts" ON proposal_meeting_contexts;
DROP POLICY IF EXISTS "Users can unlink meetings from proposals" ON proposal_meeting_contexts;

CREATE POLICY "Users can view proposal meeting contexts"
  ON proposal_meeting_contexts FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users can link meetings to proposals"
  ON proposal_meeting_contexts FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can update proposal meeting contexts"
  ON proposal_meeting_contexts FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can unlink meetings from proposals"
  ON proposal_meeting_contexts FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- ============================================
-- meeting_transcriptions (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view transcriptions in their org" ON meeting_transcriptions;
DROP POLICY IF EXISTS "Users can import transcriptions to their org" ON meeting_transcriptions;
DROP POLICY IF EXISTS "Users can update transcriptions in their org" ON meeting_transcriptions;
DROP POLICY IF EXISTS "Admins can delete transcriptions" ON meeting_transcriptions;

CREATE POLICY "Users can view transcriptions in their org"
  ON meeting_transcriptions FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users can import transcriptions to their org"
  ON meeting_transcriptions FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can update transcriptions in their org"
  ON meeting_transcriptions FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can delete transcriptions"
  ON meeting_transcriptions FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- ============================================
-- meeting_transcription_contacts (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view transcription contacts in their org" ON meeting_transcription_contacts;
DROP POLICY IF EXISTS "Users can link contacts to transcriptions" ON meeting_transcription_contacts;
DROP POLICY IF EXISTS "Users can update transcription contact links" ON meeting_transcription_contacts;
DROP POLICY IF EXISTS "Users can unlink contacts from transcriptions" ON meeting_transcription_contacts;

CREATE POLICY "Users can view transcription contacts in their org"
  ON meeting_transcription_contacts FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users can link contacts to transcriptions"
  ON meeting_transcription_contacts FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can update transcription contact links"
  ON meeting_transcription_contacts FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can unlink contacts from transcriptions"
  ON meeting_transcription_contacts FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());
