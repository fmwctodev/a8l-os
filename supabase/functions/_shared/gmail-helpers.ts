import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { encryptToken, decryptToken, isEncryptedToken } from "./crypto.ts";
import { resolveRefreshToken, refreshAccessToken, writeMasterToken } from "./google-oauth-helpers.ts";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API_URL = "https://gmail.googleapis.com/gmail/v1";

const MAX_BODY_SIZE = 256_000;

export interface GmailTokenRecord {
  id: string;
  organization_id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  token_expiry: string;
  email: string;
}

export interface ParsedGmailMessage {
  fromEmail: string;
  fromName: string;
  toEmails: string[];
  ccEmails: string[];
  bccEmails: string[];
  subject: string;
  date: string;
  rfcMessageId: string;
  inReplyTo: string;
  references: string;
  threadId: string;
  gmailMessageId: string;
  labelIds: string[];
  snippet: string;
  internalDate: string;
  body: string;
  bodyTruncated: boolean;
  bodySizeBytes: number;
  isHtml: boolean;
  hasAttachments: boolean;
  attachments: AttachmentMeta[];
}

export interface AttachmentMeta {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
}

export function extractEmailAddress(emailString: string): string {
  const match = emailString.match(/<([^>]+)>/);
  if (match) return match[1].toLowerCase();
  return emailString.trim().toLowerCase();
}

export function extractEmailName(emailString: string): string {
  const match = emailString.match(/^"?([^"<]+)"?\s*</);
  if (match) return match[1].trim();
  return "";
}

function parseAddressList(header: string): string[] {
  if (!header) return [];
  return header
    .split(",")
    .map((s) => extractEmailAddress(s.trim()))
    .filter(Boolean);
}

export function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
  } catch {
    return atob(base64);
  }
}

function extractBodyFromParts(
  parts: Array<{
    mimeType: string;
    body?: { data?: string; size?: number };
    parts?: Array<unknown>;
  }>
): { body: string; isHtml: boolean; sizeBytes: number } {
  for (const part of parts) {
    if (part.mimeType === "text/plain" && part.body?.data) {
      const decoded = decodeBase64Url(part.body.data);
      return { body: decoded, isHtml: false, sizeBytes: decoded.length };
    }
  }
  for (const part of parts) {
    if (part.mimeType === "text/html" && part.body?.data) {
      const decoded = decodeBase64Url(part.body.data);
      return { body: decoded, isHtml: true, sizeBytes: decoded.length };
    }
  }
  for (const part of parts) {
    if (
      part.mimeType?.startsWith("multipart/") &&
      Array.isArray(part.parts)
    ) {
      const nested = extractBodyFromParts(
        part.parts as Array<{
          mimeType: string;
          body?: { data?: string; size?: number };
          parts?: Array<unknown>;
        }>
      );
      if (nested.body) return nested;
    }
  }
  return { body: "", isHtml: false, sizeBytes: 0 };
}

export function extractEmailBody(payload: {
  body?: { data?: string; size?: number };
  mimeType?: string;
  parts?: Array<{
    mimeType: string;
    body?: { data?: string; size?: number; attachmentId?: string };
    parts?: Array<unknown>;
    filename?: string;
  }>;
}): { body: string; isHtml: boolean; sizeBytes: number; truncated: boolean } {
  if (payload.body?.data) {
    const decoded = decodeBase64Url(payload.body.data);
    const isHtml = payload.mimeType === "text/html";
    const truncated = decoded.length > MAX_BODY_SIZE;
    return {
      body: truncated ? decoded.substring(0, MAX_BODY_SIZE) : decoded,
      isHtml,
      sizeBytes: decoded.length,
      truncated,
    };
  }

  if (payload.parts) {
    const result = extractBodyFromParts(
      payload.parts as Array<{
        mimeType: string;
        body?: { data?: string; size?: number };
        parts?: Array<unknown>;
      }>
    );
    const truncated = result.sizeBytes > MAX_BODY_SIZE;
    return {
      body: truncated
        ? result.body.substring(0, MAX_BODY_SIZE)
        : result.body,
      isHtml: result.isHtml,
      sizeBytes: result.sizeBytes,
      truncated,
    };
  }

  return { body: "", isHtml: false, sizeBytes: 0, truncated: false };
}

