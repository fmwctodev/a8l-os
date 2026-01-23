import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_DRIVE_API = "https://www.googleapis.com/drive/v3";

interface DriveConnection {
  id: string;
  organization_id: string;
  email: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  token_expiry: string;
  is_active: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing environment variables");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization header" }, 401);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const userClient = createClient(supabaseUrl, authHeader.replace("Bearer ", ""), {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data: userData } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!userData) {
      return jsonResponse({ error: "User not found" }, 404);
    }

    const orgId = userData.organization_id;

    const { data: connection } = await supabase
      .from("drive_connections")
      .select("*")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .maybeSingle() as { data: DriveConnection | null };

    if (!connection) {
      return jsonResponse({ error: "Google Drive not connected" }, 400);
    }

    const accessToken = await getValidAccessToken(supabase, connection);

    const body = req.method === "GET" ? null : await req.json();
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || body?.action;

    switch (action) {
      case "list":
        return await handleList(accessToken, body?.folderId || "root", body?.pageToken);

      case "search":
        return await handleSearch(accessToken, body?.query, body?.mimeTypes);

      case "get-metadata":
        return await handleGetMetadata(accessToken, body?.fileId);

      case "create-folder":
        return await handleCreateFolder(accessToken, body?.name, body?.parentId);

      case "delete":
        return await handleDelete(accessToken, body?.fileId);

      case "get-download-url":
        return jsonResponse({
          url: `${GOOGLE_DRIVE_API}/files/${body?.fileId}?alt=media`,
          accessToken,
        });

      default:
        return jsonResponse({ error: "Unknown action" }, 400);
    }
  } catch (err) {
    console.error("Drive API error:", err);
    return jsonResponse({ error: err.message || "An error occurred" }, 500);
  }
});

async function getValidAccessToken(
  supabase: ReturnType<typeof createClient>,
  connection: DriveConnection
): Promise<string> {
  const expiry = new Date(connection.token_expiry);
  const now = new Date();

  if (expiry.getTime() - now.getTime() > 5 * 60 * 1000) {
    return connection.access_token_encrypted;
  }

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth not configured");
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: connection.refresh_token_encrypted,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to refresh token");
  }

  const tokens = await response.json();
  const newExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  await supabase
    .from("drive_connections")
    .update({
      access_token_encrypted: tokens.access_token,
      token_expiry: newExpiry,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id);

  return tokens.access_token;
}

async function handleList(
  accessToken: string,
  folderId: string,
  pageToken?: string
) {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "nextPageToken,files(id,name,mimeType,size,owners,parents,thumbnailLink,webViewLink,iconLink,trashed,createdTime,modifiedTime)",
    pageSize: "100",
    orderBy: "folder,name",
  });

  if (pageToken) {
    params.set("pageToken", pageToken);
  }

  const response = await fetch(`${GOOGLE_DRIVE_API}/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list files: ${error}`);
  }

  const data = await response.json();
  return jsonResponse({
    files: data.files || [],
    nextPageToken: data.nextPageToken,
  });
}

async function handleSearch(
  accessToken: string,
  query: string,
  mimeTypes?: string[]
) {
  let q = `name contains '${query.replace(/'/g, "\\'")}' and trashed = false`;

  if (mimeTypes && mimeTypes.length > 0) {
    const mimeQuery = mimeTypes.map((m: string) => `mimeType = '${m}'`).join(" or ");
    q = `${q} and (${mimeQuery})`;
  }

  const params = new URLSearchParams({
    q,
    fields: "files(id,name,mimeType,size,owners,parents,thumbnailLink,webViewLink,iconLink,trashed,createdTime,modifiedTime)",
    pageSize: "50",
    orderBy: "modifiedTime desc",
  });

  const response = await fetch(`${GOOGLE_DRIVE_API}/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error("Failed to search files");
  }

  const data = await response.json();
  return jsonResponse({ files: data.files || [] });
}

async function handleGetMetadata(accessToken: string, fileId: string) {
  const params = new URLSearchParams({
    fields: "id,name,mimeType,size,owners,parents,thumbnailLink,webViewLink,iconLink,trashed,createdTime,modifiedTime",
  });

  const response = await fetch(`${GOOGLE_DRIVE_API}/files/${fileId}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return jsonResponse({ error: "File not found", code: "NOT_FOUND" }, 404);
    }
    if (response.status === 403) {
      return jsonResponse({ error: "Access denied", code: "ACCESS_DENIED" }, 403);
    }
    throw new Error("Failed to get file metadata");
  }

  const file = await response.json();
  return jsonResponse({ file });
}

async function handleCreateFolder(
  accessToken: string,
  name: string,
  parentId: string = "root"
) {
  const response = await fetch(`${GOOGLE_DRIVE_API}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to create folder");
  }

  const folder = await response.json();
  return jsonResponse({ folder });
}

async function handleDelete(accessToken: string, fileId: string) {
  const response = await fetch(`${GOOGLE_DRIVE_API}/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok && response.status !== 404) {
    throw new Error("Failed to delete file");
  }

  return jsonResponse({ success: true });
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
