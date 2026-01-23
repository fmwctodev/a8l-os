/*
  # Create Payments/Invoicing Module

  This migration creates the core tables for the Payments module, enabling
  QuickBooks Online integration for invoicing, payments, and recurring billing.

  ## 1. New Tables

  ### qbo_connections
  - `id` (uuid, primary key) - Unique connection identifier
  - `org_id` (uuid) - Organization that owns this connection (one per org)
  - `realm_id` (text) - QBO company/realm ID
  - `company_name` (text) - QBO company name for display
  - `access_token_encrypted` (text) - Encrypted OAuth access token
  - `refresh_token_encrypted` (text) - Encrypted OAuth refresh token
  - `token_expiry` (timestamptz) - When access token expires
  - `last_sync_at` (timestamptz) - Last successful sync timestamp
  - `connected_by` (uuid) - User who connected the account
  - `created_at`, `updated_at` - Timestamps

  ### products
  - `id` (uuid, primary key) - Unique product identifier
  - `org_id` (uuid) - Organization reference
  - `name` (text) - Product/service name
  - `description` (text) - Description shown on invoices
  - `price_amount` (numeric) - Unit price
  - `currency` (text) - Currency code (default USD)
  - `billing_type` (text) - one_time or recurring
  - `qbo_item_id` (text) - Linked QBO Item ID
  - `income_account` (text) - QBO income account reference
  - `active` (boolean) - Whether product can be used
  - `created_by` (uuid) - User who created
  - `created_at`, `updated_at` - Timestamps

  ### invoices
  - `id` (uuid, primary key) - Unique invoice identifier
  - `org_id` (uuid) - Organization reference
  - `contact_id` (uuid) - Required contact link
  - `opportunity_id` (uuid) - Optional opportunity link
  - `qbo_invoice_id` (text) - QBO Invoice ID for sync
  - `doc_number` (text) - Invoice number (from QBO or local)
  - `status` (text) - draft, sent, paid, overdue, void
  - `subtotal` (numeric) - Pre-discount amount
  - `discount_amount` (numeric) - Discount applied
  - `discount_type` (text) - flat or percentage
  - `total` (numeric) - Final amount
  - `currency` (text) - Currency code
  - `due_date` (date) - Payment due date
  - `payment_link_url` (text) - QBO hosted payment page URL
  - `memo` (text) - Customer-facing notes
  - `internal_notes` (text) - Internal notes
  - `sent_at` (timestamptz) - When invoice was sent
  - `paid_at` (timestamptz) - When invoice was fully paid
  - `voided_at` (timestamptz) - When invoice was voided
  - `created_by` (uuid) - User who created
  - `created_at`, `updated_at` - Timestamps

  ### invoice_line_items
  - `id` (uuid, primary key) - Unique line item identifier
  - `org_id` (uuid) - Organization reference
  - `invoice_id` (uuid) - Parent invoice
  - `product_id` (uuid) - Optional product link
  - `description` (text) - Line item description
  - `quantity` (numeric) - Quantity
  - `unit_price` (numeric) - Price per unit
  - `total_price` (numeric) - Calculated total (qty * unit price)
  - `sort_order` (integer) - Display order
  - `created_at` - Timestamp

  ### payments
  - `id` (uuid, primary key) - Unique payment identifier
  - `org_id` (uuid) - Organization reference
  - `contact_id` (uuid) - Contact who paid
  - `invoice_id` (uuid) - Invoice being paid
  - `qbo_payment_id` (text) - QBO Payment ID
  - `amount` (numeric) - Payment amount
  - `currency` (text) - Currency code
  - `payment_method` (text) - credit_card, bank_transfer, cash, check, other
  - `reference_number` (text) - External reference
  - `received_at` (timestamptz) - When payment was received
  - `created_at` - Timestamp

  ### recurring_profiles
  - `id` (uuid, primary key) - Unique profile identifier
  - `org_id` (uuid) - Organization reference
  - `contact_id` (uuid) - Contact for recurring invoices
  - `qbo_recurring_template_id` (text) - QBO recurring template ID
  - `name` (text) - Profile name
  - `frequency` (text) - weekly, monthly, quarterly, annually
  - `status` (text) - active, paused, cancelled
  - `next_invoice_date` (date) - Next scheduled invoice
  - `end_date` (date) - Optional end date
  - `auto_send` (boolean) - Auto-send generated invoices
  - `created_by` (uuid) - User who created
  - `created_at`, `updated_at` - Timestamps

  ### recurring_profile_items
  - `id` (uuid, primary key) - Unique item identifier
  - `org_id` (uuid) - Organization reference
  - `recurring_profile_id` (uuid) - Parent profile
  - `product_id` (uuid) - Optional product link
  - `description` (text) - Item description
  - `quantity` (numeric) - Quantity
  - `unit_price` (numeric) - Price per unit
  - `sort_order` (integer) - Display order
  - `created_at` - Timestamp

  ### qbo_webhook_logs
  - `id` (uuid, primary key) - Unique log identifier
  - `org_id` (uuid) - Organization reference
  - `webhook_id` (text) - QBO webhook event ID for idempotency
  - `event_type` (text) - Event type from QBO
  - `payload` (jsonb) - Full webhook payload
  - `processed_at` (timestamptz) - When processed
  - `created_at` - Timestamp

  ## 2. Indexes
  - Performance indexes on all foreign keys
  - Status and date range indexes for common queries
  - Idempotency index on webhook logs

  ## 3. Important Notes
  - QBO connection is unique per organization (one-to-one)
  - Invoices always require a contact
  - RLS enabled on all tables (policies in separate migration)
*/

