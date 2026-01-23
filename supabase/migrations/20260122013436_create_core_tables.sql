/*
  # Autom8ion Lab OS - Core Database Schema

  ## Overview
  This migration creates the foundational tables for the CRM system including
  organizations, departments, users, roles, permissions, audit logs, and feature flags.

  ## 1. New Tables

  ### organizations
  - `id` (uuid, primary key) - Unique identifier
  - `name` (text) - Organization name
  - `created_at` (timestamptz) - Creation timestamp

  ### departments
  - `id` (uuid, primary key) - Unique identifier
  - `organization_id` (uuid, FK) - Reference to organization
  - `name` (text) - Department name
  - `created_at` (timestamptz) - Creation timestamp

  ### roles
  - `id` (uuid, primary key) - Unique identifier
  - `name` (text) - Role name (SuperAdmin, Admin, Manager, Sales, Ops, ReadOnly)
  - `description` (text) - Role description
  - `hierarchy_level` (int) - Lower = more permissions (1=SuperAdmin, 6=ReadOnly)
  - `created_at` (timestamptz) - Creation timestamp

  ### permissions
  - `id` (uuid, primary key) - Unique identifier
  - `key` (text) - Permission key (e.g., contacts.view)
  - `description` (text) - Permission description
  - `module_name` (text) - Module this permission belongs to
  - `created_at` (timestamptz) - Creation timestamp

  ### role_permissions
  - `role_id` (uuid, FK) - Reference to role
  - `permission_id` (uuid, FK) - Reference to permission
  - Primary key is composite of both

  ### users
  - `id` (uuid, primary key) - References auth.users
  - `organization_id` (uuid, FK) - Reference to organization
  - `department_id` (uuid, FK, nullable) - Reference to department
  - `role_id` (uuid, FK) - Reference to role
  - `email` (text) - User email
  - `name` (text) - User display name
  - `avatar_url` (text, nullable) - Profile picture URL
  - `status` (text) - active, inactive, or pending
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### audit_logs
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid, FK, nullable) - Reference to user who performed action
  - `action` (text) - Action performed (create, update, delete, login, etc.)
  - `entity_type` (text) - Type of entity affected
  - `entity_id` (uuid, nullable) - ID of entity affected
  - `before_state` (jsonb, nullable) - State before change
  - `after_state` (jsonb, nullable) - State after change
  - `ip_address` (text, nullable) - IP address of request
  - `timestamp` (timestamptz) - When action occurred

  ### feature_flags
  - `id` (uuid, primary key) - Unique identifier
  - `key` (text) - Feature flag key
  - `enabled` (boolean) - Whether feature is enabled
  - `description` (text, nullable) - Feature description
  - `created_at` (timestamptz) - Creation timestamp

  ## 2. Security
  - RLS enabled on all tables (policies created in separate migration)
  - Audit logs table is append-only by design
*/

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  hierarchy_level int NOT NULL DEFAULT 100,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  description text,
  module_name text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  email text NOT NULL,
  name text NOT NULL,
  avatar_url text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  before_state jsonb,
  after_state jsonb,
  ip_address text,
  timestamp timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  enabled boolean DEFAULT false NOT NULL,
  description text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_departments_org ON departments(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;