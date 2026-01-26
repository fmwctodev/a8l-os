/*
  # Optimize RLS Policies for Proposals, Reports, and Reputation Tables
  
  1. Tables Modified
    - proposals, proposal_sections, proposal_line_items
    - proposal_templates, proposal_activities, proposal_comments
    - proposal_meeting_contexts
    - reports, report_runs, report_schedules, report_exports, report_email_queue
    - reputation_settings, reputation_competitors
    - review_providers, review_requests, reviews
  
  2. Changes
    - Replace auth.uid() with (select auth.uid()) for performance optimization
  
  3. Security
    - All policies maintain same access control logic
*/

-- proposals
DROP POLICY IF EXISTS "Users can view accessible proposals" ON proposals;
DROP POLICY IF EXISTS "Users can update accessible proposals" ON proposals;
DROP POLICY IF EXISTS "Admins can delete proposals" ON proposals;

CREATE POLICY "Users can view accessible proposals" ON proposals
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = (select auth.uid())
    AND u.organization_id = proposals.org_id
    AND (r.hierarchy_level <= 2 OR proposals.created_by = (select auth.uid()) OR proposals.assigned_user_id = (select auth.uid()))
  ));

CREATE POLICY "Users can update accessible proposals" ON proposals
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = (select auth.uid())
    AND u.organization_id = proposals.org_id
    AND (r.hierarchy_level <= 2 OR proposals.created_by = (select auth.uid()) OR proposals.assigned_user_id = (select auth.uid()))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = (select auth.uid())
    AND u.organization_id = proposals.org_id
    AND (r.hierarchy_level <= 2 OR proposals.created_by = (select auth.uid()) OR proposals.assigned_user_id = (select auth.uid()))
  ));

CREATE POLICY "Admins can delete proposals" ON proposals
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u WHERE u.id = (select auth.uid()) AND u.organization_id = proposals.org_id
  ) AND is_proposal_admin((select auth.uid())));

-- proposal_templates
DROP POLICY IF EXISTS "Users can view templates in their org" ON proposal_templates;
DROP POLICY IF EXISTS "Admins can update templates" ON proposal_templates;
DROP POLICY IF EXISTS "Admins can delete templates" ON proposal_templates;

CREATE POLICY "Users can view templates in their org" ON proposal_templates
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u WHERE u.id = (select auth.uid()) AND u.organization_id = proposal_templates.org_id
  ));

CREATE POLICY "Admins can update templates" ON proposal_templates
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u WHERE u.id = (select auth.uid()) AND u.organization_id = proposal_templates.org_id
  ))
  WITH CHECK (is_proposal_admin((select auth.uid())));

CREATE POLICY "Admins can delete templates" ON proposal_templates
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u WHERE u.id = (select auth.uid()) AND u.organization_id = proposal_templates.org_id
  ) AND is_proposal_admin((select auth.uid())));

-- proposal_sections
DROP POLICY IF EXISTS "Users can view sections for accessible proposals" ON proposal_sections;
DROP POLICY IF EXISTS "Users can update sections for accessible proposals" ON proposal_sections;
DROP POLICY IF EXISTS "Users can delete sections for accessible proposals" ON proposal_sections;

CREATE POLICY "Users can view sections for accessible proposals" ON proposal_sections
  FOR SELECT TO authenticated
  USING (can_access_proposal_by_id((select auth.uid()), proposal_id));

CREATE POLICY "Users can update sections for accessible proposals" ON proposal_sections
  FOR UPDATE TO authenticated
  USING (can_access_proposal_by_id((select auth.uid()), proposal_id))
  WITH CHECK (can_access_proposal_by_id((select auth.uid()), proposal_id));

CREATE POLICY "Users can delete sections for accessible proposals" ON proposal_sections
  FOR DELETE TO authenticated
  USING (can_access_proposal_by_id((select auth.uid()), proposal_id));

