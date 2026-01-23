/*
  # Custom Fields Permissions and Seed Data

  ## Overview
  Adds permissions for the custom fields settings module and seeds sample
  field groups and custom fields for both contacts and opportunities.

  ## 1. New Permissions
  - `custom_fields.view` - View custom field definitions
  - `custom_fields.manage` - Create, edit, delete custom fields
  - `custom_fields.groups.manage` - Manage custom field groups

  ## 2. Role Assignments
  - SuperAdmin, Admin: Full access (view + manage)
  - Manager: View access only
  - Other roles: Inherit based on module access

  ## 3. Sample Data
  - Contact field groups: Lead Details, Qualification, Billing Info
  - Opportunity field groups: Deal Details, Requirements
  - Sample fields for each scope
*/

-- Add custom fields permissions
INSERT INTO permissions (key, description, module_name) VALUES
  ('custom_fields.view', 'View custom field definitions and groups', 'custom_fields'),
  ('custom_fields.manage', 'Create, edit, delete, and reorder custom fields', 'custom_fields'),
  ('custom_fields.groups.manage', 'Create, edit, delete, and reorder custom field groups', 'custom_fields')
ON CONFLICT (key) DO NOTHING;

-- Assign permissions to SuperAdmin (all permissions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r 
CROSS JOIN permissions p
WHERE r.name = 'SuperAdmin' 
  AND p.key IN ('custom_fields.view', 'custom_fields.manage', 'custom_fields.groups.manage')
ON CONFLICT DO NOTHING;

-- Assign permissions to Admin (all permissions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r 
CROSS JOIN permissions p
WHERE r.name = 'Admin' 
  AND p.key IN ('custom_fields.view', 'custom_fields.manage', 'custom_fields.groups.manage')
ON CONFLICT DO NOTHING;

-- Assign view permission to Manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r 
CROSS JOIN permissions p
WHERE r.name = 'Manager' 
  AND p.key = 'custom_fields.view'
ON CONFLICT DO NOTHING;

-- Assign view permission to ReadOnly
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r 
CROSS JOIN permissions p
WHERE r.name = 'ReadOnly' 
  AND p.key = 'custom_fields.view'
ON CONFLICT DO NOTHING;

-- Seed sample custom field groups (only if organization exists and groups don't exist)
DO $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Get the first organization
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  
  IF v_org_id IS NOT NULL THEN
    -- Contact field groups
    INSERT INTO custom_field_groups (organization_id, scope, name, sort_order)
    VALUES
      (v_org_id, 'contact', 'Lead Details', 0),
      (v_org_id, 'contact', 'Qualification', 1),
      (v_org_id, 'contact', 'Billing Info', 2)
    ON CONFLICT (organization_id, scope, name) DO NOTHING;
    
    -- Opportunity field groups
    INSERT INTO custom_field_groups (organization_id, scope, name, sort_order)
    VALUES
      (v_org_id, 'opportunity', 'Deal Details', 0),
      (v_org_id, 'opportunity', 'Requirements', 1)
    ON CONFLICT (organization_id, scope, name) DO NOTHING;
  END IF;
END $$;

-- Seed sample custom fields (only if organization exists and fields don't exist)
DO $$
DECLARE
  v_org_id uuid;
  v_lead_details_group_id uuid;
  v_qualification_group_id uuid;
  v_billing_group_id uuid;
  v_deal_details_group_id uuid;
  v_requirements_group_id uuid;
BEGIN
  -- Get the first organization
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  
  IF v_org_id IS NOT NULL THEN
    -- Get group IDs
    SELECT id INTO v_lead_details_group_id FROM custom_field_groups 
      WHERE organization_id = v_org_id AND scope = 'contact' AND name = 'Lead Details';
    SELECT id INTO v_qualification_group_id FROM custom_field_groups 
      WHERE organization_id = v_org_id AND scope = 'contact' AND name = 'Qualification';
    SELECT id INTO v_billing_group_id FROM custom_field_groups 
      WHERE organization_id = v_org_id AND scope = 'contact' AND name = 'Billing Info';
    SELECT id INTO v_deal_details_group_id FROM custom_field_groups 
      WHERE organization_id = v_org_id AND scope = 'opportunity' AND name = 'Deal Details';
    SELECT id INTO v_requirements_group_id FROM custom_field_groups 
      WHERE organization_id = v_org_id AND scope = 'opportunity' AND name = 'Requirements';
    
    -- Contact custom fields - Lead Details group
    INSERT INTO custom_fields (organization_id, scope, group_id, name, field_key, field_type, options, is_required, display_order, placeholder, help_text)
    VALUES
      (v_org_id, 'contact', v_lead_details_group_id, 'Lead Source', 'lead_source', 'select', 
        '["Website", "Referral", "Social Media", "Paid Ads", "Cold Call", "Trade Show", "Other"]'::jsonb,
        false, 0, 'Select source...', 'How did this lead find us?'),
      (v_org_id, 'contact', v_lead_details_group_id, 'Industry', 'industry', 'select',
        '["Technology", "Healthcare", "Finance", "Retail", "Manufacturing", "Real Estate", "Education", "Other"]'::jsonb,
        false, 1, 'Select industry...', 'Primary industry of the contact'),
      (v_org_id, 'contact', v_lead_details_group_id, 'Interests', 'interests', 'multi_select',
        '["Product A", "Product B", "Product C", "Consulting", "Support"]'::jsonb,
        false, 2, NULL, 'What products/services are they interested in?')
    ON CONFLICT (organization_id, scope, field_key) DO NOTHING;
    
    -- Contact custom fields - Qualification group
    INSERT INTO custom_fields (organization_id, scope, group_id, name, field_key, field_type, options, is_required, display_order, placeholder, help_text)
    VALUES
      (v_org_id, 'contact', v_qualification_group_id, 'Budget Range', 'budget_range', 'currency',
        NULL, false, 0, '0.00', 'Estimated budget for their project'),
      (v_org_id, 'contact', v_qualification_group_id, 'Decision Timeline', 'decision_timeline', 'select',
        '["Immediate", "1-3 Months", "3-6 Months", "6-12 Months", "Over 12 Months"]'::jsonb,
        false, 1, 'Select timeline...', 'When do they plan to make a decision?'),
      (v_org_id, 'contact', v_qualification_group_id, 'Next Follow-up', 'next_followup', 'date',
        NULL, false, 2, NULL, 'Scheduled date for next follow-up')
    ON CONFLICT (organization_id, scope, field_key) DO NOTHING;
    
    -- Contact custom fields - Billing Info group
    INSERT INTO custom_fields (organization_id, scope, group_id, name, field_key, field_type, options, is_required, display_order, placeholder, help_text)
    VALUES
      (v_org_id, 'contact', v_billing_group_id, 'Tax ID', 'tax_id', 'text',
        NULL, false, 0, 'Enter tax ID...', 'Company tax identification number'),
      (v_org_id, 'contact', v_billing_group_id, 'Preferred Payment Method', 'preferred_payment', 'select',
        '["Credit Card", "ACH/Bank Transfer", "Check", "Invoice Net 30"]'::jsonb,
        false, 1, 'Select method...', 'Preferred method of payment')
    ON CONFLICT (organization_id, scope, field_key) DO NOTHING;
    
    -- Opportunity custom fields - Deal Details group
    INSERT INTO custom_fields (organization_id, scope, group_id, name, field_key, field_type, options, is_required, display_order, placeholder, help_text)
    VALUES
      (v_org_id, 'opportunity', v_deal_details_group_id, 'Deal Type', 'deal_type', 'select',
        '["New Business", "Expansion", "Renewal", "Upsell", "Cross-sell"]'::jsonb,
        false, 0, 'Select type...', 'Type of deal/opportunity'),
      (v_org_id, 'opportunity', v_deal_details_group_id, 'Priority Score', 'priority_score', 'number',
        NULL, false, 1, '1-10', 'Priority ranking from 1 (low) to 10 (high)'),
      (v_org_id, 'opportunity', v_deal_details_group_id, 'Contract Signed', 'contract_signed', 'checkbox',
        NULL, false, 2, NULL, 'Has the contract been signed?')
    ON CONFLICT (organization_id, scope, field_key) DO NOTHING;
    
    -- Opportunity custom fields - Requirements group
    INSERT INTO custom_fields (organization_id, scope, group_id, name, field_key, field_type, options, is_required, display_order, placeholder, help_text)
    VALUES
      (v_org_id, 'opportunity', v_requirements_group_id, 'Implementation Date', 'implementation_date', 'date',
        NULL, false, 0, NULL, 'Target date for implementation'),
      (v_org_id, 'opportunity', v_requirements_group_id, 'Requirements Notes', 'requirements_notes', 'textarea',
        NULL, false, 1, 'Enter detailed requirements...', 'Detailed notes about project requirements'),
      (v_org_id, 'opportunity', v_requirements_group_id, 'Technical Review Complete', 'tech_review_complete', 'checkbox',
        NULL, false, 2, NULL, 'Has technical review been completed?')
    ON CONFLICT (organization_id, scope, field_key) DO NOTHING;
  END IF;
END $$;
