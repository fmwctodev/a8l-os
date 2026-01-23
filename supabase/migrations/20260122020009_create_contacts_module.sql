/*
  # Contacts Module - Core Tables

  ## Overview
  This migration creates all tables for the Contacts module including:
  - Contacts with department-based access control
  - Tags for categorization
  - Custom fields for org-wide extensibility
  - Notes and Tasks for contact activities
  - Timeline for activity history
  - Merge tracking for contact deduplication

  ## 1. New Tables

  ### contacts
  - `id` (uuid, primary key) - Unique identifier
  - `organization_id` (uuid, FK) - Reference to organization
  - `department_id` (uuid, FK) - Reference to department for access control
  - `owner_id` (uuid, FK, nullable) - Reference to user for accountability
  - `first_name` (text) - Contact first name
  - `last_name` (text) - Contact last name
  - `email` (text, nullable) - Primary email
  - `phone` (text, nullable) - Primary phone
  - `company` (text, nullable) - Company name
  - `job_title` (text, nullable) - Job title
  - `address_line1` (text, nullable) - Street address
  - `address_line2` (text, nullable) - Suite/apt
  - `city` (text, nullable) - City
  - `state` (text, nullable) - State/province
  - `postal_code` (text, nullable) - ZIP/postal code
  - `country` (text, nullable) - Country
  - `source` (text, nullable) - Lead source
  - `status` (text) - active, archived
  - `merged_into_contact_id` (uuid, nullable) - For merged contacts
  - `merged_at` (timestamptz, nullable) - When merged
  - `merged_by_user_id` (uuid, nullable) - Who performed merge
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  - `created_by_user_id` (uuid, nullable) - Who created

  ### tags
  - `id` (uuid, primary key) - Unique identifier
  - `organization_id` (uuid, FK) - Reference to organization
  - `name` (text) - Tag name
  - `color` (text) - Hex color for display
  - `created_at` (timestamptz) - Creation timestamp

  ### contact_tags (junction table)
  - `contact_id` (uuid, FK) - Reference to contact
  - `tag_id` (uuid, FK) - Reference to tag
  - Primary key is composite of both

  ### custom_fields
  - `id` (uuid, primary key) - Unique identifier
  - `organization_id` (uuid, FK) - Reference to organization (org-wide scope)
  - `name` (text) - Field display name
  - `field_key` (text) - Machine-readable key
  - `field_type` (text) - text, number, date, select, multi_select, boolean
  - `options` (jsonb, nullable) - Options for select fields
  - `is_required` (boolean) - Whether field is required
  - `display_order` (int) - Sort order for display
  - `created_at` (timestamptz) - Creation timestamp

  ### contact_custom_field_values
  - `id` (uuid, primary key) - Unique identifier
  - `contact_id` (uuid, FK) - Reference to contact
  - `custom_field_id` (uuid, FK) - Reference to custom field
  - `value` (jsonb) - Field value (supports all types)
  - Unique constraint on contact_id + custom_field_id

  ### contact_notes
  - `id` (uuid, primary key) - Unique identifier
  - `contact_id` (uuid, FK) - Reference to contact
  - `user_id` (uuid, FK) - Who created the note
  - `content` (text) - Note content
  - `is_pinned` (boolean) - Whether note is pinned
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### contact_tasks
  - `id` (uuid, primary key) - Unique identifier
  - `contact_id` (uuid, FK) - Reference to contact
  - `assigned_to_user_id` (uuid, FK, nullable) - Assigned user
  - `created_by_user_id` (uuid, FK) - Who created the task
  - `title` (text) - Task title
  - `description` (text, nullable) - Task details
  - `due_date` (timestamptz, nullable) - When task is due
  - `priority` (text) - low, medium, high
  - `status` (text) - pending, in_progress, completed, cancelled
  - `completed_at` (timestamptz, nullable) - When completed
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### contact_timeline
  - `id` (uuid, primary key) - Unique identifier
  - `contact_id` (uuid, FK) - Reference to contact
  - `user_id` (uuid, FK, nullable) - User who performed action
  - `event_type` (text) - created, updated, note_added, task_added, merged, etc.
  - `event_data` (jsonb) - Additional event data
  - `created_at` (timestamptz) - When event occurred

  ## 2. Security
  - RLS enabled on all tables
  - Policies created in separate migration for department-based access

  ## 3. Indexes
  - Optimized for common query patterns including department filtering
*/

CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
  first_name text NOT NULL,
  last_name text NOT NULL DEFAULT '',
  email text,
  phone text,
  company text,
  job_title text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  country text,
  source text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  merged_into_contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  merged_at timestamptz,
  merged_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3B82F6',
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(organization_id, name)
);

CREATE TABLE IF NOT EXISTS contact_tags (
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (contact_id, tag_id)
);

CREATE TABLE IF NOT EXISTS custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  field_key text NOT NULL,
  field_type text NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'select', 'multi_select', 'boolean')),
  options jsonb,
  is_required boolean NOT NULL DEFAULT false,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(organization_id, field_key)
);

CREATE TABLE IF NOT EXISTS contact_custom_field_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  custom_field_id uuid NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  value jsonb NOT NULL,
  UNIQUE(contact_id, custom_field_id)
);

CREATE TABLE IF NOT EXISTS contact_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS contact_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  assigned_to_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  due_date timestamptz,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS contact_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_data jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contacts_org ON contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_contacts_department ON contacts(department_id);
CREATE INDEX IF NOT EXISTS idx_contacts_owner ON contacts(owner_id);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_merged_into ON contacts(merged_into_contact_id) WHERE merged_into_contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(organization_id, last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(organization_id, company) WHERE company IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tags_org ON tags(organization_id);
CREATE INDEX IF NOT EXISTS idx_contact_tags_contact ON contact_tags(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_tags_tag ON contact_tags(tag_id);

CREATE INDEX IF NOT EXISTS idx_custom_fields_org ON custom_fields(organization_id);
CREATE INDEX IF NOT EXISTS idx_custom_field_values_contact ON contact_custom_field_values(contact_id);
CREATE INDEX IF NOT EXISTS idx_custom_field_values_field ON contact_custom_field_values(custom_field_id);

CREATE INDEX IF NOT EXISTS idx_contact_notes_contact ON contact_notes(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_notes_user ON contact_notes(user_id);

CREATE INDEX IF NOT EXISTS idx_contact_tasks_contact ON contact_tasks(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_tasks_assigned ON contact_tasks(assigned_to_user_id) WHERE assigned_to_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contact_tasks_status ON contact_tasks(status);
CREATE INDEX IF NOT EXISTS idx_contact_tasks_due ON contact_tasks(due_date) WHERE due_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contact_timeline_contact ON contact_timeline(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_timeline_created ON contact_timeline(created_at DESC);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_custom_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_timeline ENABLE ROW LEVEL SECURITY;
