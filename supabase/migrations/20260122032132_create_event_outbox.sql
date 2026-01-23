/*
  # Create Event Outbox Table

  The event outbox enables cross-module event publishing for workflow triggers.
  Other modules publish events here, and the workflow processor consumes them.

  1. New Tables
    - `event_outbox` - Queue of domain events for workflow processing
      - `id` (uuid, primary key)
      - `org_id` (uuid, FK to organizations)
      - `event_type` (text) - Type of event (contact.created, conversation.message_received, etc.)
      - `contact_id` (uuid, nullable) - Related contact if applicable
      - `entity_type` (text) - What kind of entity triggered the event
      - `entity_id` (uuid) - ID of the entity that triggered the event
      - `payload` (jsonb) - Event-specific data
      - `created_at` (timestamptz) - When event was published
      - `processed_at` (timestamptz, nullable) - When event was consumed (null = unprocessed)

  2. Security
    - RLS enabled
    - Only service role should write to this table (via triggers or edge functions)

  3. Indexes
    - (processed_at, created_at) for efficient polling of unprocessed events
    - (event_type, processed_at) for filtering by event type

  4. Notes
    - Uses processed_at IS NULL pattern for exactly-once processing
    - Events are never deleted, allowing for audit/replay capabilities
*/

-- Create event outbox table
CREATE TABLE IF NOT EXISTS event_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

-- Enable RLS
ALTER TABLE event_outbox ENABLE ROW LEVEL SECURITY;

-- Create indexes for efficient polling
CREATE INDEX IF NOT EXISTS idx_event_outbox_unprocessed 
  ON event_outbox(created_at) 
  WHERE processed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_event_outbox_type_unprocessed 
  ON event_outbox(event_type, created_at) 
  WHERE processed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_event_outbox_org 
  ON event_outbox(org_id, created_at DESC);

-- Add comment explaining the table purpose
COMMENT ON TABLE event_outbox IS 'Cross-module event bus for workflow automation triggers. Events are published by various modules and consumed by the workflow processor.';
COMMENT ON COLUMN event_outbox.processed_at IS 'NULL means unprocessed. Set to timestamp when workflow processor consumes the event.';