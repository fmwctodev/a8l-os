/*
  # Add Status Field to Departments Table

  1. Changes
    - Add `status` column (text) with default 'active'
    - Add `updated_at` column with auto-update trigger
    - Add check constraint for valid status values

  2. Security
    - Status allows soft-delete functionality
    - Only active/disabled values allowed

  3. Notes
    - Existing departments default to 'active' status
    - Trigger auto-updates updated_at on changes
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'departments' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.departments ADD COLUMN status text NOT NULL DEFAULT 'active';
    ALTER TABLE public.departments ADD CONSTRAINT departments_status_check CHECK (status IN ('active', 'disabled'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'departments' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.departments ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_departments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS departments_updated_at_trigger ON public.departments;
CREATE TRIGGER departments_updated_at_trigger
  BEFORE UPDATE ON public.departments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_departments_updated_at();

CREATE INDEX IF NOT EXISTS idx_departments_status ON public.departments(status);
