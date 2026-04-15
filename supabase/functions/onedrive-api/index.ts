import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCors, jsonResponse, errorResponse, successResponse } from "../_shared/cors.ts";
import { extractUserContext } from "../_shared/auth.ts";
import { getAccessToken, graphRequest, GRAPH_BASE } from "../_shared/microsoft-graph-helpers.ts";

// ─── Main Handler ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const userContext = await extractUserContext(req, supabase);
    if (!userContext) {
      return errorResponse("AUTH_REQUIRED", "Authentication required", 401);
    }

    const { accessToken } = await getAccessToken(supabase, userContext.id);

    // Parse action from body or query param
    let body: Record<string, unknown> = {};
    if (req.method === "POST" || req.method === "PUT") {
      body = await req.json();
    }
    const action: string =
      body.action ||
      new URL(req.url).searchParams.get("action") ||
      "list";

    switch (action) {
      case "list":
        return await handleList(accessToken, body);
      case "search":
        return await handleSearch(accessToken, body);
      case "get-metadata":
        return await handleGetMetadata(accessToken, body);
      case "create-folder":
        return await handleCreateFolder(accessToken, body);
      case "upload":
        return await handleUpload(accessToken, body);
      case "delete":
        return await handleDelete(accessToken, body);
      case "share":
        return await handleShare(accessToken, body);
      case "get-download-url":
        return await handleGetDownloadUrl(accessToken, body);
      case "list-shared":
        return await handleListShared(accessToken, body);
      default:
        return errorResponse("INVALID_ACTION", `Unknown action: ${action}`);
    }
  } catch (err) {
    console.error("[onedrive-api] Error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return errorResponse("INTERNAL_ERROR", message, 500);
  }
});

// ─── List Files/Folders ──────────────────────────────────────────────────────

async function handleList(
  accessToken: string,
  body: Record<string, unknown>
): Promise<Response> {
  const folderId = body.folderId as string | undefined;
  const top = (body.top as number) || 100;
  const skipToken = body.skipToken as string | undefined;

  let path: string;
  if (folderId) {
    path = `/me/drive/items/${folderId}/children`;
  } else {
    path = "/me/drive/root/children";
  }

  const params = new URLSearchParams({
    $top: String(top),
    $select:
      "id,name,size,file,folder,createdDateTime,lastModifiedDateTime,webUrl,parentReference,@microsoft.graph.downloadUrl",
    $orderby: "name asc",
  });

  if (skipToken) {
    params.set("$skiptoken", skipToken);
  }

  const { status, data } = await graphRequest(
    accessToken,
    `${path}?${params.toString()}`,
    "GET"
  );

  if (status !== 200) {
    console.error("[onedrive-api] List failed:", status, data);
    return errorResponse("LIST_FAILED", `Failed to list files: ${status}`, status);
  }

  const response = data as {
    value?: Array<Record<string, unknown>>;
    "@odata.nextLink"?: string;
  };

  return successResponse({
    items: (response.value || []).map(mapDriveItem),
    nextLink: response["@odata.nextLink"] || null,
  });
}

// ─── Search ──────────────────────────────────────────────────────────────────

async function handleSearch(
  accessToken: string,
  body: Record<string, unknown>
): Promise<Response> {
  const query = body.query as string;
  if (!query) {
    return errorResponse("MISSING_PARAM", "query is required");
  }

  const top = (body.top as number) || 25;
  const params = new URLSearchParams({ $top: String(top) });

  const { status, data } = await graphRequest(
    accessToken,
    `/me/drive/root/search(q='${encodeURIComponent(query)}')?${params.toString()}`,
    "GET"
  );

  if (status !== 200) {
    console.error("[onedrive-api] Search failed:", status, data);
    return errorResponse("SEARCH_FAILED", `Failed to search files: ${status}`, status);
  }

  const response = data as {
    value?: Array<Record<string, unknown>>;
    "@odata.nextLink"?: string;
  };

  return successResponse({
    items: (response.value || []).map(mapDriveItem),
    nextLink: response["@odata.nextLink"] || null,
  });
}

