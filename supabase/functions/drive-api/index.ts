import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { writeMasterToken } from "../_shared/google-oauth-helpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_DRIVE_API = "https://www.googleapis.com/drive/v3";
const GOOGLE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

interface DriveConnection {
  id: string;
  organization_id: string;
  user_id: string;
  email: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  token_expiry: string;
  is_active: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
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
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
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

    const { data: connection } = await supabase
      .from("drive_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle() as { data: DriveConnection | null };

    if (!connection) {
      return jsonResponse({ error: "Your Google Drive is not connected" }, 400);
    }

    const accessToken = await getValidAccessToken(supabase, connection);

    const contentType = req.headers.get("Content-Type") || "";
    const isMultipart = contentType.includes("multipart/form-data");

    let body: Record<string, unknown> | null = null;
    let formData: FormData | null = null;

    if (req.method !== "GET") {
      if (isMultipart) {
        formData = await req.formData();
      } else {
        body = await req.json();
      }
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || (body?.action as string);

    switch (action) {
      case "list":
        return await handleList(
          accessToken,
          (body?.folderId as string) || "root",
          body?.pageToken as string | undefined,
          body?.driveId as string | undefined
        );

      case "list-shared-drives":
        return await handleListSharedDrives(accessToken);

      case "list-shared-with-me":
        return await handleListSharedWithMe(
          accessToken,
          body?.pageToken as string | undefined
        );

      case "search":
        return await handleSearch(
          accessToken,
          body?.query as string,
          body?.mimeTypes as string[] | undefined,
          body?.driveId as string | undefined
        );

      case "get-metadata":
        return await handleGetMetadata(accessToken, body?.fileId as string);

      case "create-folder":
        return await handleCreateFolder(
          accessToken,
          body?.name as string,
          body?.parentId as string,
          body?.driveId as string | undefined
        );

      case "delete":
        return await handleDelete(accessToken, body?.fileId as string);

      case "get-download-url":
        return jsonResponse({
          url: `${GOOGLE_DRIVE_API}/files/${body?.fileId}?alt=media`,
          accessToken,
        });

      case "upload":
        return await handleUpload(
          accessToken,
          formData,
          url.searchParams.get("parentId") || "root",
          url.searchParams.get("driveId") || undefined
        );

      case "share":
        return await handleShare(
          accessToken,
          body?.fileId as string,
          body?.email as string | undefined,
          body?.role as string,
          body?.type as string
        );

      case "get-share-link":
        return await handleGetShareLink(accessToken, body?.fileId as string);

      default:
        return jsonResponse({ error: "Unknown action" }, 400);
    }
  } catch (err) {
    console.error("Drive API error:", err);
    return jsonResponse({ error: (err as Error).message || "An error occurred" }, 500);
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

  try {
    const { data: master } = await supabase
      .from("google_oauth_master")
      .select("granted_scopes, email, org_id")
      .eq("user_id", connection.user_id)
      .maybeSingle();

    if (master) {
      const refreshToken = tokens.refresh_token || connection.refresh_token_encrypted;
      await writeMasterToken(supabase, master.org_id, connection.user_id, master.email, tokens.access_token, refreshToken, newExpiry, master.granted_scopes || []);
    }
  } catch (masterErr) {
    console.warn("[DriveAPI] Failed to update master token (non-fatal):", masterErr);
  }

  return tokens.access_token;
}

async function handleList(
  accessToken: string,
  folderId: string,
  pageToken?: string,
  driveId?: string
) {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "nextPageToken,files(id,name,mimeType,size,owners,parents,thumbnailLink,webViewLink,iconLink,trashed,createdTime,modifiedTime,shared,driveId)",
    pageSize: "100",
    orderBy: "folder,name",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });

  if (driveId) {
    params.set("corpora", "drive");
    params.set("driveId", driveId);
  }

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

async function handleListSharedDrives(accessToken: string) {
  const params = new URLSearchParams({
    pageSize: "100",
    fields: "nextPageToken,drives(id,name,backgroundImageLink,createdTime)",
  });

  const response = await fetch(`${GOOGLE_DRIVE_API}/drives?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list shared drives: ${error}`);
  }

  const data = await response.json();
  return jsonResponse({ drives: data.drives || [] });
}

