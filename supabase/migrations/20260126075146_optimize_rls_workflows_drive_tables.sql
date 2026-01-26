/*
  # Optimize RLS Policies for Workflow and Drive Tables
  
  1. Tables Modified
    - workflow_goals, workflow_logs, workflow_action_retries
    - workflow_condition_waits, workflow_loops
    - workflow_scheduled_triggers, workflow_scheduled_trigger_runs
    - workflow_webhook_triggers, workflow_webhook_requests
    - workflow_trigger_audit_log, scheduled_trigger_jobs
    - payment_events
    - drive_connections, drive_files, drive_folders
    - content_ai_generations
  
  2. Changes
    - Replace auth.uid() with (select auth.uid()) for performance optimization
  
  3. Security
    - All policies maintain same access control logic
*/

-- workflow_goals
DROP POLICY IF EXISTS "Users can view workflow goals in their org" ON workflow_goals;
DROP POLICY IF EXISTS "Users with workflow permission can update workflow goals" ON workflow_goals;
DROP POLICY IF EXISTS "Users with workflow permission can delete workflow goals" ON workflow_goals;

CREATE POLICY "Users can view workflow goals in their org" ON workflow_goals
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Users with workflow permission can update workflow goals" ON workflow_goals
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ))
  WITH CHECK (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Users with workflow permission can delete workflow goals" ON workflow_goals
  FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

-- workflow_logs
DROP POLICY IF EXISTS "Users can view their organization's workflow logs" ON workflow_logs;

CREATE POLICY "Users can view their organization's workflow logs" ON workflow_logs
  FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

-- workflow_action_retries
DROP POLICY IF EXISTS "Users can view workflow action retries in their org" ON workflow_action_retries;
DROP POLICY IF EXISTS "Users with workflow permission can update workflow action retri" ON workflow_action_retries;
DROP POLICY IF EXISTS "Users with workflow permission can delete workflow action retri" ON workflow_action_retries;

CREATE POLICY "Users can view workflow action retries in their org" ON workflow_action_retries
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Users with workflow permission can update workflow action retries" ON workflow_action_retries
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ))
  WITH CHECK (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Users with workflow permission can delete workflow action retries" ON workflow_action_retries
  FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

-- workflow_condition_waits
DROP POLICY IF EXISTS "Users can view workflow condition waits in their org" ON workflow_condition_waits;
DROP POLICY IF EXISTS "Users with workflow permission can update workflow condition wa" ON workflow_condition_waits;
DROP POLICY IF EXISTS "Users with workflow permission can delete workflow condition wa" ON workflow_condition_waits;

CREATE POLICY "Users can view workflow condition waits in their org" ON workflow_condition_waits
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Users with workflow permission can update workflow condition waits" ON workflow_condition_waits
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ))
  WITH CHECK (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Users with workflow permission can delete workflow condition waits" ON workflow_condition_waits
  FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

-- workflow_loops
DROP POLICY IF EXISTS "Users can view workflow loops in their org" ON workflow_loops;
DROP POLICY IF EXISTS "Users with workflow permission can update workflow loops" ON workflow_loops;
DROP POLICY IF EXISTS "Users with workflow permission can delete workflow loops" ON workflow_loops;

CREATE POLICY "Users can view workflow loops in their org" ON workflow_loops
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Users with workflow permission can update workflow loops" ON workflow_loops
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ))
  WITH CHECK (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Users with workflow permission can delete workflow loops" ON workflow_loops
  FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

-- workflow_scheduled_triggers
DROP POLICY IF EXISTS "Users can view scheduled triggers in their org" ON workflow_scheduled_triggers;
DROP POLICY IF EXISTS "Users with automation.manage can update scheduled triggers" ON workflow_scheduled_triggers;
DROP POLICY IF EXISTS "Users with automation.manage can delete scheduled triggers" ON workflow_scheduled_triggers;

CREATE POLICY "Users can view scheduled triggers in their org" ON workflow_scheduled_triggers
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Users with automation.manage can update scheduled triggers" ON workflow_scheduled_triggers
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND has_automation_write_permission((select auth.uid()), org_id))
  WITH CHECK (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND has_automation_write_permission((select auth.uid()), org_id));

CREATE POLICY "Users with automation.manage can delete scheduled triggers" ON workflow_scheduled_triggers
  FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND has_automation_write_permission((select auth.uid()), org_id));

-- workflow_scheduled_trigger_runs
DROP POLICY IF EXISTS "Users can view scheduled trigger runs in their org" ON workflow_scheduled_trigger_runs;

CREATE POLICY "Users can view scheduled trigger runs in their org" ON workflow_scheduled_trigger_runs
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

-- workflow_webhook_triggers
DROP POLICY IF EXISTS "Users can view webhook triggers in their org" ON workflow_webhook_triggers;
DROP POLICY IF EXISTS "Users with automation.manage can update webhook triggers" ON workflow_webhook_triggers;
DROP POLICY IF EXISTS "Users with automation.manage can delete webhook triggers" ON workflow_webhook_triggers;

CREATE POLICY "Users can view webhook triggers in their org" ON workflow_webhook_triggers
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Users with automation.manage can update webhook triggers" ON workflow_webhook_triggers
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND has_automation_write_permission((select auth.uid()), org_id))
  WITH CHECK (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND has_automation_write_permission((select auth.uid()), org_id));

CREATE POLICY "Users with automation.manage can delete webhook triggers" ON workflow_webhook_triggers
  FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND has_automation_write_permission((select auth.uid()), org_id));