// ─── Get Metadata ────────────────────────────────────────────────────────────

async function handleGetMetadata(
  accessToken: string,
  body: Record<string, unknown>
): Promise<Response> {
  const itemId = body.itemId as string;
  if (!itemId) {
    return errorResponse("MISSING_PARAM", "itemId is required");
  }

  const { status, data } = await graphRequest(
    accessToken,
    `/me/drive/items/${itemId}`,
    "GET"
  );

  if (status !== 200) {
    console.error("[onedrive-api] Get metadata failed:", status, data);
    return errorResponse("METADATA_FAILED", `Failed to get metadata: ${status}`, status);
  }

  return successResponse(mapDriveItem(data as Record<string, unknown>));
}

// ─── Create Folder ───────────────────────────────────────────────────────────

async function handleCreateFolder(
  accessToken: string,
  body: Record<string, unknown>
): Promise<Response> {
  const name = body.name as string;
  if (!name) {
    return errorResponse("MISSING_PARAM", "name is required");
  }

  const parentId = (body.parentId as string) || "root";

  const payload = {
    name,
    folder: {},
    "@microsoft.graph.conflictBehavior": (body.conflictBehavior as string) || "rename",
  };

  const parentPath =
    parentId === "root"
      ? "/me/drive/root/children"
      : `/me/drive/items/${parentId}/children`;

  const { status, data } = await graphRequest(accessToken, parentPath, "POST", payload);

  if (status !== 201 && status !== 200) {
    console.error("[onedrive-api] Create folder failed:", status, data);
    return errorResponse("CREATE_FOLDER_FAILED", `Failed to create folder: ${status}`, status);
  }

  return successResponse(mapDriveItem(data as Record<string, unknown>));
}

// ─── Upload (Small File <=4MB) ───────────────────────────────────────────────

async function handleUpload(
  accessToken: string,
  body: Record<string, unknown>
): Promise<Response> {
  const filename = body.filename as string;
  const content = body.content as string;
  if (!filename || content === undefined) {
    return errorResponse("MISSING_PARAM", "filename and content are required");
  }

  const parentId = (body.parentId as string) || "root";
  const conflictBehavior = (body.conflictBehavior as string) || "rename";

  // Build upload path
  const uploadPath =
    parentId === "root"
      ? `/me/drive/root:/${encodeURIComponent(filename)}:/content`
      : `/me/drive/items/${parentId}:/${encodeURIComponent(filename)}:/content`;

  const url = `${GRAPH_BASE}${uploadPath}?@microsoft.graph.conflictBehavior=${conflictBehavior}`;

  // Determine content type
  const contentType = (body.contentType as string) || "application/octet-stream";

  // If content is base64, decode it; otherwise treat as text
  let bodyData: string | Uint8Array;
  if (body.encoding === "base64") {
    const binaryString = atob(content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    bodyData = bytes;
  } else {
    bodyData = content;
  }

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": contentType,
    },
    body: bodyData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("[onedrive-api] Upload failed:", response.status, errorData);
    return errorResponse(
      "UPLOAD_FAILED",
      `Failed to upload file: ${response.status}`,
      response.status
    );
  }

  const data = await response.json();
  return successResponse(mapDriveItem(data));
}

// ─── Delete ──────────────────────────────────────────────────────────────────

async function handleDelete(
  accessToken: string,
  body: Record<string, unknown>
): Promise<Response> {
  const itemId = body.itemId as string;
  if (!itemId) {
    return errorResponse("MISSING_PARAM", "itemId is required");
  }

  const { status, data } = await graphRequest(
    accessToken,
    `/me/drive/items/${itemId}`,
    "DELETE"
  );

  if (status !== 204 && status !== 200) {
    console.error("[onedrive-api] Delete failed:", status, data);
    return errorResponse("DELETE_FAILED", `Failed to delete item: ${status}`, status);
  }

  return successResponse({ deleted: true, itemId });
}

// ─── Share (Create Link) ─────────────────────────────────────────────────────