function extractAttachments(
  parts: Array<{
    mimeType: string;
    body?: { attachmentId?: string; size?: number };
    filename?: string;
    parts?: Array<unknown>;
  }>
): AttachmentMeta[] {
  const attachments: AttachmentMeta[] = [];

  for (const part of parts) {
    if (part.body?.attachmentId && part.filename) {
      attachments.push({
        attachmentId: part.body.attachmentId,
        filename: part.filename,
        mimeType: part.mimeType,
        size: part.body.size || 0,
      });
    }
    if (Array.isArray(part.parts)) {
      attachments.push(
        ...extractAttachments(
          part.parts as Array<{
            mimeType: string;
            body?: { attachmentId?: string; size?: number };
            filename?: string;
            parts?: Array<unknown>;
          }>
        )
      );
    }
  }

  return attachments;
}

export function parseGmailMessage(
  msgData: Record<string, unknown>
): ParsedGmailMessage {
  const payload = msgData.payload as {
    headers?: Array<{ name: string; value: string }>;
    body?: { data?: string; size?: number };
    mimeType?: string;
    parts?: Array<{
      mimeType: string;
      body?: { data?: string; size?: number; attachmentId?: string };
      filename?: string;
      parts?: Array<unknown>;
    }>;
  };

  const headers = payload?.headers || [];
  const getHeader = (name: string) =>
    headers.find(
      (h: { name: string }) => h.name.toLowerCase() === name.toLowerCase()
    )?.value || "";

  const from = getHeader("From");
  const to = getHeader("To");
  const cc = getHeader("Cc");
  const bcc = getHeader("Bcc");
  const subject = getHeader("Subject");
  const date = getHeader("Date");
  const rfcMessageId = getHeader("Message-ID") || getHeader("Message-Id");
  const inReplyTo = getHeader("In-Reply-To");
  const references = getHeader("References");

  const bodyResult = extractEmailBody(payload);
  const attachments = payload?.parts
    ? extractAttachments(
        payload.parts as Array<{
          mimeType: string;
          body?: { attachmentId?: string; size?: number };
          filename?: string;
          parts?: Array<unknown>;
        }>
      )
    : [];

  return {
    fromEmail: extractEmailAddress(from),
    fromName: extractEmailName(from),
    toEmails: parseAddressList(to),
    ccEmails: parseAddressList(cc),
    bccEmails: parseAddressList(bcc),
    subject,
    date,
    rfcMessageId,
    inReplyTo,
    references,
    threadId: msgData.threadId as string,
    gmailMessageId: msgData.id as string,
    labelIds: (msgData.labelIds as string[]) || [],
    snippet: (msgData.snippet as string) || "",
    internalDate: msgData.internalDate as string,
    body: bodyResult.body,
    bodyTruncated: bodyResult.truncated,
    bodySizeBytes: bodyResult.sizeBytes,
    isHtml: bodyResult.isHtml,
    hasAttachments: attachments.length > 0,
    attachments,
  };
}

