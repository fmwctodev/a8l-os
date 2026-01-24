/*
  # Create Proposals Module Schema

  This migration creates the core tables for the Proposals module, which enables
  AI-powered proposal generation with meeting transcription integration and
  document management.

  ## 1. New Tables

  ### proposals
  - `id` (uuid, primary key) - Unique proposal identifier
  - `org_id` (uuid) - Organization that owns this proposal
  - `contact_id` (uuid) - Associated contact
  - `opportunity_id` (uuid, nullable) - Optional linked opportunity
  - `title` (text) - Proposal title
  - `status` (text) - draft, sent, viewed, accepted, rejected, expired
  - `content` (text) - Full proposal content (HTML/markdown)
  - `summary` (text, nullable) - AI-generated executive summary
  - `total_value` (numeric) - Total proposal value
  - `currency` (text) - Currency code (default USD)
  - `valid_until` (date, nullable) - Proposal expiration date
  - `sent_at` (timestamptz, nullable) - When proposal was sent
  - `viewed_at` (timestamptz, nullable) - First view timestamp
  - `responded_at` (timestamptz, nullable) - When client responded
  - `created_by` (uuid) - User who created the proposal
  - `assigned_user_id` (uuid, nullable) - Assigned owner
  - `template_id` (uuid, nullable) - Base template used
  - `ai_context` (jsonb) - Context data used for AI generation
  - `public_token` (text) - Unique token for public viewing
  - `created_at`, `updated_at` - Timestamps

  ### proposal_templates
  - `id` (uuid, primary key) - Unique template identifier
  - `org_id` (uuid) - Organization reference
  - `name` (text) - Template name
  - `description` (text, nullable) - Template description
  - `content` (text) - Template content with placeholders
  - `category` (text, nullable) - Template category
  - `is_default` (boolean) - Default template flag
  - `variables` (jsonb) - Available template variables
  - `created_by` (uuid) - Creator user
  - `created_at`, `updated_at` - Timestamps

  ### proposal_line_items
  - `id` (uuid, primary key) - Unique line item identifier
  - `org_id` (uuid) - Organization reference
  - `proposal_id` (uuid) - Parent proposal
  - `product_id` (uuid, nullable) - Optional linked product
  - `name` (text) - Item name
  - `description` (text, nullable) - Item description
  - `quantity` (numeric) - Quantity
  - `unit_price` (numeric) - Price per unit
  - `discount_percent` (numeric) - Discount percentage
  - `sort_order` (integer) - Display order
  - `created_at` - Timestamp

  ### proposal_sections
  - `id` (uuid, primary key) - Unique section identifier
  - `org_id` (uuid) - Organization reference
  - `proposal_id` (uuid) - Parent proposal
  - `title` (text) - Section title
  - `content` (text) - Section content
  - `section_type` (text) - intro, scope, pricing, terms, custom
  - `sort_order` (integer) - Display order
  - `ai_generated` (boolean) - Whether AI generated this section
  - `created_at`, `updated_at` - Timestamps

  ### proposal_comments
  - `id` (uuid, primary key) - Unique comment identifier
  - `org_id` (uuid) - Organization reference
  - `proposal_id` (uuid) - Parent proposal
  - `user_id` (uuid, nullable) - Internal user comment
  - `is_client_comment` (boolean) - Whether from client
  - `client_name` (text, nullable) - Client name if external
  - `content` (text) - Comment content
  - `created_at` - Timestamp

  ### proposal_activities
  - `id` (uuid, primary key) - Unique activity identifier
  - `org_id` (uuid) - Organization reference
  - `proposal_id` (uuid) - Parent proposal
  - `activity_type` (text) - created, sent, viewed, commented, status_changed
  - `description` (text) - Activity description
  - `metadata` (jsonb) - Additional activity data
  - `actor_user_id` (uuid, nullable) - User who performed action
  - `created_at` - Timestamp

  ## 2. Indexes
  - Performance indexes on all foreign keys and commonly filtered columns
  - Index on public_token for public access lookups
  - Composite indexes for common query patterns

  ## 3. Important Notes
  - All tables have RLS enabled (policies in separate migration)
  - Proposals can exist without opportunity linkage
  - public_token enables sharing proposals with clients without auth
*/

-- Proposal templates table
CREATE TABLE IF NOT EXISTS proposal_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  content text NOT NULL DEFAULT '',
  category text,
  is_default boolean NOT NULL DEFAULT false,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, name)
);