async function handleShare(
  accessToken: string,
  body: Record<string, unknown>
): Promise<Response> {
  const itemId = body.itemId as string;
  if (!itemId) {
    return errorResponse("MISSING_PARAM", "itemId is required");
  }

  const linkType = (body.type as string) || "view";
  const scope = (body.scope as string) || "organization";
  const expirationDateTime = body.expirationDateTime as string | undefined;
  const password = body.password as string | undefined;

  const payload: Record<string, unknown> = {
    type: linkType,
    scope,
  };

  if (expirationDateTime) {
    payload.expirationDateTime = expirationDateTime;
  }
  if (password) {
    payload.password = password;
  }

  const { status, data } = await graphRequest(
    accessToken,
    `/me/drive/items/${itemId}/createLink`,
    "POST",
    payload
  );

  if (status !== 200 && status !== 201) {
    console.error("[onedrive-api] Share failed:", status, data);
    return errorResponse("SHARE_FAILED", `Failed to create share link: ${status}`, status);
  }

  const linkData = data as {
    link?: { webUrl?: string; type?: string; scope?: string };
  };

  return successResponse({
    link: linkData.link?.webUrl || null,
    type: linkData.link?.type || linkType,
    scope: linkData.link?.scope || scope,
    raw: data,
  });
}

// ─── Get Download URL ────────────────────────────────────────────────────────

async function handleGetDownloadUrl(
  accessToken: string,
  body: Record<string, unknown>
): Promise<Response> {
  const itemId = body.itemId as string;
  if (!itemId) {
    return errorResponse("MISSING_PARAM", "itemId is required");
  }

  const { status, data } = await graphRequest(
    accessToken,
    `/me/drive/items/${itemId}`,
    "GET"
  );

  if (status !== 200) {
    console.error("[onedrive-api] Get download URL failed:", status, data);
    return errorResponse("DOWNLOAD_URL_FAILED", `Failed to get download URL: ${status}`, status);
  }

  const item = data as Record<string, unknown>;
  const downloadUrl = item["@microsoft.graph.downloadUrl"] as string | undefined;

  return successResponse({
    itemId,
    name: item.name,
    downloadUrl: downloadUrl || null,
    webUrl: item.webUrl || null,
    size: item.size || null,
  });
}

// ─── List Shared With Me ─────────────────────────────────────────────────────

async function handleListShared(
  accessToken: string,
  body: Record<string, unknown>
): Promise<Response> {
  const top = (body.top as number) || 50;
  const params = new URLSearchParams({ $top: String(top) });

  const { status, data } = await graphRequest(
    accessToken,
    `/me/drive/sharedWithMe?${params.toString()}`,
    "GET"
  );

  if (status !== 200) {
    console.error("[onedrive-api] List shared failed:", status, data);
    return errorResponse("LIST_SHARED_FAILED", `Failed to list shared items: ${status}`, status);
  }

  const response = data as {
    value?: Array<Record<string, unknown>>;
    "@odata.nextLink"?: string;
  };

  return successResponse({
    items: (response.value || []).map(mapDriveItem),
    nextLink: response["@odata.nextLink"] || null,
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapDriveItem(item: Record<string, unknown>): Record<string, unknown> {
  const file = item.file as { mimeType?: string } | undefined;
  const folder = item.folder as { childCount?: number } | undefined;
  const parentRef = item.parentReference as {
    driveId?: string;
    id?: string;
    path?: string;
  } | undefined;

  return {
    id: item.id,
    name: item.name,
    type: folder ? "folder" : "file",
    mimeType: file?.mimeType || null,
    size: item.size || null,
    childCount: folder?.childCount ?? null,
    createdAt: item.createdDateTime || null,
    modifiedAt: item.lastModifiedDateTime || null,
    webUrl: item.webUrl || null,
    downloadUrl: (item["@microsoft.graph.downloadUrl"] as string) || null,
    parentId: parentRef?.id || null,
    parentPath: parentRef?.path || null,
  };
}