-- proposal_line_items
DROP POLICY IF EXISTS "Users can view line items for accessible proposals" ON proposal_line_items;
DROP POLICY IF EXISTS "Users can update line items for accessible proposals" ON proposal_line_items;
DROP POLICY IF EXISTS "Users can delete line items for accessible proposals" ON proposal_line_items;

CREATE POLICY "Users can view line items for accessible proposals" ON proposal_line_items
  FOR SELECT TO authenticated
  USING (can_access_proposal_by_id((select auth.uid()), proposal_id));

CREATE POLICY "Users can update line items for accessible proposals" ON proposal_line_items
  FOR UPDATE TO authenticated
  USING (can_access_proposal_by_id((select auth.uid()), proposal_id))
  WITH CHECK (can_access_proposal_by_id((select auth.uid()), proposal_id));

CREATE POLICY "Users can delete line items for accessible proposals" ON proposal_line_items
  FOR DELETE TO authenticated
  USING (can_access_proposal_by_id((select auth.uid()), proposal_id));

-- proposal_activities
DROP POLICY IF EXISTS "Users can view activities for accessible proposals" ON proposal_activities;

CREATE POLICY "Users can view activities for accessible proposals" ON proposal_activities
  FOR SELECT TO authenticated
  USING (can_access_proposal_by_id((select auth.uid()), proposal_id));

-- proposal_comments
DROP POLICY IF EXISTS "Users can view comments for accessible proposals" ON proposal_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON proposal_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON proposal_comments;

CREATE POLICY "Users can view comments for accessible proposals" ON proposal_comments
  FOR SELECT TO authenticated
  USING (can_access_proposal_by_id((select auth.uid()), proposal_id));

CREATE POLICY "Users can update their own comments" ON proposal_comments
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete their own comments" ON proposal_comments
  FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- proposal_meeting_contexts
DROP POLICY IF EXISTS "Users can view proposal meeting contexts" ON proposal_meeting_contexts;
DROP POLICY IF EXISTS "Users can update proposal meeting contexts" ON proposal_meeting_contexts;
DROP POLICY IF EXISTS "Users can unlink meetings from proposals" ON proposal_meeting_contexts;

CREATE POLICY "Users can view proposal meeting contexts" ON proposal_meeting_contexts
  FOR SELECT TO authenticated
  USING (can_access_proposal_by_id((select auth.uid()), proposal_id));

CREATE POLICY "Users can update proposal meeting contexts" ON proposal_meeting_contexts
  FOR UPDATE TO authenticated
  USING (can_access_proposal_by_id((select auth.uid()), proposal_id))
  WITH CHECK (can_access_proposal_by_id((select auth.uid()), proposal_id));

CREATE POLICY "Users can unlink meetings from proposals" ON proposal_meeting_contexts
  FOR DELETE TO authenticated
  USING (can_access_proposal_by_id((select auth.uid()), proposal_id));

-- reports
DROP POLICY IF EXISTS "Users can update their own reports" ON reports;
DROP POLICY IF EXISTS "Users can delete their own reports" ON reports;

CREATE POLICY "Users can update their own reports" ON reports
  FOR UPDATE TO authenticated
  USING (created_by = (select auth.uid()))
  WITH CHECK (created_by = (select auth.uid()));

CREATE POLICY "Users can delete their own reports" ON reports
  FOR DELETE TO authenticated
  USING (created_by = (select auth.uid()));

-- report_runs
DROP POLICY IF EXISTS "Users can update report runs they created" ON report_runs;

CREATE POLICY "Users can update report runs they created" ON report_runs
  FOR UPDATE TO authenticated
  USING (triggered_by_user_id = (select auth.uid()) OR triggered_by = 'schedule')
  WITH CHECK (triggered_by_user_id = (select auth.uid()) OR triggered_by = 'schedule');

-- report_schedules
DROP POLICY IF EXISTS "Users can update their own schedules" ON report_schedules;
DROP POLICY IF EXISTS "Users can delete their own schedules" ON report_schedules;

