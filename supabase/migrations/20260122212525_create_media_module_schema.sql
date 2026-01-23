/*
  # Create Media Module Schema (Google Drive Integration)

  1. New Tables
    - `drive_connections`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, FK to organizations)
      - `email` (text) - Connected Google account email
      - `access_token_encrypted` (text) - Encrypted OAuth access token
      - `refresh_token_encrypted` (text) - Encrypted OAuth refresh token
      - `token_expiry` (timestamptz) - When access token expires
      - `scopes` (text[]) - Granted OAuth scopes
      - `root_folder_id` (text, nullable) - Optional root folder ID
      - `is_active` (boolean) - Whether connection is active
      - `created_at`, `updated_at` (timestamptz)

    - `drive_folders`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, FK to organizations)
      - `drive_folder_id` (text) - Google Drive folder ID
      - `name` (text) - Folder name
      - `parent_drive_folder_id` (text, nullable) - Parent folder ID in Drive
      - `path` (text) - Full path for display
      - `last_synced_at` (timestamptz)
      - `created_at`, `updated_at` (timestamptz)

    - `drive_files`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, FK to organizations)
      - `drive_file_id` (text) - Google Drive file ID
      - `name` (text) - File name
      - `mime_type` (text) - MIME type
      - `size_bytes` (bigint) - File size
      - `drive_owner_email` (text) - File owner in Drive
      - `parent_drive_folder_id` (text, nullable) - Parent folder ID
      - `thumbnail_url` (text, nullable) - Thumbnail from Drive
      - `web_view_link` (text, nullable) - Link to view in Drive
      - `icon_link` (text, nullable) - File type icon URL
      - `is_deleted` (boolean) - Soft delete flag
      - `access_revoked` (boolean) - Access lost flag
      - `last_synced_at` (timestamptz)
      - `created_at`, `updated_at` (timestamptz)

    - `file_attachments`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, FK to organizations)
      - `drive_file_id` (uuid, FK to drive_files)
      - `entity_type` (text) - contacts/opportunities/conversations/forms/social_posts/invoices
      - `entity_id` (uuid) - ID of the entity
      - `attached_by` (uuid, FK to users)
      - `note` (text, nullable) - Optional note about attachment
      - `attached_at` (timestamptz)

  2. Indexes
    - drive_folders: (org_id, drive_folder_id), (org_id, parent_drive_folder_id)
    - drive_files: (org_id, drive_file_id), (org_id, parent_drive_folder_id)
    - file_attachments: (entity_type, entity_id), (drive_file_id)

  3. Constraints
    - Unique constraint on (org_id) for drive_connections (one per org)
    - Unique constraint on (org_id, drive_folder_id) for drive_folders
    - Unique constraint on (org_id, drive_file_id) for drive_files
    - Unique constraint on (drive_file_id, entity_type, entity_id) for file_attachments
*/

-- Drive connections table (one per organization)
CREATE TABLE IF NOT EXISTS drive_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  access_token_encrypted text NOT NULL,
  refresh_token_encrypted text NOT NULL,
  token_expiry timestamptz NOT NULL,
  scopes text[] NOT NULL DEFAULT '{}',
  root_folder_id text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT drive_connections_org_unique UNIQUE (organization_id)
);

-- Drive folders table (cache of folder structure)
CREATE TABLE IF NOT EXISTS drive_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  drive_folder_id text NOT NULL,
  name text NOT NULL,
  parent_drive_folder_id text,
  path text NOT NULL DEFAULT '',
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT drive_folders_org_folder_unique UNIQUE (organization_id, drive_folder_id)
);

-- Drive files table (metadata references)
CREATE TABLE IF NOT EXISTS drive_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  drive_file_id text NOT NULL,
  name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  drive_owner_email text,
  parent_drive_folder_id text,
  thumbnail_url text,
  web_view_link text,
  icon_link text,
  is_deleted boolean NOT NULL DEFAULT false,
  access_revoked boolean NOT NULL DEFAULT false,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT drive_files_org_file_unique UNIQUE (organization_id, drive_file_id)
);

-- File attachments table (links files to entities)
CREATE TABLE IF NOT EXISTS file_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  drive_file_id uuid NOT NULL REFERENCES drive_files(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  attached_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note text,
  attached_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT file_attachments_unique UNIQUE (drive_file_id, entity_type, entity_id),
  CONSTRAINT file_attachments_entity_type_check CHECK (
    entity_type IN ('contacts', 'opportunities', 'conversations', 'forms', 'social_posts', 'invoices')
  )
);

-- Indexes for drive_folders
CREATE INDEX IF NOT EXISTS idx_drive_folders_org_folder ON drive_folders(organization_id, drive_folder_id);
CREATE INDEX IF NOT EXISTS idx_drive_folders_org_parent ON drive_folders(organization_id, parent_drive_folder_id);

-- Indexes for drive_files
CREATE INDEX IF NOT EXISTS idx_drive_files_org_file ON drive_files(organization_id, drive_file_id);
CREATE INDEX IF NOT EXISTS idx_drive_files_org_parent ON drive_files(organization_id, parent_drive_folder_id);
CREATE INDEX IF NOT EXISTS idx_drive_files_org_not_deleted ON drive_files(organization_id) WHERE is_deleted = false;

-- Indexes for file_attachments
CREATE INDEX IF NOT EXISTS idx_file_attachments_entity ON file_attachments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_file_attachments_drive_file ON file_attachments(drive_file_id);
CREATE INDEX IF NOT EXISTS idx_file_attachments_org ON file_attachments(organization_id);

-- Enable RLS on all tables
ALTER TABLE drive_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE drive_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE drive_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_attachments ENABLE ROW LEVEL SECURITY;
