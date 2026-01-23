/*
  # Create User Preferences Table

  1. New Tables
    - `user_preferences`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `default_landing_page` (text) - Where user lands after login
      - `calendar_default_view` (text) - day, week, month
      - `inbox_behavior` (text) - auto_select_first, stay_on_list
      - `date_format` (text) - MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD
      - `time_format` (text) - 12h, 24h
      - `language` (text) - en, es, fr, etc.
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `user_preferences` table
    - Policies will be added in a separate migration
*/

CREATE TABLE IF NOT EXISTS user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  default_landing_page text DEFAULT '/dashboard',
  calendar_default_view text DEFAULT 'week',
  inbox_behavior text DEFAULT 'auto_select_first',
  date_format text DEFAULT 'MM/DD/YYYY',
  time_format text DEFAULT '12h',
  language text DEFAULT 'en',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;