-- workflow_webhook_requests
DROP POLICY IF EXISTS "Users can view webhook requests in their org" ON workflow_webhook_requests;

CREATE POLICY "Users can view webhook requests in their org" ON workflow_webhook_requests
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

-- workflow_trigger_audit_log
DROP POLICY IF EXISTS "Users can view trigger audit logs in their org" ON workflow_trigger_audit_log;

CREATE POLICY "Users can view trigger audit logs in their org" ON workflow_trigger_audit_log
  FOR SELECT TO authenticated
  USING (org_id = (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND has_automation_permission('automation.view'));

-- scheduled_trigger_jobs
DROP POLICY IF EXISTS "Users can view scheduled jobs in their org" ON scheduled_trigger_jobs;
DROP POLICY IF EXISTS "Users can update scheduled jobs in their org" ON scheduled_trigger_jobs;
DROP POLICY IF EXISTS "Users can delete scheduled jobs in their org" ON scheduled_trigger_jobs;

CREATE POLICY "Users can view scheduled jobs in their org" ON scheduled_trigger_jobs
  FOR SELECT TO authenticated
  USING (org_id = (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND has_automation_permission('automation.view'));

CREATE POLICY "Users can update scheduled jobs in their org" ON scheduled_trigger_jobs
  FOR UPDATE TO authenticated
  USING (org_id = (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND has_automation_permission('automation.manage'))
  WITH CHECK (org_id = (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND has_automation_permission('automation.manage'));

CREATE POLICY "Users can delete scheduled jobs in their org" ON scheduled_trigger_jobs
  FOR DELETE TO authenticated
  USING (org_id = (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND has_automation_permission('automation.manage'));

-- payment_events
DROP POLICY IF EXISTS "Users can view their organization's payment events" ON payment_events;

CREATE POLICY "Users can view their organization's payment events" ON payment_events
  FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

-- drive_connections
DROP POLICY IF EXISTS "Users can view drive connection for their org" ON drive_connections;
DROP POLICY IF EXISTS "Users with media.manage can update drive connection" ON drive_connections;
DROP POLICY IF EXISTS "Users with media.manage can delete drive connection" ON drive_connections;

CREATE POLICY "Users can view drive connection for their org" ON drive_connections
  FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND has_media_permission((select auth.uid()), organization_id, 'media.view'));

CREATE POLICY "Users with media.manage can update drive connection" ON drive_connections
  FOR UPDATE TO authenticated
  USING (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND has_media_permission((select auth.uid()), organization_id, 'media.manage'))
  WITH CHECK (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND has_media_permission((select auth.uid()), organization_id, 'media.manage'));

CREATE POLICY "Users with media.manage can delete drive connection" ON drive_connections
  FOR DELETE TO authenticated
  USING (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND has_media_permission((select auth.uid()), organization_id, 'media.manage'));

-- drive_files
DROP POLICY IF EXISTS "Users can view drive files for their org" ON drive_files;
DROP POLICY IF EXISTS "Users with media.manage can update file records" ON drive_files;
DROP POLICY IF EXISTS "Users with media.manage can delete file records" ON drive_files;

CREATE POLICY "Users can view drive files for their org" ON drive_files
  FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND has_media_permission((select auth.uid()), organization_id, 'media.view'));

CREATE POLICY "Users with media.manage can update file records" ON drive_files
  FOR UPDATE TO authenticated
  USING (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND has_media_permission((select auth.uid()), organization_id, 'media.manage'))
  WITH CHECK (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND has_media_permission((select auth.uid()), organization_id, 'media.manage'));

CREATE POLICY "Users with media.manage can delete file records" ON drive_files
  FOR DELETE TO authenticated
  USING (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND has_media_permission((select auth.uid()), organization_id, 'media.manage'));

-- drive_folders
DROP POLICY IF EXISTS "Users can view drive folders for their org" ON drive_folders;
DROP POLICY IF EXISTS "Users with media.manage can update folder records" ON drive_folders;
DROP POLICY IF EXISTS "Users with media.manage can delete folder records" ON drive_folders;

CREATE POLICY "Users can view drive folders for their org" ON drive_folders
  FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND has_media_permission((select auth.uid()), organization_id, 'media.view'));

CREATE POLICY "Users with media.manage can update folder records" ON drive_folders
  FOR UPDATE TO authenticated
  USING (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND has_media_permission((select auth.uid()), organization_id, 'media.manage'))
  WITH CHECK (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND has_media_permission((select auth.uid()), organization_id, 'media.manage'));

CREATE POLICY "Users with media.manage can delete folder records" ON drive_folders
  FOR DELETE TO authenticated
  USING (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND has_media_permission((select auth.uid()), organization_id, 'media.manage'));

-- content_ai_generations - consolidate duplicate policies
DROP POLICY IF EXISTS "Users can delete own AI generations" ON content_ai_generations;
DROP POLICY IF EXISTS "Users can delete their AI generations" ON content_ai_generations;
DROP POLICY IF EXISTS "Users can update their AI generations" ON content_ai_generations;

CREATE POLICY "Users can update their AI generations" ON content_ai_generations
  FOR UPDATE TO authenticated
  USING (organization_id = get_user_org_id() AND user_id = (select auth.uid()));

CREATE POLICY "Users can delete their AI generations" ON content_ai_generations
  FOR DELETE TO authenticated
  USING (organization_id = get_user_org_id() AND user_id = (select auth.uid()));
