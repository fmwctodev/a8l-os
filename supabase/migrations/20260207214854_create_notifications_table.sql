/*
  # Create Notifications Table

  1. New Tables
    - `notifications`
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK to users) - notification recipient
      - `type` (text) - category: message, conversation, calendar, system, etc.
      - `title` (text) - short notification title
      - `body` (text, nullable) - notification description
      - `icon` (text, nullable) - optional icon identifier
      - `link` (text, nullable) - optional navigation link when clicked
      - `is_read` (boolean) - read state, defaults to false
      - `metadata` (jsonb) - extra context data (sender info, module context, etc.)
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled
    - Users can only SELECT/UPDATE/DELETE their own notifications
    - Any authenticated user can INSERT (for cross-user notifications)

  3. Indexes
    - Partial index on (user_id, is_read) for fast unread counts
    - Index on (user_id, created_at DESC) for ordered listing

  4. Realtime
    - Added to supabase_realtime publication for live notification delivery
*/

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'system',
  title text NOT NULL,
  body text,
  icon text,
  link text,
  is_read boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications (user_id, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
