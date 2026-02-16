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

export function parseGeminiNotesForActionItems(
  content: string
): { description: string; assignee?: string; due_date?: string }[] {
  const items: { description: string; assignee?: string; due_date?: string }[] = [];
  const lines = content.split("\n");

  let inActionSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
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
      const nextLineIdx = lines.indexOf(line) + 1;
      if (nextLineIdx < lines.length) {
        const nextTrimmed = lines[nextLineIdx].trim();
        if (nextTrimmed && !nextTrimmed.startsWith("-") && !nextTrimmed.startsWith("*") && !nextTrimmed.match(/^\d+\./)) {
          inActionSection = false;
        }
      }
      continue;
    }

    if (inActionSection) {
      const bulletMatch = trimmed.match(/^[-*]\s+(.+)/) || trimmed.match(/^\d+\.\s+(.+)/);
      if (bulletMatch) {
        const text = bulletMatch[1].trim();
        if (text.length > 3) {
          const assigneeMatch = text.match(/\(([^)]+)\)$/);
          items.push({
            description: assigneeMatch ? text.replace(assigneeMatch[0], "").trim() : text,
            assignee: assigneeMatch ? assigneeMatch[1] : undefined,
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
