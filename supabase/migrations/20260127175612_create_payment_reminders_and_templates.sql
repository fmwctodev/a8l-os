/*
  # Create Payment Reminders and Invoice Templates

  This migration adds tables for payment reminder scheduling and invoice templates.

  ## 1. New Tables

  ### payment_reminders
  - `id` (uuid, primary key) - Unique reminder identifier
  - `org_id` (uuid) - Organization reference
  - `invoice_id` (uuid) - Invoice to remind about
  - `reminder_type` (text) - first_notice, second_notice, third_notice, final_notice
  - `scheduled_for` (timestamptz) - When reminder should be sent
  - `sent_at` (timestamptz) - When reminder was actually sent
  - `channel` (text) - email, sms, both
  - `status` (text) - pending, sent, failed, cancelled
  - `error_message` (text) - Error details if failed
  - `created_at`, `updated_at` - Timestamps

  ### payment_reminder_settings
  - `id` (uuid, primary key) - Settings identifier
  - `org_id` (uuid, unique) - One per organization
  - `enabled` (boolean) - Enable/disable automatic reminders
  - `first_reminder_days` (integer) - Days before due date for first reminder
  - `second_reminder_days` (integer) - Days after due date for second reminder
  - `third_reminder_days` (integer) - Days after due date for third reminder
  - `final_reminder_days` (integer) - Days after due date for final notice
  - `channels` (text[]) - Default channels (email, sms)
  - `email_template_subject` (text) - Custom email subject
  - `email_template_body` (text) - Custom email body with placeholders
  - `sms_template` (text) - Custom SMS template
  - `created_at`, `updated_at` - Timestamps

  ### invoice_templates
  - `id` (uuid, primary key) - Template identifier
  - `org_id` (uuid) - Organization reference
  - `name` (text) - Template name
  - `description` (text) - Template description
  - `is_default` (boolean) - Whether this is the default template
  - `logo_url` (text) - Custom logo for invoices
  - `header_text` (text) - Header content
  - `footer_text` (text) - Footer/terms content
  - `accent_color` (text) - Brand color for the template
  - `show_payment_instructions` (boolean) - Show payment details
  - `payment_instructions` (text) - Custom payment instructions
  - `created_by` (uuid) - User who created
  - `created_at`, `updated_at` - Timestamps

  ## 2. Columns Added to Existing Tables

  ### invoices
  - `template_id` (uuid) - Optional link to invoice template
  - `last_reminder_sent_at` (timestamptz) - When last reminder was sent
  - `reminder_count` (integer) - Number of reminders sent

  ## 3. Security
  - RLS enabled on all new tables
  - Policies restrict access based on organization membership and permissions
*/

-- Payment reminders table
CREATE TABLE IF NOT EXISTS payment_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  reminder_type text NOT NULL DEFAULT 'first_notice' CHECK (reminder_type IN ('first_notice', 'second_notice', 'third_notice', 'final_notice', 'custom')),
  scheduled_for timestamptz NOT NULL,
  sent_at timestamptz,
  channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms', 'both')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  error_message text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Payment reminder settings (one per org)
CREATE TABLE IF NOT EXISTS payment_reminder_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  first_reminder_days integer NOT NULL DEFAULT -3,
  second_reminder_days integer NOT NULL DEFAULT 1,
  third_reminder_days integer NOT NULL DEFAULT 7,
  final_reminder_days integer NOT NULL DEFAULT 14,
  channels text[] NOT NULL DEFAULT ARRAY['email']::text[],
  email_template_subject text DEFAULT 'Payment Reminder: Invoice {{invoice_number}} Due {{due_date}}',
  email_template_body text DEFAULT 'Dear {{contact_name}},

This is a friendly reminder that invoice {{invoice_number}} for {{invoice_total}} is {{status_text}}.