-- Proposals table
CREATE TABLE IF NOT EXISTS proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES opportunities(id) ON DELETE SET NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired')),
  content text NOT NULL DEFAULT '',
  summary text,
  total_value numeric(15, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  valid_until date,
  sent_at timestamptz,
  viewed_at timestamptz,
  responded_at timestamptz,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  assigned_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  template_id uuid REFERENCES proposal_templates(id) ON DELETE SET NULL,
  ai_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  public_token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(public_token)
);

-- Proposal line items table
CREATE TABLE IF NOT EXISTS proposal_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  proposal_id uuid NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  quantity numeric(15, 4) NOT NULL DEFAULT 1,
  unit_price numeric(15, 2) NOT NULL DEFAULT 0,
  discount_percent numeric(5, 2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Proposal sections table
CREATE TABLE IF NOT EXISTS proposal_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  proposal_id uuid NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  section_type text NOT NULL DEFAULT 'custom' CHECK (section_type IN ('intro', 'scope', 'deliverables', 'timeline', 'pricing', 'terms', 'custom')),
  sort_order integer NOT NULL DEFAULT 0,
  ai_generated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Proposal comments table
CREATE TABLE IF NOT EXISTS proposal_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  proposal_id uuid NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  is_client_comment boolean NOT NULL DEFAULT false,
  client_name text,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Proposal activities table
CREATE TABLE IF NOT EXISTS proposal_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  proposal_id uuid NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  activity_type text NOT NULL CHECK (activity_type IN ('created', 'updated', 'sent', 'viewed', 'commented', 'status_changed', 'ai_generated')),
  description text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for proposal_templates
CREATE INDEX IF NOT EXISTS idx_proposal_templates_org ON proposal_templates(org_id);
CREATE INDEX IF NOT EXISTS idx_proposal_templates_category ON proposal_templates(org_id, category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proposal_templates_default ON proposal_templates(org_id, is_default) WHERE is_default = true;

-- Indexes for proposals
CREATE INDEX IF NOT EXISTS idx_proposals_org ON proposals(org_id);
CREATE INDEX IF NOT EXISTS idx_proposals_contact ON proposals(contact_id);
CREATE INDEX IF NOT EXISTS idx_proposals_opportunity ON proposals(opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(org_id, status);
CREATE INDEX IF NOT EXISTS idx_proposals_assigned ON proposals(org_id, assigned_user_id) WHERE assigned_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proposals_created_by ON proposals(created_by);
CREATE INDEX IF NOT EXISTS idx_proposals_created_at ON proposals(created_at);
CREATE INDEX IF NOT EXISTS idx_proposals_public_token ON proposals(public_token);
CREATE INDEX IF NOT EXISTS idx_proposals_valid_until ON proposals(valid_until) WHERE valid_until IS NOT NULL;

-- Indexes for proposal_line_items
CREATE INDEX IF NOT EXISTS idx_proposal_line_items_proposal ON proposal_line_items(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_line_items_product ON proposal_line_items(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proposal_line_items_sort ON proposal_line_items(proposal_id, sort_order);

-- Indexes for proposal_sections
CREATE INDEX IF NOT EXISTS idx_proposal_sections_proposal ON proposal_sections(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_sections_sort ON proposal_sections(proposal_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_proposal_sections_type ON proposal_sections(proposal_id, section_type);

-- Indexes for proposal_comments
CREATE INDEX IF NOT EXISTS idx_proposal_comments_proposal ON proposal_comments(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_comments_created ON proposal_comments(created_at);

-- Indexes for proposal_activities
CREATE INDEX IF NOT EXISTS idx_proposal_activities_proposal ON proposal_activities(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_activities_type ON proposal_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_proposal_activities_created ON proposal_activities(created_at);

-- Enable RLS on all new tables
ALTER TABLE proposal_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_activities ENABLE ROW LEVEL SECURITY;

-- Update triggers for updated_at
CREATE OR REPLACE FUNCTION update_proposals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_proposal_templates_updated_at
  BEFORE UPDATE ON proposal_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_proposals_updated_at();

CREATE TRIGGER set_proposals_updated_at
  BEFORE UPDATE ON proposals
  FOR EACH ROW
  EXECUTE FUNCTION update_proposals_updated_at();

CREATE TRIGGER set_proposal_sections_updated_at
  BEFORE UPDATE ON proposal_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_proposals_updated_at();
