/*
  # Create User Connected Accounts Table

  1. New Tables
    - `user_connected_accounts`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `provider` (text) - google, microsoft, facebook, etc.
      - `provider_account_id` (text) - ID from the provider
      - `provider_account_email` (text) - Email from the provider
      - `access_token` (text) - Encrypted access token
      - `refresh_token` (text) - Encrypted refresh token
      - `token_expires_at` (timestamptz) - When the access token expires
      - `scopes` (text[]) - Array of granted scopes
      - `connected_at` (timestamptz) - When the account was connected
      - `last_synced_at` (timestamptz) - Last successful sync
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `user_connected_accounts` table
    - Policies will be added in a separate migration
    - Tokens are stored encrypted (application layer encryption)
*/

CREATE TABLE IF NOT EXISTS user_connected_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_account_id text NOT NULL,
  provider_account_email text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  scopes text[],
  connected_at timestamptz DEFAULT now(),
  last_synced_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, provider)
);

ALTER TABLE user_connected_accounts ENABLE ROW LEVEL SECURITY;