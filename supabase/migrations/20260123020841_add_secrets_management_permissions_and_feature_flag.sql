/*
  # Permissions and Feature Flag for API Keys & Secrets Management
  
  1. Overview
    - Adds feature flag to enable/disable secrets management module
    - Creates permissions for secrets operations
    - Assigns permissions to SuperAdmin and Admin roles
  
  2. Permissions Added
    - secrets.view - View secrets metadata (no values)
    - secrets.create - Create new secrets
    - secrets.edit - Edit existing secrets
    - secrets.delete - Delete secrets
    - secrets.reveal - Reveal/decrypt secret values
    - secrets.logs - View usage/audit logs
    - secrets.categories - Manage secret categories
    - secrets.dynamic_refs - Create/manage dynamic references
  
  3. Feature Flag
    - secrets_management - Enables the entire module
*/

-- Insert feature flag for secrets management
INSERT INTO feature_flags (key, enabled, description)
VALUES (
  'secrets_management',
  true,
  'API Keys & Secrets Management module - secure storage and management of sensitive credentials'
)
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description;

-- Insert permissions for secrets management
INSERT INTO permissions (key, description, module_name) VALUES
  ('secrets.view', 'View secrets metadata without revealing values', 'secrets'),
  ('secrets.create', 'Create new API keys and secrets', 'secrets'),
  ('secrets.edit', 'Edit existing secrets', 'secrets'),
  ('secrets.delete', 'Delete secrets', 'secrets'),
  ('secrets.reveal', 'Reveal and decrypt secret values', 'secrets'),
  ('secrets.logs', 'View secret usage and audit logs', 'secrets'),
  ('secrets.categories', 'Manage secret categories', 'secrets'),
  ('secrets.dynamic_refs', 'Create and manage dynamic reference paths', 'secrets')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  module_name = EXCLUDED.module_name;

-- Assign all secrets permissions to SuperAdmin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'SuperAdmin'
AND p.key IN (
  'secrets.view',
  'secrets.create',
  'secrets.edit',
  'secrets.delete',
  'secrets.reveal',
  'secrets.logs',
  'secrets.categories',
  'secrets.dynamic_refs'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign most secrets permissions to Admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Admin'
AND p.key IN (
  'secrets.view',
  'secrets.create',
  'secrets.edit',
  'secrets.delete',
  'secrets.reveal',
  'secrets.logs',
  'secrets.categories',
  'secrets.dynamic_refs'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign view-only permission to Manager role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Manager'
AND p.key IN (
  'secrets.view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Seed default categories for the default organization
INSERT INTO secret_categories (org_id, name, description, icon, sort_order)
SELECT 
  o.id,
  cat.name,
  cat.description,
  cat.icon,
  cat.sort_order
FROM organizations o
CROSS JOIN (
  VALUES 
    ('Payment Gateways', 'API keys for payment processors like Stripe, PayPal', 'credit-card', 1),
    ('AI & ML Services', 'API keys for AI services like OpenAI, Anthropic, ElevenLabs', 'brain', 2),
    ('Communication', 'API keys for Twilio, SendGrid, email services', 'mail', 3),
    ('Cloud Storage', 'Credentials for AWS, Google Cloud, Azure', 'cloud', 4),
    ('Social Media', 'API tokens for social media platforms', 'share-2', 5),
    ('Analytics', 'Keys for analytics and tracking services', 'bar-chart-2', 6),
    ('Internal', 'Internal system credentials and tokens', 'lock', 7),
    ('Other', 'Miscellaneous API keys and secrets', 'key', 99)
) AS cat(name, description, icon, sort_order)
WHERE o.name = 'Default Organization'
ON CONFLICT (org_id, name) DO NOTHING;