export async function getAccessToken(
  supabase: SupabaseClient,
  tokenData: GmailTokenRecord
): Promise<string> {
  let refreshToken = tokenData.refresh_token;
  if (isEncryptedToken(refreshToken)) {
    refreshToken = await decryptToken(refreshToken);
  }

  const tokenExpiry = new Date(tokenData.token_expiry);
  if (tokenExpiry > new Date(Date.now() + 60 * 1000)) {
    let accessToken = tokenData.access_token;
    if (isEncryptedToken(accessToken)) {
      accessToken = await decryptToken(accessToken);
    }
    return accessToken;
  }

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("Missing Google OAuth credentials");
  }

  const refreshResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!refreshResponse.ok) {
    console.warn("Primary Gmail token refresh failed, trying fallback sources...");

    const fallback = await resolveRefreshToken(supabase, tokenData.user_id, tokenData.organization_id);
    if (fallback) {
      console.log(`Trying fallback refresh token from source: ${fallback.source}`);
      const fallbackResult = await refreshAccessToken(fallback.refreshToken);
      if (fallbackResult) {
        const newExpiry = new Date(Date.now() + fallbackResult.expires_in * 1000).toISOString();
        await updateGmailTokens(supabase, tokenData.id, fallbackResult.access_token, newExpiry, fallback.refreshToken, fallbackResult.refresh_token);

        try {
          await writeMasterToken(supabase, tokenData.organization_id, tokenData.user_id, tokenData.email, fallbackResult.access_token, fallbackResult.refresh_token || fallback.refreshToken, newExpiry, []);
        } catch {}

        return fallbackResult.access_token;
      }
    }

    throw new Error("Failed to refresh Gmail token. Please reconnect.");
  }

  const refreshData = await refreshResponse.json();
  const newAccessToken = refreshData.access_token;
  const newExpiry = new Date(
    Date.now() + refreshData.expires_in * 1000
  ).toISOString();

  await updateGmailTokens(supabase, tokenData.id, newAccessToken, newExpiry, refreshToken, refreshData.refresh_token);

  try {
    await writeMasterToken(supabase, tokenData.organization_id, tokenData.user_id, tokenData.email, newAccessToken, refreshData.refresh_token || refreshToken, newExpiry, []);
  } catch {}

  return newAccessToken;
}

async function updateGmailTokens(
  supabase: SupabaseClient,
  tokenId: string,
  newAccessToken: string,
  newExpiry: string,
  currentRefreshToken: string,
  newRefreshToken?: string
): Promise<void> {
  let storedAccess: string;
  try {
    storedAccess = await encryptToken(newAccessToken);
  } catch {
    storedAccess = newAccessToken;
  }

  const updatePayload: Record<string, string> = {
    access_token: storedAccess,
    token_expiry: newExpiry,
    updated_at: new Date().toISOString(),
  };

  if (newRefreshToken) {
    try {
      updatePayload.refresh_token = await encryptToken(newRefreshToken);
    } catch {
      updatePayload.refresh_token = newRefreshToken;
    }
  } else {
    try {
      updatePayload.refresh_token = await encryptToken(currentRefreshToken);
    } catch {
      updatePayload.refresh_token = currentRefreshToken;
    }
  }

  await supabase
    .from("gmail_oauth_tokens")
    .update(updatePayload)
    .eq("id", tokenId);
}

