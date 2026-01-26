/*
  # Optimize RLS Policies - Opportunities and Payments Tables
  
  1. Changes
    - Optimizes RLS policies for opportunities, pipelines, stages (use org_id)
    - Optimizes RLS policies for invoices, payments, products (use org_id)
  
  2. Tables Affected
    - opportunities, pipelines, pipeline_stages (use org_id)
    - invoices, invoice_items, payments, products (use org_id)
  
  3. Security
    - No changes to actual security logic
    - Performance optimization only
*/

-- =============================================
-- OPPORTUNITIES TABLE (uses org_id)
-- =============================================

DROP POLICY IF EXISTS "Users can view opportunities in their organization" ON opportunities;
CREATE POLICY "Users can view opportunities in their organization"
  ON opportunities FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('opportunities:view'));

DROP POLICY IF EXISTS "Users can create opportunities in their organization" ON opportunities;
CREATE POLICY "Users can create opportunities in their organization"
  ON opportunities FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND has_permission('opportunities:create'));

DROP POLICY IF EXISTS "Users can update opportunities in their organization" ON opportunities;
CREATE POLICY "Users can update opportunities in their organization"
  ON opportunities FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('opportunities:edit'))
  WITH CHECK (org_id = get_user_org_id() AND has_permission('opportunities:edit'));

DROP POLICY IF EXISTS "Users can delete opportunities in their organization" ON opportunities;
CREATE POLICY "Users can delete opportunities in their organization"
  ON opportunities FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('opportunities:delete'));

-- =============================================
-- PIPELINES TABLE (uses org_id)
-- =============================================

DROP POLICY IF EXISTS "Users can view pipelines in their organization" ON pipelines;
CREATE POLICY "Users can view pipelines in their organization"
  ON pipelines FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can create pipelines in their organization" ON pipelines;
CREATE POLICY "Users can create pipelines in their organization"
  ON pipelines FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND has_permission('opportunities:manage_pipelines'));

DROP POLICY IF EXISTS "Users can update pipelines in their organization" ON pipelines;
CREATE POLICY "Users can update pipelines in their organization"
  ON pipelines FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('opportunities:manage_pipelines'))
  WITH CHECK (org_id = get_user_org_id() AND has_permission('opportunities:manage_pipelines'));

DROP POLICY IF EXISTS "Users can delete pipelines in their organization" ON pipelines;
CREATE POLICY "Users can delete pipelines in their organization"
  ON pipelines FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('opportunities:manage_pipelines'));

-- =============================================
-- PIPELINE_STAGES TABLE (uses org_id)
-- =============================================

DROP POLICY IF EXISTS "Users can view pipeline stages in their organization" ON pipeline_stages;
CREATE POLICY "Users can view pipeline stages in their organization"
  ON pipeline_stages FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can create pipeline stages" ON pipeline_stages;
CREATE POLICY "Users can create pipeline stages"
  ON pipeline_stages FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND has_permission('opportunities:manage_pipelines'));

DROP POLICY IF EXISTS "Users can update pipeline stages" ON pipeline_stages;
CREATE POLICY "Users can update pipeline stages"
  ON pipeline_stages FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('opportunities:manage_pipelines'))
  WITH CHECK (org_id = get_user_org_id() AND has_permission('opportunities:manage_pipelines'));

DROP POLICY IF EXISTS "Users can delete pipeline stages" ON pipeline_stages;
CREATE POLICY "Users can delete pipeline stages"
  ON pipeline_stages FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('opportunities:manage_pipelines'));

-- =============================================
-- INVOICES TABLE (uses org_id)
-- =============================================

DROP POLICY IF EXISTS "Users can view invoices in their organization" ON invoices;
CREATE POLICY "Users can view invoices in their organization"
  ON invoices FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('payments:view'));

DROP POLICY IF EXISTS "Users can create invoices in their organization" ON invoices;
CREATE POLICY "Users can create invoices in their organization"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND has_permission('payments:create'));

DROP POLICY IF EXISTS "Users can update invoices in their organization" ON invoices;
CREATE POLICY "Users can update invoices in their organization"
  ON invoices FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('payments:edit'))
  WITH CHECK (org_id = get_user_org_id() AND has_permission('payments:edit'));

DROP POLICY IF EXISTS "Users can delete invoices in their organization" ON invoices;
CREATE POLICY "Users can delete invoices in their organization"
  ON invoices FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('payments:delete'));

-- =============================================
-- PAYMENTS TABLE (uses org_id)
-- =============================================

DROP POLICY IF EXISTS "Users can view payments in their organization" ON payments;
CREATE POLICY "Users can view payments in their organization"
  ON payments FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('payments:view'));

DROP POLICY IF EXISTS "Users can create payments in their organization" ON payments;
CREATE POLICY "Users can create payments in their organization"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND has_permission('payments:create'));

DROP POLICY IF EXISTS "Users can update payments in their organization" ON payments;
CREATE POLICY "Users can update payments in their organization"
  ON payments FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('payments:edit'))
  WITH CHECK (org_id = get_user_org_id() AND has_permission('payments:edit'));

-- =============================================
-- PRODUCTS TABLE (uses org_id)
-- =============================================

DROP POLICY IF EXISTS "Users can view products in their organization" ON products;
CREATE POLICY "Users can view products in their organization"
  ON products FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can create products in their organization" ON products;
CREATE POLICY "Users can create products in their organization"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND has_permission('payments:manage_products'));

DROP POLICY IF EXISTS "Users can update products in their organization" ON products;
CREATE POLICY "Users can update products in their organization"
  ON products FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('payments:manage_products'))
  WITH CHECK (org_id = get_user_org_id() AND has_permission('payments:manage_products'));

DROP POLICY IF EXISTS "Users can delete products in their organization" ON products;
CREATE POLICY "Users can delete products in their organization"
  ON products FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('payments:manage_products'));