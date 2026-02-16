const DRIVE_API = "https://www.googleapis.com/drive/v3";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  createdTime?: string;
  modifiedTime?: string;
}

interface DriveSearchResult {
  files: DriveFile[];
}

export async function searchDriveFiles(
  accessToken: string,
  query: string,
  fields = "files(id,name,mimeType,webViewLink,createdTime,modifiedTime)"
): Promise<DriveFile[]> {
  const url = new URL(`${DRIVE_API}/files`);
  url.searchParams.set("q", query);
  url.searchParams.set("fields", fields);
  url.searchParams.set("pageSize", "10");
  url.searchParams.set("orderBy", "modifiedTime desc");

  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("[DriveSearch] API error:", resp.status, errText);
    return [];
  }

  const data: DriveSearchResult = await resp.json();
  return data.files || [];
}

function escapeQuery(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function buildDateRange(meetingDate: string): { after: string; before: string } {
  const d = new Date(meetingDate);
  const dayBefore = new Date(d.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAfter = new Date(d.getTime() + 2 * 24 * 60 * 60 * 1000);
  return {
    after: dayBefore.toISOString().split("T")[0],
    before: twoDaysAfter.toISOString().split("T")[0],
  };
}

export async function findMeetRecordingInDrive(
  accessToken: string,
  eventTitle: string,
  _conferenceId: string | null,
  meetingDate: string
): Promise<DriveFile | null> {
  const { after, before } = buildDateRange(meetingDate);
  const safeTitle = escapeQuery(eventTitle);

  const queries = [
    `name contains '${safeTitle}' and mimeType contains 'video/' and createdTime > '${after}' and createdTime < '${before}' and trashed = false`,
    `'Meet Recordings' in parents and name contains '${safeTitle}' and trashed = false`,
    `mimeType contains 'video/' and name contains 'Meet Recording' and createdTime > '${after}' and createdTime < '${before}' and trashed = false`,
  ];

  for (const q of queries) {
    const files = await searchDriveFiles(accessToken, q);
    if (files.length > 0) return files[0];
  }

  return null;
}

export async function findMeetTranscriptInDrive(
  accessToken: string,
  eventTitle: string,
  meetingDate: string
): Promise<DriveFile | null> {
  const { after, before } = buildDateRange(meetingDate);
  const safeTitle = escapeQuery(eventTitle);

  const queries = [
    `name contains '${safeTitle}' and name contains 'Transcript' and mimeType = 'application/vnd.google-apps.document' and createdTime > '${after}' and createdTime < '${before}' and trashed = false`,
    `name contains 'Transcript' and name contains '${safeTitle}' and trashed = false and createdTime > '${after}'`,
    `mimeType = 'application/vnd.google-apps.document' and name contains 'Transcript' and createdTime > '${after}' and createdTime < '${before}' and trashed = false`,
  ];

  for (const q of queries) {
    const files = await searchDriveFiles(accessToken, q);
    if (files.length > 0) return files[0];
  }

  return null;
}

export async function findGeminiNotesInDrive(
  accessToken: string,
  eventTitle: string,
  meetingDate: string
): Promise<DriveFile | null> {
  const { after, before } = buildDateRange(meetingDate);
  const safeTitle = escapeQuery(eventTitle);

  const queries = [
    `name contains '${safeTitle}' and (name contains 'Notes' or name contains 'Summary') and mimeType = 'application/vnd.google-apps.document' and createdTime > '${after}' and createdTime < '${before}' and trashed = false`,
    `name contains 'Meeting notes' and name contains '${safeTitle}' and trashed = false and createdTime > '${after}'`,
    `mimeType = 'application/vnd.google-apps.document' and (name contains 'Meeting notes' or name contains 'meeting summary') and createdTime > '${after}' and createdTime < '${before}' and trashed = false`,
  ];

  for (const q of queries) {
    const files = await searchDriveFiles(accessToken, q);
    if (files.length > 0) return files[0];
  }

  return null;
}

export async function exportGoogleDoc(
  accessToken: string,
  fileId: string
): Promise<string> {
  const url = `${DRIVE_API}/files/${fileId}/export?mimeType=text/plain`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Drive export failed (${resp.status}): ${errText}`);
  }

  return resp.text();
}

export async function getFileWebViewLink(
  accessToken: string,
  fileId: string
): Promise<string | null> {
  const url = `${DRIVE_API}/files/${fileId}?fields=webViewLink`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!resp.ok) return null;

  const data = await resp.json();
  return data.webViewLink || null;
}

export interface EnrichedActionItem {
  description: string;
  assignee?: string;
  due_date?: string;
  priority: "low" | "medium" | "high";
  raw_text: string;
}

function inferPriority(text: string): "low" | "medium" | "high" {
  const lower = text.toLowerCase();
  const highKeywords = [
    "urgent", "asap", "critical", "immediately", "high priority",
    "top priority", "blocker", "blocking", "must", "required",
  ];
  const lowKeywords = [
    "low priority", "nice to have", "optional", "when possible",
    "if time permits", "eventually",
  ];
  for (const kw of highKeywords) {
    if (lower.includes(kw)) return "high";
  }
  for (const kw of lowKeywords) {
    if (lower.includes(kw)) return "low";
  }
  return "medium";
}

function parseNaturalDate(text: string, referenceDate: Date): string | undefined {
  const lower = text.toLowerCase();

  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

  const eodMatch = lower.match(/\b(by\s+)?eod\b|\bend\s+of\s+day\b/);
  if (eodMatch) {
    const d = new Date(referenceDate);
    d.setHours(17, 0, 0, 0);
    return d.toISOString();
  }

  const eowMatch = lower.match(/\bend\s+of\s+week\b|\beow\b/);
  if (eowMatch) {
    const d = new Date(referenceDate);
    const daysUntilFriday = (5 - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + daysUntilFriday);
    d.setHours(17, 0, 0, 0);
    return d.toISOString();
  }

  const eomMatch = lower.match(/\bend\s+of\s+month\b|\beom\b/);
  if (eomMatch) {
    const d = new Date(referenceDate);
    d.setMonth(d.getMonth() + 1, 0);
    d.setHours(17, 0, 0, 0);
    return d.toISOString();
  }

  const tomorrowMatch = lower.match(/\btomorrow\b/);
  if (tomorrowMatch) {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() + 1);
    d.setHours(17, 0, 0, 0);
    return d.toISOString();
  }

  const nextWeekMatch = lower.match(/\bnext\s+week\b/);
  if (nextWeekMatch) {
    const d = new Date(referenceDate);
    const daysUntilMonday = (1 - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + daysUntilMonday);
    d.setHours(9, 0, 0, 0);
    return d.toISOString();
  }

  for (let i = 0; i < dayNames.length; i++) {
    const pattern = new RegExp(`\\b(by\\s+|next\\s+)?${dayNames[i]}\\b`);
    if (pattern.test(lower)) {
      const d = new Date(referenceDate);
      const daysUntil = (i - d.getDay() + 7) % 7 || 7;
      d.setDate(d.getDate() + daysUntil);
      d.setHours(17, 0, 0, 0);
      return d.toISOString();
    }
  }

  const inDaysMatch = lower.match(/\bin\s+(\d+)\s+days?\b/);
  if (inDaysMatch) {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() + parseInt(inDaysMatch[1], 10));
    d.setHours(17, 0, 0, 0);
    return d.toISOString();
  }

  return undefined;
}

function extractAssignee(text: string): { cleanText: string; assignee?: string } {
  const patterns = [
    /\(([^)]+)\)\s*$/,
    /\b(?:assigned\s+to|owner|responsible)\s*:\s*(.+?)(?:\s*[-–]|$)/i,
    /\b@(\w+(?:\s+\w+)?)/,
    /^(.+?)\s+will\s+/i,
    /\baction\s+for\s+(.+?):/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      if (name.length > 1 && name.length < 50) {
        if (pattern === patterns[3]) {
          return { cleanText: text, assignee: name };
        }
        return {
          cleanText: text.replace(match[0], "").trim(),
          assignee: name,
        };
      }
    }
  }

  return { cleanText: text };
}

export function parseGeminiNotesForActionItems(
  content: string,
  meetingDate?: string
): EnrichedActionItem[] {
  const items: EnrichedActionItem[] = [];
  const lines = content.split("\n");
  const refDate = meetingDate ? new Date(meetingDate) : new Date();

  let inActionSection = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const lower = trimmed.toLowerCase();

    if (
      lower.includes("action item") ||
      lower.includes("next step") ||
      lower.includes("to-do") ||
      lower.includes("todo") ||
      lower.includes("follow up") ||
      lower.includes("follow-up")
    ) {
      inActionSection = true;
      continue;
    }

    if (inActionSection && trimmed === "") {
      if (i + 1 < lines.length) {
        const nextTrimmed = lines[i + 1].trim();
        if (nextTrimmed && !nextTrimmed.startsWith("-") && !nextTrimmed.startsWith("*") && !nextTrimmed.match(/^\d+\./)) {
          inActionSection = false;
        }
      }
      continue;
    }

    if (inActionSection) {
      const bulletMatch = trimmed.match(/^[-*]\s+(.+)/) || trimmed.match(/^\d+\.\s+(.+)/);
      if (bulletMatch) {
        const rawText = bulletMatch[1].trim();
        if (rawText.length > 3) {
          const { cleanText, assignee } = extractAssignee(rawText);
          const priority = inferPriority(rawText);
          const due_date = parseNaturalDate(rawText, refDate);

          items.push({
            description: cleanText,
            assignee,
            due_date,
            priority,
            raw_text: rawText,
          });
        }
      }
    }
  }

  return items;
}

export function parseGeminiNotesForKeyPoints(content: string): string[] {
  const points: string[] = [];
  const lines = content.split("\n");

  let inKeySection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const lower = trimmed.toLowerCase();

    if (
      lower.includes("key point") ||
      lower.includes("key takeaway") ||
      lower.includes("summary") ||
      lower.includes("highlights") ||
      lower.includes("discussion point")
    ) {
      inKeySection = true;
      continue;
    }

    if (
      inKeySection &&
      (lower.includes("action item") ||
        lower.includes("next step") ||
        lower.includes("to-do") ||
        lower.includes("follow up"))
    ) {
      inKeySection = false;
      continue;
    }

    if (inKeySection) {
      const bulletMatch = trimmed.match(/^[-*]\s+(.+)/) || trimmed.match(/^\d+\.\s+(.+)/);
      if (bulletMatch) {
        const text = bulletMatch[1].trim();
        if (text.length > 5) {
          points.push(text);
        }
      }
    }
  }

  return points;
}
