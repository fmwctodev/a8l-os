/*
  # Seed Payments Sample Data

  This migration adds sample data for the payments module:

  1. Sample Products
    - Basic Consulting - hourly consulting service
    - Website Design - one-time website design package
    - Monthly Retainer - recurring monthly retainer service
    - SEO Package - search engine optimization service
    - Custom Development - custom software development

  2. Security
    - All products are assigned to the default organization
    - Products are marked as active for immediate use

  3. Notes
    - This seed data provides a starting point for testing the payments module
    - Products can be used when creating invoices
*/

DO $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM organizations LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE NOTICE 'No organization found, skipping payments seed data';
    RETURN;
  END IF;

  INSERT INTO products (org_id, name, description, price_amount, currency, billing_type, active)
  VALUES
    (v_org_id, 'Basic Consulting', 'Hourly consulting services for business strategy and optimization', 150.00, 'USD', 'one_time', true),
    (v_org_id, 'Website Design Package', 'Complete website design including mockups, revisions, and final delivery', 2500.00, 'USD', 'one_time', true),
    (v_org_id, 'Monthly Marketing Retainer', 'Ongoing marketing support including content creation and social media management', 1500.00, 'USD', 'recurring', true),
    (v_org_id, 'SEO Optimization Package', 'Complete SEO audit and optimization for improved search rankings', 750.00, 'USD', 'one_time', true),
    (v_org_id, 'Custom Software Development', 'Hourly rate for custom application development', 175.00, 'USD', 'one_time', true),
    (v_org_id, 'Maintenance & Support', 'Monthly maintenance and technical support package', 500.00, 'USD', 'recurring', true),
    (v_org_id, 'Training Workshop', 'Half-day training workshop for up to 10 participants', 1200.00, 'USD', 'one_time', true),
    (v_org_id, 'Premium Support Plan', 'Priority support with guaranteed response times', 250.00, 'USD', 'recurring', true)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Payments sample data seeded successfully';
END $$;