-- QBO connections table (one per organization)
CREATE TABLE IF NOT EXISTS qbo_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  realm_id text NOT NULL,
  company_name text NOT NULL,
  access_token_encrypted text NOT NULL,
  refresh_token_encrypted text NOT NULL,
  token_expiry timestamptz NOT NULL,
  last_sync_at timestamptz,
  connected_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id)
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price_amount numeric(15, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  billing_type text NOT NULL DEFAULT 'one_time' CHECK (billing_type IN ('one_time', 'recurring')),
  qbo_item_id text,
  income_account text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, name)
);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  opportunity_id uuid REFERENCES opportunities(id) ON DELETE SET NULL,
  qbo_invoice_id text,
  doc_number text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'void')),
  subtotal numeric(15, 2) NOT NULL DEFAULT 0,
  discount_amount numeric(15, 2) NOT NULL DEFAULT 0,
  discount_type text DEFAULT 'flat' CHECK (discount_type IN ('flat', 'percentage')),
  total numeric(15, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  due_date date,
  payment_link_url text,
  memo text,
  internal_notes text,
  sent_at timestamptz,
  paid_at timestamptz,
  voided_at timestamptz,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Invoice line items table
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity numeric(10, 2) NOT NULL DEFAULT 1,
  unit_price numeric(15, 2) NOT NULL DEFAULT 0,
  total_price numeric(15, 2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  qbo_payment_id text,
  amount numeric(15, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  payment_method text NOT NULL DEFAULT 'other' CHECK (payment_method IN ('credit_card', 'bank_transfer', 'cash', 'check', 'other')),
  reference_number text,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Recurring profiles table
CREATE TABLE IF NOT EXISTS recurring_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  qbo_recurring_template_id text,
  name text NOT NULL,
  frequency text NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'annually')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  next_invoice_date date,
  end_date date,
  auto_send boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Recurring profile items table
CREATE TABLE IF NOT EXISTS recurring_profile_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recurring_profile_id uuid NOT NULL REFERENCES recurring_profiles(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity numeric(10, 2) NOT NULL DEFAULT 1,
  unit_price numeric(15, 2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- QBO webhook logs for idempotency
CREATE TABLE IF NOT EXISTS qbo_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  webhook_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, webhook_id)
);

-- Indexes for qbo_connections
CREATE INDEX IF NOT EXISTS idx_qbo_connections_org ON qbo_connections(org_id);
CREATE INDEX IF NOT EXISTS idx_qbo_connections_realm ON qbo_connections(realm_id);

-- Indexes for products
CREATE INDEX IF NOT EXISTS idx_products_org ON products(org_id);
CREATE INDEX IF NOT EXISTS idx_products_org_active ON products(org_id, active);
CREATE INDEX IF NOT EXISTS idx_products_org_billing ON products(org_id, billing_type);
CREATE INDEX IF NOT EXISTS idx_products_qbo_item ON products(qbo_item_id) WHERE qbo_item_id IS NOT NULL;

-- Indexes for invoices
CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org_status ON invoices(org_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_org_contact ON invoices(org_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org_opportunity ON invoices(org_id, opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date) WHERE status NOT IN ('paid', 'void');
CREATE INDEX IF NOT EXISTS idx_invoices_qbo_id ON invoices(qbo_invoice_id) WHERE qbo_invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);

-- Indexes for invoice_line_items
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice ON invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_product ON invoice_line_items(product_id) WHERE product_id IS NOT NULL;

-- Indexes for payments
CREATE INDEX IF NOT EXISTS idx_payments_org ON payments(org_id);
CREATE INDEX IF NOT EXISTS idx_payments_org_contact ON payments(org_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_qbo_id ON payments(qbo_payment_id) WHERE qbo_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_received_at ON payments(received_at);

-- Indexes for recurring_profiles
CREATE INDEX IF NOT EXISTS idx_recurring_profiles_org ON recurring_profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_recurring_profiles_org_contact ON recurring_profiles(org_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_recurring_profiles_org_status ON recurring_profiles(org_id, status);
CREATE INDEX IF NOT EXISTS idx_recurring_profiles_next_date ON recurring_profiles(next_invoice_date) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_recurring_profiles_qbo ON recurring_profiles(qbo_recurring_template_id) WHERE qbo_recurring_template_id IS NOT NULL;

-- Indexes for recurring_profile_items
CREATE INDEX IF NOT EXISTS idx_recurring_profile_items_profile ON recurring_profile_items(recurring_profile_id);

-- Indexes for qbo_webhook_logs
CREATE INDEX IF NOT EXISTS idx_qbo_webhook_logs_org ON qbo_webhook_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_qbo_webhook_logs_event ON qbo_webhook_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_qbo_webhook_logs_created ON qbo_webhook_logs(created_at);

-- Enable RLS on all tables
ALTER TABLE qbo_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_profile_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE qbo_webhook_logs ENABLE ROW LEVEL SECURITY;

-- Update triggers for updated_at
CREATE OR REPLACE FUNCTION update_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_qbo_connections_updated_at
  BEFORE UPDATE ON qbo_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_payments_updated_at();

CREATE TRIGGER set_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_payments_updated_at();

CREATE TRIGGER set_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_payments_updated_at();

CREATE TRIGGER set_recurring_profiles_updated_at
  BEFORE UPDATE ON recurring_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_payments_updated_at();