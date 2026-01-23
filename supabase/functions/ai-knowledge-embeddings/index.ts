import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GeneratePayload {
  action: "generate";
  collection_id: string;
  version_id: string;
}

interface SearchPayload {
  action: "search";
  org_id: string;
  query: string;
  collection_ids?: string[];
  limit?: number;
}

type RequestPayload = GeneratePayload | SearchPayload;

interface KnowledgeSearchResult {
  collection_id: string;
  collection_name: string;
  chunk_text: string;
  similarity: number;
}

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const payload: RequestPayload = await req.json();

    if (!payload.action) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    if (payload.action === "generate") {
      const { collection_id, version_id } = payload as GeneratePayload;

      if (!collection_id || !version_id) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing collection_id or version_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = await generateEmbeddings(supabaseAdmin, collection_id, version_id);
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (payload.action === "search") {
      const { org_id, query, collection_ids, limit } = payload as SearchPayload;

      if (!org_id || !query) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing org_id or query" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const results = await searchKnowledge(supabaseAdmin, org_id, query, collection_ids, limit);
      return new Response(
        JSON.stringify({ success: true, results }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ai-knowledge-embeddings:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function generateEmbeddings(
  supabase: ReturnType<typeof createClient>,
  collectionId: string,
  versionId: string
): Promise<{ success: boolean; chunks?: number; error?: string }> {
  try {
    const { data: version, error: versionError } = await supabase
      .from("knowledge_versions")
      .select("body_text")
      .eq("id", versionId)
      .single();

    if (versionError || !version?.body_text) {
      return { success: false, error: "Version not found or has no content" };
    }

    const { data: collection, error: collectionError } = await supabase
      .from("knowledge_collections")
      .select("org_id")
      .eq("id", collectionId)
      .single();

    if (collectionError || !collection) {
      return { success: false, error: "Collection not found" };
    }

    const { data: provider } = await supabase
      .from("llm_providers")
      .select("api_key_encrypted")
      .eq("org_id", collection.org_id)
      .eq("provider", "openai")
      .eq("enabled", true)
      .maybeSingle();

    if (!provider?.api_key_encrypted) {
      return { success: false, error: "OpenAI provider not configured for embeddings" };
    }

    await supabase
      .from("knowledge_embeddings")
      .delete()
      .eq("version_id", versionId);

    const chunks = chunkText(version.body_text);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await getEmbedding(provider.api_key_encrypted, chunk);

      if (embedding) {
        await supabase
          .from("knowledge_embeddings")
          .insert({
            collection_id: collectionId,
            version_id: versionId,
            chunk_index: i,
            chunk_text: chunk,
            embedding: embedding,
          });
      }
    }

    return { success: true, chunks: chunks.length };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate embeddings",
    };
  }
}

async function searchKnowledge(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  query: string,
  collectionIds?: string[],
  limit = 5
): Promise<KnowledgeSearchResult[]> {
  try {
    const { data: provider } = await supabase
      .from("llm_providers")
      .select("api_key_encrypted")
      .eq("org_id", orgId)
      .eq("provider", "openai")
      .eq("enabled", true)
      .maybeSingle();

    if (!provider?.api_key_encrypted) {
      return [];
    }

    const queryEmbedding = await getEmbedding(provider.api_key_encrypted, query);
    if (!queryEmbedding) {
      return [];
    }

    const { data, error } = await supabase.rpc("search_knowledge_embeddings", {
      p_org_id: orgId,
      p_query_embedding: queryEmbedding,
      p_collection_ids: collectionIds || null,
      p_limit: limit,
    });

    if (error) {
      console.error("Search error:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Search knowledge error:", error);
    return [];
  }
}

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentChunk = "";

  for (const sentence of sentences) {
    if ((currentChunk + " " + sentence).length > CHUNK_SIZE && currentChunk) {
      chunks.push(currentChunk.trim());
      const words = currentChunk.split(" ");
      const overlapWords = words.slice(-Math.floor(CHUNK_OVERLAP / 5));
      currentChunk = overlapWords.join(" ") + " " + sentence;
    } else {
      currentChunk = currentChunk ? currentChunk + " " + sentence : sentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [text];
}

async function getEmbedding(apiKey: string, text: string): Promise<number[] | null> {
  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text,
      }),
    });

    if (!response.ok) {
      console.error("Embedding API error:", response.status);
      return null;
    }

    const data = await response.json();
    return data.data?.[0]?.embedding || null;
  } catch (error) {
    console.error("Failed to get embedding:", error);
    return null;
  }
}