async function handleListSharedWithMe(
  accessToken: string,
  pageToken?: string
) {
  const params = new URLSearchParams({
    q: "sharedWithMe = true and trashed = false",
    fields: "nextPageToken,files(id,name,mimeType,size,owners,parents,thumbnailLink,webViewLink,iconLink,trashed,createdTime,modifiedTime,shared,driveId)",
    pageSize: "100",
    orderBy: "modifiedTime desc",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });

  if (pageToken) {
    params.set("pageToken", pageToken);
  }

  const response = await fetch(`${GOOGLE_DRIVE_API}/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list shared files: ${error}`);
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
  mimeTypes?: string[],
  driveId?: string
) {
  let q = `name contains '${query.replace(/'/g, "\\'")}' and trashed = false`;

  if (mimeTypes && mimeTypes.length > 0) {
    const mimeQuery = mimeTypes.map((m: string) => `mimeType = '${m}'`).join(" or ");
    q = `${q} and (${mimeQuery})`;
  }

  const params = new URLSearchParams({
    q,
    fields: "files(id,name,mimeType,size,owners,parents,thumbnailLink,webViewLink,iconLink,trashed,createdTime,modifiedTime,shared,driveId)",
    pageSize: "50",
    orderBy: "modifiedTime desc",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });

  if (driveId) {
    params.set("corpora", "drive");
    params.set("driveId", driveId);
  }

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
    fields: "id,name,mimeType,size,owners,parents,thumbnailLink,webViewLink,iconLink,trashed,createdTime,modifiedTime,shared,driveId",
    supportsAllDrives: "true",
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
  parentId: string = "root",
  driveId?: string
) {
  const metadata: Record<string, unknown> = {
    name,
    mimeType: "application/vnd.google-apps.folder",
    parents: [parentId],
  };

  if (driveId) {
    metadata.driveId = driveId;
  }

  const params = new URLSearchParams({ supportsAllDrives: "true" });

  const response = await fetch(`${GOOGLE_DRIVE_API}/files?${params.toString()}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create folder: ${error}`);
  }

  const folder = await response.json();
  return jsonResponse({ folder });
}

async function handleDelete(accessToken: string, fileId: string) {
  const params = new URLSearchParams({ supportsAllDrives: "true" });

  const response = await fetch(`${GOOGLE_DRIVE_API}/files/${fileId}?${params.toString()}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok && response.status !== 204 && response.status !== 404) {
    throw new Error("Failed to delete file");
  }

  return jsonResponse({ success: true });
}

async function handleUpload(
  accessToken: string,
  formData: FormData | null,
  parentId: string,
  driveId?: string
) {
  if (!formData) {
    return jsonResponse({ error: "No form data provided" }, 400);
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return jsonResponse({ error: "No file provided" }, 400);
  }

  const metadata: Record<string, unknown> = {
    name: file.name,
    parents: [parentId],
  };

  if (driveId) {
    metadata.driveId = driveId;
  }

  const boundary = "drive_upload_boundary_" + Date.now();
  const metadataStr = JSON.stringify(metadata);
  const fileBytes = new Uint8Array(await file.arrayBuffer());

  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];

  parts.push(encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadataStr}\r\n`
  ));
  parts.push(encoder.encode(
    `--${boundary}\r\nContent-Type: ${file.type || "application/octet-stream"}\r\n\r\n`
  ));
  parts.push(fileBytes);
  parts.push(encoder.encode(`\r\n--${boundary}--`));

  let totalLength = 0;
  for (const part of parts) totalLength += part.length;
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    combined.set(part, offset);
    offset += part.length;
  }

  const params = new URLSearchParams({
    uploadType: "multipart",
    supportsAllDrives: "true",
    fields: "id,name,mimeType,size,owners,parents,thumbnailLink,webViewLink,iconLink,createdTime,modifiedTime",
  });

  const response = await fetch(`${GOOGLE_UPLOAD_API}/files?${params.toString()}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
      "Content-Length": String(combined.length),
    },
    body: combined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload file: ${error}`);
  }

  const uploaded = await response.json();
  return jsonResponse({ file: uploaded });
}

async function handleShare(
  accessToken: string,
  fileId: string,
  email?: string,
  role: string = "reader",
  type: string = "user"
) {
  if (!fileId) {
    return jsonResponse({ error: "fileId is required" }, 400);
  }

  const permission: Record<string, string> = { role, type };
  if (type === "user" || type === "group") {
    if (!email) {
      return jsonResponse({ error: "email is required for user/group sharing" }, 400);
    }
    permission.emailAddress = email;
  }

  const params = new URLSearchParams({
    supportsAllDrives: "true",
    sendNotificationEmail: "true",
  });

  const response = await fetch(
    `${GOOGLE_DRIVE_API}/files/${fileId}/permissions?${params.toString()}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(permission),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to share file: ${error}`);
  }

  const result = await response.json();
  return jsonResponse({ permission: result });
}

async function handleGetShareLink(accessToken: string, fileId: string) {
  if (!fileId) {
    return jsonResponse({ error: "fileId is required" }, 400);
  }

  const params = new URLSearchParams({ supportsAllDrives: "true" });

  const permResponse = await fetch(
    `${GOOGLE_DRIVE_API}/files/${fileId}/permissions?${params.toString()}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    }
  );

  if (!permResponse.ok) {
    const error = await permResponse.text();
    throw new Error(`Failed to create share link: ${error}`);
  }

  const fileParams = new URLSearchParams({
    fields: "webViewLink",
    supportsAllDrives: "true",
  });

  const fileResponse = await fetch(
    `${GOOGLE_DRIVE_API}/files/${fileId}?${fileParams.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!fileResponse.ok) {
    throw new Error("Failed to get share link");
  }

  const fileData = await fileResponse.json();
  return jsonResponse({ link: fileData.webViewLink });
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
