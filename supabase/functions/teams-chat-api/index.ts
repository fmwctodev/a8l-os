import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCors, jsonResponse, errorResponse, successResponse } from "../_shared/cors.ts";
import { extractUserContext } from "../_shared/auth.ts";
import { getAccessToken, graphRequest } from "../_shared/microsoft-graph-helpers.ts";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChatMember {
  "@odata.type": string;
  roles: string[];
  "user@odata.bind": string;
}

interface CreateChatPayload {
  chatType: "oneOnOne" | "group";
  topic?: string;
  members: ChatMember[];
}

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
    if (req.method === "POST") {
      body = await req.json();
    }
    const action: string =
      body.action ||
      new URL(req.url).searchParams.get("action") ||
      "list-chats";

    switch (action) {
      case "list-chats":
        return await handleListChats(accessToken, body);
      case "get-messages":
        return await handleGetMessages(accessToken, body);
      case "send-message":
        return await handleSendMessage(accessToken, body);
      case "list-members":
        return await handleListMembers(accessToken, body);
      case "create-chat":
        return await handleCreateChat(accessToken, body, userContext.id);
      default:
        return errorResponse("INVALID_ACTION", `Unknown action: ${action}`);
    }
  } catch (err) {
    console.error("[teams-chat-api] Error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return errorResponse("INTERNAL_ERROR", message, 500);
  }
});

// ─── List Chats ──────────────────────────────────────────────────────────────

async function handleListChats(
  accessToken: string,
  body: Record<string, unknown>
): Promise<Response> {
  const top = (body.top as number) || 50;
  const skipToken = body.skipToken as string | undefined;

  const params = new URLSearchParams({
    $top: String(top),
    $expand: "lastMessagePreview",
    $orderby: "lastMessagePreview/createdDateTime desc",
  });

  if (skipToken) {
    params.set("$skiptoken", skipToken);
  }

  const { status, data } = await graphRequest(
    accessToken,
    `/me/chats?${params.toString()}`,
    "GET"
  );

  if (status !== 200) {
    console.error("[teams-chat-api] List chats failed:", status, data);
    return errorResponse("LIST_CHATS_FAILED", `Failed to list chats: ${status}`, status);
  }

  const response = data as {
    value?: Array<Record<string, unknown>>;
    "@odata.nextLink"?: string;
  };

  const chats = (response.value || []).map((chat) => {
    const lastMessage = chat.lastMessagePreview as Record<string, unknown> | undefined;
    const lastMessageBody = lastMessage?.body as { content?: string } | undefined;

    return {
      id: chat.id,
      topic: chat.topic || null,
      chatType: chat.chatType,
      createdDateTime: chat.createdDateTime,
      lastUpdatedDateTime: chat.lastUpdatedDateTime,
      tenantId: chat.tenantId || null,
      webUrl: chat.webUrl || null,
      lastMessage: lastMessage
        ? {
            id: lastMessage.id,
            createdDateTime: lastMessage.createdDateTime,
            body: lastMessageBody?.content || null,
            from: lastMessage.from || null,
          }
        : null,
    };
  });

  return successResponse({
    chats,
    nextLink: response["@odata.nextLink"] || null,
  });
}

// ─── Get Messages ────────────────────────────────────────────────────────────

async function handleGetMessages(
  accessToken: string,
  body: Record<string, unknown>
): Promise<Response> {
  const chatId = body.chatId as string;
  if (!chatId) {
    return errorResponse("MISSING_PARAM", "chatId is required");
  }

  const top = (body.top as number) || 50;
  const skipToken = body.skipToken as string | undefined;

  const params = new URLSearchParams({
    $top: String(top),
    $orderby: "createdDateTime desc",
  });

  if (skipToken) {
    params.set("$skiptoken", skipToken);
  }

  const { status, data } = await graphRequest(
    accessToken,
    `/me/chats/${chatId}/messages?${params.toString()}`,
    "GET"
  );

  if (status !== 200) {
    console.error("[teams-chat-api] Get messages failed:", status, data);
    return errorResponse("GET_MESSAGES_FAILED", `Failed to get messages: ${status}`, status);
  }

  const response = data as {
    value?: Array<Record<string, unknown>>;
    "@odata.nextLink"?: string;
  };

  const messages = (response.value || []).map((msg) => {
    const msgBody = msg.body as { contentType?: string; content?: string } | undefined;
    const from = msg.from as {
      user?: { id?: string; displayName?: string };
    } | undefined;
    const attachments = msg.attachments as Array<Record<string, unknown>> | undefined;

    return {
      id: msg.id,
      messageType: msg.messageType,
      createdDateTime: msg.createdDateTime,
      lastModifiedDateTime: msg.lastModifiedDateTime,
      deletedDateTime: msg.deletedDateTime || null,
      body: {
        contentType: msgBody?.contentType || "text",
        content: msgBody?.content || "",
      },
      from: from?.user
        ? {
            userId: from.user.id,
            displayName: from.user.displayName,
          }
        : null,
      importance: msg.importance || "normal",
      attachments: (attachments || []).map((att) => ({
        id: att.id,
        contentType: att.contentType,
        name: att.name,
        contentUrl: att.contentUrl,
      })),
    };
  });

  return successResponse({
    messages,
    nextLink: response["@odata.nextLink"] || null,
  });
}