export async function processGmailMessage(
  supabase: SupabaseClient,
  msgData: Record<string, unknown>,
  orgId: string,
  userId: string,
  tokenEmail: string,
  syncSource: string
): Promise<{ processed: boolean; messageId?: string }> {
  const parsed = parseGmailMessage(msgData);

  const isOutbound =
    parsed.fromEmail.toLowerCase() === tokenEmail.toLowerCase() ||
    parsed.labelIds.includes("SENT");

  const isInbound = !isOutbound;

  const contactEmail = isInbound
    ? parsed.fromEmail
    : parsed.toEmails[0] || "";

  if (!contactEmail) return { processed: false };

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, department_id, first_name, last_name")
    .eq("organization_id", orgId)
    .ilike("email", contactEmail)
    .eq("status", "active")
    .maybeSingle();

  if (!contact) return { processed: false };

  let conversation = null;
  const { data: existingConv } = await supabase
    .from("conversations")
    .select("id")
    .eq("organization_id", orgId)
    .eq("contact_id", contact.id)
    .neq("status", "closed")
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingConv) {
    conversation = existingConv;
  } else {
    const { data: newConv } = await supabase
      .from("conversations")
      .insert({
        organization_id: orgId,
        contact_id: contact.id,
        department_id: contact.department_id,
        status: "open",
        unread_count: 0,
      })
      .select()
      .single();

    conversation = newConv;

    await supabase.from("inbox_events").insert({
      organization_id: orgId,
      conversation_id: conversation.id,
      event_type: "conversation_created",
      payload: {
        channel: "email",
        contact_name: `${contact.first_name} ${contact.last_name}`,
      },
    });
  }

  const sentAt = parsed.date
    ? new Date(parsed.date).toISOString()
    : new Date(parseInt(parsed.internalDate)).toISOString();

  const { data: insertedMsg } = await supabase
    .from("messages")
    .insert({
      organization_id: orgId,
      conversation_id: conversation.id,
      contact_id: contact.id,
      channel: "email",
      direction: isInbound ? "inbound" : "outbound",
      body: parsed.body.substring(0, MAX_BODY_SIZE),
      subject: parsed.subject,
      metadata: {
        from_email: parsed.fromEmail,
        from_name: parsed.fromName,
        to_emails: parsed.toEmails,
        cc_emails: parsed.ccEmails,
        bcc_emails: parsed.bccEmails,
        thread_id: parsed.threadId,
        gmail_message_id: parsed.gmailMessageId,
        rfc_message_id: parsed.rfcMessageId,
        in_reply_to: parsed.inReplyTo,
        references: parsed.references,
        label_ids: parsed.labelIds,
        has_attachments: parsed.hasAttachments,
        body_truncated: parsed.bodyTruncated,
        body_size_bytes: parsed.bodySizeBytes,
        synced_via: syncSource,
      },
      status: "delivered",
      external_id: parsed.gmailMessageId,
      sent_at: sentAt,
    })
    .select("id")
    .maybeSingle();

  if (parsed.hasAttachments && parsed.attachments.length > 0) {
    const attachmentRows = parsed.attachments.map((att) => ({
      organization_id: orgId,
      user_id: userId,
      gmail_message_id: parsed.gmailMessageId,
      attachment_id: att.attachmentId,
      filename: att.filename,
      mime_type: att.mimeType,
      size_bytes: att.size,
    }));

    await supabase.from("gmail_attachments").upsert(attachmentRows, {
      onConflict: "gmail_message_id,attachment_id",
      ignoreDuplicates: true,
    });
  }

  if (isInbound) {
    const { data: convData } = await supabase
      .from("conversations")
      .select("unread_count")
      .eq("id", conversation.id)
      .single();

    await supabase
      .from("conversations")
      .update({
        unread_count: (convData?.unread_count || 0) + 1,
        last_message_at: sentAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversation.id);
  } else {
    await supabase
      .from("conversations")
      .update({
        last_message_at: sentAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversation.id);
  }

  if (insertedMsg) {
    await supabase.from("crm_email_links").upsert(
      {
        organization_id: orgId,
        user_id: userId,
        message_id: insertedMsg.id,
        record_type: "contact",
        record_id: contact.id,
      },
      { onConflict: "organization_id,message_id,record_type,record_id", ignoreDuplicates: true }
    );
  }

  return { processed: true, messageId: insertedMsg?.id };
}

export function encodeBase64Url(str: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const bytes = new Uint8Array(data);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function buildRawEmail(params: {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
  fromEmail?: string;
}): string {
  const lines: string[] = [];
  if (params.fromEmail) lines.push(`From: ${params.fromEmail}`);
  lines.push(`To: ${params.to}`);
  if (params.cc) lines.push(`Cc: ${params.cc}`);
  if (params.bcc) lines.push(`Bcc: ${params.bcc}`);
  lines.push(`Subject: ${params.subject}`);
  if (params.inReplyTo) lines.push(`In-Reply-To: ${params.inReplyTo}`);
  if (params.references) lines.push(`References: ${params.references}`);
  lines.push("Content-Type: text/html; charset=utf-8");
  lines.push("MIME-Version: 1.0");
  lines.push("");
  lines.push(params.body);
  return encodeBase64Url(lines.join("\r\n"));
}

export { GMAIL_API_URL, GOOGLE_TOKEN_URL };