CREATE POLICY "Users can update their own schedules" ON report_schedules
  FOR UPDATE TO authenticated
  USING (created_by = (select auth.uid()))
  WITH CHECK (created_by = (select auth.uid()));

CREATE POLICY "Users can delete their own schedules" ON report_schedules
  FOR DELETE TO authenticated
  USING (created_by = (select auth.uid()));

-- report_email_queue
DROP POLICY IF EXISTS "Users can view email queue for their schedules" ON report_email_queue;
DROP POLICY IF EXISTS "System can update email queue entries" ON report_email_queue;

CREATE POLICY "Users can view email queue for their schedules" ON report_email_queue
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM report_schedules rs
    WHERE rs.id = report_email_queue.schedule_id AND rs.created_by = (select auth.uid())
  ));

CREATE POLICY "System can update email queue entries" ON report_email_queue
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM report_schedules rs
    WHERE rs.id = report_email_queue.schedule_id AND rs.created_by = (select auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM report_schedules rs
    WHERE rs.id = report_email_queue.schedule_id AND rs.created_by = (select auth.uid())
  ));

-- reputation_settings
DROP POLICY IF EXISTS "Users can view reputation settings in their org" ON reputation_settings;
DROP POLICY IF EXISTS "Admins can update reputation settings" ON reputation_settings;

CREATE POLICY "Users can view reputation settings in their org" ON reputation_settings
  FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Admins can update reputation settings" ON reputation_settings
  FOR UPDATE TO authenticated
  USING (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_reputation_permission('reputation.providers.manage'))
  WITH CHECK (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_reputation_permission('reputation.providers.manage'));

-- reputation_competitors - drop all and recreate to consolidate
DROP POLICY IF EXISTS "Users can view own org competitors" ON reputation_competitors;
DROP POLICY IF EXISTS "Users can view organization competitors" ON reputation_competitors;
DROP POLICY IF EXISTS "Users with permission can update competitors" ON reputation_competitors;
DROP POLICY IF EXISTS "Users with permission can delete competitors" ON reputation_competitors;
DROP POLICY IF EXISTS "Users with permission can manage competitors" ON reputation_competitors;

CREATE POLICY "Users can view own org competitors" ON reputation_competitors
  FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Users with permission can update competitors" ON reputation_competitors
  FOR UPDATE TO authenticated
  USING (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_reputation_permission('reputation.manage'))
  WITH CHECK (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Users with permission can delete competitors" ON reputation_competitors
  FOR DELETE TO authenticated
  USING (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_reputation_permission('reputation.manage'));

-- review_providers
DROP POLICY IF EXISTS "Users can view review providers in their org" ON review_providers;
DROP POLICY IF EXISTS "Admins can update review providers" ON review_providers;
DROP POLICY IF EXISTS "Admins can delete review providers" ON review_providers;

CREATE POLICY "Users can view review providers in their org" ON review_providers
  FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Admins can update review providers" ON review_providers
  FOR UPDATE TO authenticated
  USING (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_reputation_permission('reputation.providers.manage'))
  WITH CHECK (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_reputation_permission('reputation.providers.manage'));

CREATE POLICY "Admins can delete review providers" ON review_providers
  FOR DELETE TO authenticated
  USING (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_reputation_permission('reputation.providers.manage'));

-- review_requests
DROP POLICY IF EXISTS "Users can view review requests in their org" ON review_requests;

CREATE POLICY "Users can view review requests in their org" ON review_requests
  FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_reputation_permission('reputation.view'));

-- reviews
DROP POLICY IF EXISTS "Users can view reviews in their org" ON reviews;
DROP POLICY IF EXISTS "Users can update reviews" ON reviews;

CREATE POLICY "Users can view reviews in their org" ON reviews
  FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_reputation_permission('reputation.view'));

CREATE POLICY "Users can update reviews" ON reviews
  FOR UPDATE TO authenticated
  USING (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_reputation_permission('reputation.manage'))
  WITH CHECK (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_reputation_permission('reputation.manage'));
