/*
  # Extend Knowledge Collections with Source Types

  This migration adds support for multiple source types to knowledge collections,
  aligning the Global Knowledge feature with the AI Module's knowledge source capabilities.

  1. Schema Changes to knowledge_collections Table
    - Add `source_type` column using agent_knowledge_source_type enum (website, faq, table, rich_text, file_upload)
    - Add `source_config` JSONB column for type-specific configuration storage

  2. Data Migration
    - Convert all existing collections to source_type = 'rich_text'
    - Transform existing body_text in knowledge_versions into source_config format

  3. Notes
    - Maintains backward compatibility with existing collections
    - source_config stores type-specific data:
      - website: { url, crawlType, depth }
      - faq: { faqs: [{ question, answer }] }
      - table: { fileName, selectedColumns, rowCount, previewData }
      - rich_text: { content, plainText }
      - file_upload: { files: [{ name, size }] }
*/

-- Add source_type column to knowledge_collections
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_collections' AND column_name = 'source_type'
  ) THEN
    ALTER TABLE knowledge_collections 
    ADD COLUMN source_type agent_knowledge_source_type NOT NULL DEFAULT 'rich_text';
  END IF;
END $$;

-- Add source_config column to knowledge_collections
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_collections' AND column_name = 'source_config'
  ) THEN
    ALTER TABLE knowledge_collections 
    ADD COLUMN source_config jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add source_type column to knowledge_versions for version-specific content
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_versions' AND column_name = 'source_config'
  ) THEN
    ALTER TABLE knowledge_versions 
    ADD COLUMN source_config jsonb;
  END IF;
END $$;

-- Migrate existing knowledge_versions body_text to source_config format
UPDATE knowledge_versions
SET source_config = jsonb_build_object(
  'content', COALESCE(body_text, ''),
  'plainText', COALESCE(body_text, '')
)
WHERE source_config IS NULL AND body_text IS NOT NULL;

-- Create index for source_type queries
CREATE INDEX IF NOT EXISTS idx_knowledge_collections_source_type 
ON knowledge_collections(org_id, source_type);
