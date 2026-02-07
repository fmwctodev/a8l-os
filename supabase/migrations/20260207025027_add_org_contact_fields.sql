/*
  # Add contact fields to organizations

  1. Modified Tables
    - `organizations`
      - `email` (text, nullable) - primary contact email
      - `phone` (text, nullable) - primary phone number
      - `website` (text, nullable) - organization website URL

  2. Notes
    - These fields allow storing core business contact information
    - All fields are optional to avoid breaking existing rows
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'email'
  ) THEN
    ALTER TABLE organizations ADD COLUMN email text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'phone'
  ) THEN
    ALTER TABLE organizations ADD COLUMN phone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'website'
  ) THEN
    ALTER TABLE organizations ADD COLUMN website text;
  END IF;
END $$;