{{#if is_overdue}}
This invoice was due on {{due_date}}. Please arrange payment at your earliest convenience.
{{else}}
This invoice is due on {{due_date}}.
{{/if}}

You can view and pay your invoice online: {{payment_link}}

If you have already made this payment, please disregard this notice.

Thank you for your business!

{{company_name}}',
  sms_template text DEFAULT 'Reminder: Invoice {{invoice_number}} ({{invoice_total}}) is {{status_text}}. Pay now: {{payment_link}}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id)
);

-- Invoice templates table
CREATE TABLE IF NOT EXISTS invoice_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_default boolean NOT NULL DEFAULT false,
  logo_url text,
  header_text text,
  footer_text text DEFAULT 'Thank you for your business!',
  accent_color text DEFAULT '#2563eb',
  show_payment_instructions boolean NOT NULL DEFAULT true,
  payment_instructions text,
  include_due_date boolean NOT NULL DEFAULT true,
  include_invoice_number boolean NOT NULL DEFAULT true,
  include_line_item_descriptions boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, name)
);

-- Add template_id and reminder tracking to invoices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'template_id'
  ) THEN
    ALTER TABLE invoices ADD COLUMN template_id uuid REFERENCES invoice_templates(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'last_reminder_sent_at'
  ) THEN
    ALTER TABLE invoices ADD COLUMN last_reminder_sent_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'reminder_count'
  ) THEN
    ALTER TABLE invoices ADD COLUMN reminder_count integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Indexes for payment_reminders
CREATE INDEX IF NOT EXISTS idx_payment_reminders_org ON payment_reminders(org_id);
CREATE INDEX IF NOT EXISTS idx_payment_reminders_invoice ON payment_reminders(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_reminders_scheduled ON payment_reminders(scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_payment_reminders_status ON payment_reminders(org_id, status);

-- Indexes for payment_reminder_settings
CREATE INDEX IF NOT EXISTS idx_payment_reminder_settings_org ON payment_reminder_settings(org_id);

-- Indexes for invoice_templates
CREATE INDEX IF NOT EXISTS idx_invoice_templates_org ON invoice_templates(org_id);
CREATE INDEX IF NOT EXISTS idx_invoice_templates_default ON invoice_templates(org_id, is_default) WHERE is_default = true;

-- Index for template_id on invoices
CREATE INDEX IF NOT EXISTS idx_invoices_template ON invoices(template_id) WHERE template_id IS NOT NULL;

-- Enable RLS
ALTER TABLE payment_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_reminder_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payment_reminders
CREATE POLICY "payment_reminders_select"
  ON payment_reminders FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "payment_reminders_insert"
  ON payment_reminders FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "payment_reminders_update"
  ON payment_reminders FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "payment_reminders_delete"
  ON payment_reminders FOR DELETE
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  );

-- RLS Policies for payment_reminder_settings
CREATE POLICY "payment_reminder_settings_select"
  ON payment_reminder_settings FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "payment_reminder_settings_insert"
  ON payment_reminder_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "payment_reminder_settings_update"
  ON payment_reminder_settings FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  );

-- RLS Policies for invoice_templates
CREATE POLICY "invoice_templates_select"
  ON invoice_templates FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "invoice_templates_insert"
  ON invoice_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "invoice_templates_update"
  ON invoice_templates FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "invoice_templates_delete"
  ON invoice_templates FOR DELETE
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  );

-- Update trigger for new tables
CREATE TRIGGER set_payment_reminders_updated_at
  BEFORE UPDATE ON payment_reminders
  FOR EACH ROW
  EXECUTE FUNCTION update_payments_updated_at();

CREATE TRIGGER set_payment_reminder_settings_updated_at
  BEFORE UPDATE ON payment_reminder_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_payments_updated_at();

CREATE TRIGGER set_invoice_templates_updated_at
  BEFORE UPDATE ON invoice_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_payments_updated_at();

-- Seed default reminder settings for existing organizations
INSERT INTO payment_reminder_settings (org_id)
SELECT id FROM organizations
WHERE id NOT IN (SELECT org_id FROM payment_reminder_settings)
ON CONFLICT (org_id) DO NOTHING;