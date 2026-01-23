/*
  # Create User Notification Preferences Table

  1. New Tables
    - `user_notification_preferences`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `event_type` (text) - Type of event (new_message, new_contact, etc.)
      - `email_enabled` (boolean) - Send email notification
      - `push_enabled` (boolean) - Send push notification
      - `sms_enabled` (boolean) - Send SMS notification
      - `in_app_enabled` (boolean) - Show in-app notification
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `user_notification_preferences` table
    - Policies will be added in a separate migration
*/

CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  email_enabled boolean DEFAULT true,
  push_enabled boolean DEFAULT true,
  sms_enabled boolean DEFAULT false,
  in_app_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, event_type)
);

ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;