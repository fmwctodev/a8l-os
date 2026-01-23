/*
  # Conversations Module - Core Tables

  ## Overview
  This migration creates the database tables for the unified inbox/conversations
  module supporting SMS, Email, Voice, and Webchat channels.

  ## 1. New Tables

  ### conversations
  - `id` (uuid, primary key) - Unique identifier
  - `organization_id` (uuid, FK) - Reference to organization
  - `contact_id` (uuid, FK) - Reference to linked contact
  - `assigned_user_id` (uuid, FK, nullable) - User assigned to this conversation
  - `department_id` (uuid, FK, nullable) - Department for routing
  - `status` (text) - open, pending, or closed
  - `last_message_at` (timestamptz) - When last message was sent/received
  - `unread_count` (int) - Number of unread inbound messages
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### messages
  - `id` (uuid, primary key) - Unique identifier
  - `organization_id` (uuid, FK) - Reference to organization
  - `conversation_id` (uuid, FK) - Reference to parent conversation
  - `contact_id` (uuid, FK) - Reference to contact
  - `channel` (text) - sms, email, voice, or webchat
  - `direction` (text) - inbound, outbound, or system
  - `body` (text) - Message content
  - `subject` (text, nullable) - Email subject line
  - `metadata` (jsonb) - Channel-specific metadata
  - `status` (text) - pending, sent, delivered, failed, or read
  - `external_id` (text, nullable) - Provider message ID (Twilio SID, etc.)
  - `sent_at` (timestamptz) - When message was sent
  - `created_at` (timestamptz) - Creation timestamp

  ### call_logs
  - `id` (uuid, primary key) - Unique identifier
  - `organization_id` (uuid, FK) - Reference to organization
  - `conversation_id` (uuid, FK) - Reference to conversation
  - `contact_id` (uuid, FK) - Reference to contact
  - `twilio_call_sid` (text) - Twilio Call SID
  - `direction` (text) - inbound or outbound
  - `from_number` (text) - Caller phone number
  - `to_number` (text) - Recipient phone number
  - `duration` (int) - Call duration in seconds
  - `recording_url` (text, nullable) - Recording URL if available
  - `status` (text) - Call status from Twilio
  - `created_at` (timestamptz) - Creation timestamp

  ### inbox_events
  - `id` (uuid, primary key) - Unique identifier
  - `organization_id` (uuid, FK) - Reference to organization
  - `conversation_id` (uuid, FK) - Reference to conversation
  - `event_type` (text) - assigned, status_changed, merged, etc.
  - `payload` (jsonb) - Event-specific data
  - `actor_user_id` (uuid, FK, nullable) - User who triggered event
  - `created_at` (timestamptz) - Creation timestamp

  ### channel_configurations
  - `id` (uuid, primary key) - Unique identifier
  - `organization_id` (uuid, FK) - Reference to organization
  - `channel_type` (text) - twilio, gmail, or webchat
  - `config` (jsonb) - Encrypted configuration data
  - `is_active` (boolean) - Whether channel is enabled
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### gmail_oauth_tokens
  - `id` (uuid, primary key) - Unique identifier
  - `organization_id` (uuid, FK) - Reference to organization
  - `user_id` (uuid, FK) - Reference to user who connected
  - `access_token` (text) - Encrypted access token
  - `refresh_token` (text) - Encrypted refresh token
  - `token_expiry` (timestamptz) - When access token expires
  - `email` (text) - Connected Gmail address
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### webchat_sessions
  - `id` (uuid, primary key) - Unique identifier
  - `organization_id` (uuid, FK) - Reference to organization
  - `conversation_id` (uuid, FK, nullable) - Reference to conversation
  - `visitor_id` (text) - Browser fingerprint or generated ID
  - `visitor_name` (text, nullable) - Name from pre-chat form
  - `visitor_email` (text, nullable) - Email from pre-chat form
  - `metadata` (jsonb) - Additional visitor info
  - `last_activity_at` (timestamptz) - Last interaction time
  - `created_at` (timestamptz) - Creation timestamp

  ## 2. Indexes
  - Composite indexes for common query patterns
  - Full-text search index on message body

  ## 3. Security
  - RLS enabled on all tables (policies in separate migration)
*/

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  assigned_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending', 'closed')),
  last_message_at timestamptz DEFAULT now() NOT NULL,
  unread_count int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('sms', 'email', 'voice', 'webchat')),
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound', 'system')),
  body text NOT NULL DEFAULT '',
  subject text,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'read')),
  external_id text,
  sent_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  twilio_call_sid text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_number text NOT NULL,
  to_number text NOT NULL,
  duration int DEFAULT 0 NOT NULL,
  recording_url text,
  status text NOT NULL DEFAULT 'initiated',
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS inbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('assigned', 'status_changed', 'contact_merged', 'conversation_created', 'ambiguous_contact', 'note_added')),
  payload jsonb DEFAULT '{}'::jsonb NOT NULL,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS channel_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  channel_type text NOT NULL CHECK (channel_type IN ('twilio', 'gmail', 'webchat')),
  config jsonb DEFAULT '{}'::jsonb NOT NULL,
  is_active boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (organization_id, channel_type)
);

CREATE TABLE IF NOT EXISTS gmail_oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expiry timestamptz NOT NULL,
  email text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS webchat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  visitor_id text NOT NULL,
  visitor_name text,
  visitor_email text,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  last_activity_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (organization_id, visitor_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_org ON conversations(organization_id);
CREATE INDEX IF NOT EXISTS idx_conversations_contact ON conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_assigned ON conversations(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(organization_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_unread ON conversations(organization_id, unread_count) WHERE unread_count > 0;

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_contact ON messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(organization_id, channel);
CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON messages(conversation_id, sent_at);
CREATE INDEX IF NOT EXISTS idx_messages_external ON messages(external_id) WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_call_logs_conversation ON call_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_contact ON call_logs(contact_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_sid ON call_logs(twilio_call_sid);

CREATE INDEX IF NOT EXISTS idx_inbox_events_conversation ON inbox_events(conversation_id);
CREATE INDEX IF NOT EXISTS idx_inbox_events_type ON inbox_events(organization_id, event_type);

CREATE INDEX IF NOT EXISTS idx_channel_configs_org ON channel_configurations(organization_id);

CREATE INDEX IF NOT EXISTS idx_gmail_tokens_org ON gmail_oauth_tokens(organization_id);
CREATE INDEX IF NOT EXISTS idx_gmail_tokens_user ON gmail_oauth_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_webchat_sessions_org ON webchat_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_webchat_sessions_conversation ON webchat_sessions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_webchat_sessions_visitor ON webchat_sessions(organization_id, visitor_id);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE gmail_oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE webchat_sessions ENABLE ROW LEVEL SECURITY;
