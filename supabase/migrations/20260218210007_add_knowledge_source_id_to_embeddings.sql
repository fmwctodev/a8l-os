/*
  # Add knowledge_source_id to knowledge_embeddings

  1. Modified Tables
    - `knowledge_embeddings`
      - Add `knowledge_source_id` (uuid, nullable) - references agent_knowledge_sources
      - Make `collection_id` nullable (agent sources don't have collections)
      - Make `version_id` nullable (agent sources don't have versions)
      - Add index on knowledge_source_id for fast lookups

  2. Notes
    - Allows both Global Collections and Agent Knowledge Sources to store embeddings in the same table
    - Existing rows retain their collection_id and version_id values
    - New agent knowledge source embeddings will have knowledge_source_id set, with collection_id and version_id null
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_embeddings' AND column_name = 'knowledge_source_id'
  ) THEN
    ALTER TABLE knowledge_embeddings ADD COLUMN knowledge_source_id uuid REFERENCES agent_knowledge_sources(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE knowledge_embeddings ALTER COLUMN collection_id DROP NOT NULL;
ALTER TABLE knowledge_embeddings ALTER COLUMN version_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_source_id
  ON knowledge_embeddings(knowledge_source_id)
  WHERE knowledge_source_id IS NOT NULL;
