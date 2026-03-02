import { type SupabaseClient } from "npm:@supabase/supabase-js@2";

export type ClaraMemoryType =
  | "preference"
  | "communication_style"
  | "decision"
  | "contact_context"
  | "recurring_pattern"
  | "strategic_context"
  | "behavior_pattern";

export interface ClaraMemoryRow {
  id: string;
  memory_type: ClaraMemoryType;
  title: string | null;
  content: string;
  importance_score: number;
  similarity?: number;
}

export interface StoreMemoryParams {
  userId: string;
  orgId: string;
  memoryType: ClaraMemoryType;
  title?: string;
  content: string;
  importanceScore?: number;
}

export async function generateEmbedding(
  apiKey: string,
  text: string
): Promise<number[] | null> {
  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text.slice(0, 8000),
      }),
    });

    if (!response.ok) {
      console.error("[claraMemory] Embedding API error:", response.status);
      return null;
    }

    const data = await response.json();
    return data.data?.[0]?.embedding || null;
  } catch (error) {
    console.error("[claraMemory] Failed to generate embedding:", error);
    return null;
  }
}

export async function storeMemory(
  supabase: SupabaseClient,
  apiKey: string,
  params: StoreMemoryParams
): Promise<{ id: string } | null> {
  const embeddingText = params.title
    ? `${params.title}: ${params.content}`
    : params.content;
  const embedding = await generateEmbedding(apiKey, embeddingText);

  const { data, error } = await supabase
    .from("clara_memories")
    .insert({
      user_id: params.userId,
      organization_id: params.orgId,
      memory_type: params.memoryType,
      title: params.title || null,
      content: params.content,
      embedding: embedding ? JSON.stringify(embedding) : null,
      importance_score: params.importanceScore ?? 5,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[claraMemory] Failed to store memory:", error.message);
    return null;
  }

  return { id: data.id };
}

export async function retrieveRelevantMemories(
  supabase: SupabaseClient,
  userId: string,
  queryText: string,
  apiKey: string,
  limit = 5
): Promise<ClaraMemoryRow[]> {
  const queryEmbedding = await generateEmbedding(apiKey, queryText);
  if (!queryEmbedding) return [];

  const { data, error } = await supabase.rpc("search_clara_memories", {
    p_user_id: userId,
    p_query_embedding: JSON.stringify(queryEmbedding),
    p_memory_types: null,
    p_limit: limit,
  });

  if (error) {
    console.error("[claraMemory] Retrieval error:", error.message);
    return [];
  }

  return (data || []) as ClaraMemoryRow[];
}

export function formatMemoriesForContext(memories: ClaraMemoryRow[]): string {
  if (!memories.length) return "";

  return memories
    .map((m) => {
      const label = m.title ? `${m.title}: ${m.content}` : m.content;
      return `- (${m.memory_type}) ${label}`;
    })
    .join("\n");
}