// ─── Send Message ────────────────────────────────────────────────────────────

async function handleSendMessage(
  accessToken: string,
  body: Record<string, unknown>
): Promise<Response> {
  const chatId = body.chatId as string;
  if (!chatId) {
    return errorResponse("MISSING_PARAM", "chatId is required");
  }

  const content = body.content as string;
  if (!content) {
    return errorResponse("MISSING_PARAM", "content is required");
  }

  const contentType = (body.contentType as string) || "html";

  const payload = {
    body: {
      contentType,
      content,
    },
  };

  const { status, data } = await graphRequest(
    accessToken,
    `/me/chats/${chatId}/messages`,
    "POST",
    payload
  );

  if (status !== 201 && status !== 200) {
    console.error("[teams-chat-api] Send message failed:", status, data);
    return errorResponse("SEND_FAILED", `Failed to send message: ${status}`, status);
  }

  return successResponse(data);
}

// ─── List Members ────────────────────────────────────────────────────────────

async function handleListMembers(
  accessToken: string,
  body: Record<string, unknown>
): Promise<Response> {
  const chatId = body.chatId as string;
  if (!chatId) {
    return errorResponse("MISSING_PARAM", "chatId is required");
  }

  const { status, data } = await graphRequest(
    accessToken,
    `/me/chats/${chatId}/members`,
    "GET"
  );

  if (status !== 200) {
    console.error("[teams-chat-api] List members failed:", status, data);
    return errorResponse("LIST_MEMBERS_FAILED", `Failed to list members: ${status}`, status);
  }

  const response = data as {
    value?: Array<Record<string, unknown>>;
  };

  const members = (response.value || []).map((member) => ({
    id: member.id,
    displayName: member.displayName || null,
    userId: member.userId || null,
    email: member.email || null,
    roles: member.roles || [],
    visibleHistoryStartDateTime: member.visibleHistoryStartDateTime || null,
  }));

  return successResponse({ members });
}

// ─── Create Chat ─────────────────────────────────────────────────────────────

async function handleCreateChat(
  accessToken: string,
  body: Record<string, unknown>,
  currentUserId: string
): Promise<Response> {
  const memberEmails = body.members as string[];
  if (!memberEmails || !Array.isArray(memberEmails) || memberEmails.length === 0) {
    return errorResponse(
      "MISSING_PARAM",
      "members (array of user IDs or UPNs) is required"
    );
  }

  const chatType = memberEmails.length === 1 ? "oneOnOne" : "group";

  // Build member list including the current user
  const members: ChatMember[] = [
    {
      "@odata.type": "#microsoft.graph.aadUserConversationMember",
      roles: ["owner"],
      "user@odata.bind": `https://graph.microsoft.com/v1.0/users('${currentUserId}')`,
    },
  ];

  for (const member of memberEmails) {
    members.push({
      "@odata.type": "#microsoft.graph.aadUserConversationMember",
      roles: [],
      "user@odata.bind": `https://graph.microsoft.com/v1.0/users('${member}')`,
    });
  }

  const payload: CreateChatPayload = {
    chatType,
    members,
  };

  if (body.topic && chatType === "group") {
    payload.topic = body.topic as string;
  }

  const { status, data } = await graphRequest(
    accessToken,
    "/me/chats",
    "POST",
    payload as unknown as Record<string, unknown>
  );

  if (status !== 201 && status !== 200) {
    console.error("[teams-chat-api] Create chat failed:", status, data);
    return errorResponse("CREATE_CHAT_FAILED", `Failed to create chat: ${status}`, status);
  }

  return successResponse(data);
}
