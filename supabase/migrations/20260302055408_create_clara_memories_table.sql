/*
  # Create Clara Long-Term Memory System

  1. New Tables
    - `clara_memories`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, FK to organizations, not null)
      - `user_id` (uuid, FK to auth.users, not null)
      - `memory_type` (text, not null, constrained to allowed types)
      - `title` (text, nullable)
      - `content` (text, not null)
      - `embedding` (vector(1536), nullable, for semantic search)
      - `importance_score` (integer, default 5, range 1-10)
      - `last_accessed_at` (timestamptz, nullable)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Indexes
    - btree on (user_id) for fast user-scoped queries
    - btree on (user_id, memory_type) for filtered retrieval
    - IVFFlat on embedding for vector cosine similarity search

  3. Security
    - Enable RLS on clara_memories table
    - Users can SELECT and DELETE only their own memories
    - Service role INSERT/UPDATE for edge function operations

  4. RPC Function
    - `search_clara_memories` for semantic vector similarity search
    - Scoped by user_id, optional memory_type filter
    - Updates last_accessed_at on retrieved rows
*/

CREATE TABLE IF NOT EXISTS clara_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_type text NOT NULL,
  title text,
  content text NOT NULL,
  embedding vector(1536),
  importance_score integer NOT NULL DEFAULT 5,
  last_accessed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT clara_memories_type_check CHECK (
    memory_type IN (
      'preference',
      'communication_style',
      'decision',
      'contact_context',
      'recurring_pattern',
      'strategic_context',
      'behavior_pattern'
    )
  ),
  CONSTRAINT clara_memories_importance_range CHECK (
    importance_score >= 0 AND importance_score <= 10
  )
);

CREATE INDEX IF NOT EXISTS idx_clara_memories_user
  ON clara_memories(user_id);

CREATE INDEX IF NOT EXISTS idx_clara_memories_user_type
  ON clara_memories(user_id, memory_type);

CREATE INDEX IF NOT EXISTS idx_clara_memories_embedding
  ON clara_memories USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

ALTER TABLE clara_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own clara memories"
  ON clara_memories
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own clara memories"
  ON clara_memories
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert clara memories"
  ON clara_memories
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update clara memories"
  ON clara_memories
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION search_clara_memories(
  p_user_id uuid,
  p_query_embedding vector(1536),
  p_memory_types text[] DEFAULT NULL,
  p_limit integer DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  memory_type text,
  title text,
  content text,
  importance_score integer,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE clara_memories cm
  SET last_accessed_at = now()
  WHERE cm.user_id = p_user_id
    AND cm.embedding IS NOT NULL
    AND cm.importance_score > 0
    AND (p_memory_types IS NULL OR cm.memory_type = ANY(p_memory_types))
    AND cm.id IN (
      SELECT sub.id
      FROM clara_memories sub
      WHERE sub.user_id = p_user_id
        AND sub.embedding IS NOT NULL
        AND sub.importance_score > 0
        AND (p_memory_types IS NULL OR sub.memory_type = ANY(p_memory_types))
      ORDER BY sub.embedding <=> p_query_embedding
      LIMIT p_limit
    );

  RETURN QUERY
  SELECT
    cm.id,
    cm.memory_type,
    cm.title,
    cm.content,
    cm.importance_score,
    1 - (cm.embedding <=> p_query_embedding)::float AS similarity
  FROM clara_memories cm
  WHERE cm.user_id = p_user_id
    AND cm.embedding IS NOT NULL
    AND cm.importance_score > 0
    AND (p_memory_types IS NULL OR cm.memory_type = ANY(p_memory_types))
  ORDER BY cm.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$;
