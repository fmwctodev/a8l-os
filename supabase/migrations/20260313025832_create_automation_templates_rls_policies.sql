/*
  # RLS Policies for Automation Templates Module

  1. automation_templates
    - SELECT: System templates (is_system = true) readable by all authenticated users;
              org templates readable by org members with automation.view
    - INSERT: Users with automation.manage can create org templates
    - UPDATE: Users with automation.manage can update their org templates (not system)
    - DELETE: Users with automation.manage can delete their org templates (not system)

  2. automation_template_versions
    - SELECT: Readable if the parent template is readable
    - INSERT: Users with automation.manage can create versions for their org templates

  3. automation_template_instances
    - SELECT: Users with automation.view can see instances in their org
    - INSERT: Users with automation.manage can instantiate templates
*/

-- automation_templates policies

CREATE POLICY "Anyone can view system templates"
  ON automation_templates FOR SELECT
  TO authenticated
  USING (is_system = true AND status = 'published');

CREATE POLICY "Users can view org templates in their org"
  ON automation_templates FOR SELECT
  TO authenticated
  USING (
    is_system = false
    AND org_id = get_user_org_id()
    AND has_permission('automation.view')
  );

CREATE POLICY "Users can create org templates"
  ON automation_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    is_system = false
    AND org_id = get_user_org_id()
    AND has_permission('automation.manage')
  );

CREATE POLICY "Users can update org templates"
  ON automation_templates FOR UPDATE
  TO authenticated
  USING (
    is_system = false
    AND org_id = get_user_org_id()
    AND has_permission('automation.manage')
  )
  WITH CHECK (
    is_system = false
    AND org_id = get_user_org_id()
    AND has_permission('automation.manage')
  );

CREATE POLICY "Users can delete org templates"
  ON automation_templates FOR DELETE
  TO authenticated
  USING (
    is_system = false
    AND org_id = get_user_org_id()
    AND has_permission('automation.manage')
  );

-- automation_template_versions policies

CREATE POLICY "Anyone can view system template versions"
  ON automation_template_versions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM automation_templates t
      WHERE t.id = automation_template_versions.template_id
      AND t.is_system = true
      AND t.status = 'published'
    )
  );

CREATE POLICY "Users can view org template versions"
  ON automation_template_versions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM automation_templates t
      WHERE t.id = automation_template_versions.template_id
      AND t.is_system = false
      AND t.org_id = get_user_org_id()
      AND has_permission('automation.view')
    )
  );

CREATE POLICY "Users can create org template versions"
  ON automation_template_versions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM automation_templates t
      WHERE t.id = automation_template_versions.template_id
      AND t.is_system = false
      AND t.org_id = get_user_org_id()
      AND has_permission('automation.manage')
    )
  );

-- automation_template_instances policies

CREATE POLICY "Users can view template instances in their org"
  ON automation_template_instances FOR SELECT
  TO authenticated
  USING (
    org_id = get_user_org_id()
    AND has_permission('automation.view')
  );

CREATE POLICY "Users can create template instances"
  ON automation_template_instances FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = get_user_org_id()
    AND has_permission('automation.manage')
  );
