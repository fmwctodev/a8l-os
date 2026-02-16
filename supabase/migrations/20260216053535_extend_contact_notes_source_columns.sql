/*
  # Extend Contact Notes Table with Source Tracking

  1. Modified Tables
    - `contact_notes`
      - Add `title` (text, nullable) - Structured note title for auto-generated notes
      - Add `source_type` (text, nullable) - Source origin: 'google_meet', 'manual', etc.
      - Add `source_id` (text, nullable) - External ID (e.g., google_event_id for Meet notes)
      - Add `metadata` (jsonb, nullable) - Structured data: drive file IDs, links, conference ID

  2. Indexes
    - Partial unique index on (contact_id, source_type, source_id) to prevent duplicate notes per source event
    - Only applies when source_type and source_id are NOT NULL (manual notes unaffected)

  3. Important Notes
    - All new columns are nullable to maintain full backward compatibility with existing manual notes
    - Existing notes remain unaffected (null source_type means manual note)
    - The partial unique index enables idempotent upsert from Meet processing pipeline
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contact_notes' AND column_name = 'title'
  ) THEN
    ALTER TABLE contact_notes ADD COLUMN title text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contact_notes' AND column_name = 'source_type'
  ) THEN
    ALTER TABLE contact_notes ADD COLUMN source_type text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contact_notes' AND column_name = 'source_id'
  ) THEN
    ALTER TABLE contact_notes ADD COLUMN source_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contact_notes' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE contact_notes ADD COLUMN metadata jsonb;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_notes_source_unique
  ON contact_notes(contact_id, source_type, source_id)
  WHERE source_type IS NOT NULL AND source_id IS NOT NULL;
