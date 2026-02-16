import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveRefreshToken, refreshAccessToken } from "../_shared/google-oauth-helpers.ts";
import {
  findMeetRecordingInDrive,
  findMeetTranscriptInDrive,
  findGeminiNotesInDrive,
  exportGoogleDoc,
  parseGeminiNotesForActionItems,
  parseGeminiNotesForKeyPoints,
  type EnrichedActionItem,
} from "../_shared/google-drive-helpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const MAX_SESSIONS_PER_RUN = 10;
const MAX_RETRIES = 5;
const NO_ARTIFACTS_CUTOFF_HOURS = 48;

function getSupabaseClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

type Supabase = ReturnType<typeof getSupabaseClient>;

interface MeetSession {
  id: string;
  org_id: string;
  user_id: string;
  connection_id: string;
  google_event_id: string;
  meet_conference_id: string | null;
  calendar_event_summary: string | null;
  event_start_time: string | null;
  event_end_time: string | null;
  organizer_email: string | null;
  attendees: { email?: string; displayName?: string; responseStatus?: string }[];
  meet_link: string | null;
  html_link: string | null;
  status: string;
  retry_count: number;
}

async function getValidAccessToken(
  supabase: Supabase,
  session: MeetSession
): Promise<string> {
  const { data: connection } = await supabase
    .from("google_calendar_connections")
    .select("access_token, refresh_token, token_expiry")
    .eq("id", session.connection_id)
    .maybeSingle();

  if (!connection) throw new Error("Calendar connection not found");

  const expiry = new Date(connection.token_expiry);
  if (expiry.getTime() - Date.now() > 60_000) {
    return connection.access_token;
  }

  let result: { access_token: string; expires_in: number; refresh_token?: string };
  try {
    const resp = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: connection.refresh_token,
        client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
        client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
        grant_type: "refresh_token",
      }),
    });
    if (!resp.ok) throw new Error("Direct refresh failed");
    result = await resp.json();
  } catch {
    const fallback = await resolveRefreshToken(supabase, session.user_id, session.org_id);
    if (!fallback) throw new Error("No refresh token available");
    const fallbackResult = await refreshAccessToken(fallback.refreshToken);
    if (!fallbackResult) throw new Error("All token refresh sources exhausted");
    result = fallbackResult;
  }

  const newExpiry = new Date(Date.now() + result.expires_in * 1000).toISOString();
  const updateData: Record<string, unknown> = {
    access_token: result.access_token,
    token_expiry: newExpiry,
  };
  if (result.refresh_token) updateData.refresh_token = result.refresh_token;

  await supabase
    .from("google_calendar_connections")
    .update(updateData)
    .eq("id", session.connection_id);

  return result.access_token;
}

async function processSession(supabase: Supabase, session: MeetSession): Promise<void> {
  await supabase
    .from("google_meet_sessions")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .eq("id", session.id);

  const accessToken = await getValidAccessToken(supabase, session);
  const eventTitle = session.calendar_event_summary || "Meeting";
  const meetingDate = session.event_start_time || new Date().toISOString();

  let recordingFileId: string | null = null;
  let recordingUrl: string | null = null;
  let transcriptFileId: string | null = null;
  let transcriptUrl: string | null = null;
  let transcriptContent: string | null = null;
  let geminiNotesFileId: string | null = null;
  let geminiNotesUrl: string | null = null;
  let geminiNotesContent: string | null = null;

  const recording = await findMeetRecordingInDrive(
    accessToken, eventTitle, session.meet_conference_id, meetingDate
  );
  if (recording) {
    recordingFileId = recording.id;
    recordingUrl = recording.webViewLink || null;
  }

  const transcript = await findMeetTranscriptInDrive(accessToken, eventTitle, meetingDate);
  if (transcript) {
    transcriptFileId = transcript.id;
    transcriptUrl = transcript.webViewLink || null;
    try {
      transcriptContent = await exportGoogleDoc(accessToken, transcript.id);
    } catch (e) {
      console.warn("[MeetProcessor] Transcript export failed:", (e as Error).message);
    }
  }

  const geminiNotes = await findGeminiNotesInDrive(accessToken, eventTitle, meetingDate);
  if (geminiNotes) {
    geminiNotesFileId = geminiNotes.id;
    geminiNotesUrl = geminiNotes.webViewLink || null;
    try {
      geminiNotesContent = await exportGoogleDoc(accessToken, geminiNotes.id);
    } catch (e) {
      console.warn("[MeetProcessor] Gemini notes export failed:", (e as Error).message);
    }
  }

  const hasAnyArtifact = !!(recording || transcript || geminiNotes);

  if (!hasAnyArtifact) {
    const endTime = session.event_end_time ? new Date(session.event_end_time) : new Date();
    const hoursSinceEnd = (Date.now() - endTime.getTime()) / (1000 * 60 * 60);

    if (hoursSinceEnd > NO_ARTIFACTS_CUTOFF_HOURS) {
      await supabase
        .from("google_meet_sessions")
        .update({
          status: "no_artifacts",
          processed: true,
          last_processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.id);
      return;
    }

    await supabase
      .from("google_meet_sessions")
      .update({
        status: "detected",
        retry_count: session.retry_count + 1,
        last_processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.id);
    return;
  }

  let summary: string | null = null;
  let keyPoints: string[] = [];
  let actionItems: EnrichedActionItem[] = [];

  if (geminiNotesContent) {
    summary = geminiNotesContent.substring(0, 2000);
    keyPoints = parseGeminiNotesForKeyPoints(geminiNotesContent);
    actionItems = parseGeminiNotesForActionItems(geminiNotesContent, meetingDate);
  }

  const durationMinutes = session.event_start_time && session.event_end_time
    ? Math.round((new Date(session.event_end_time).getTime() - new Date(session.event_start_time).getTime()) / 60000)
    : null;

  const participants = (session.attendees || [])
    .filter((a: { email?: string }) => a.email)
    .map((a: { email?: string; displayName?: string }) => ({
      name: a.displayName || a.email || "",
      email: a.email || "",
    }));

  const { data: existingTranscription } = await supabase
    .from("meeting_transcriptions")
    .select("id")
    .eq("org_id", session.org_id)
    .eq("meeting_source", "google_meet")
    .eq("external_meeting_id", session.google_event_id)
    .maybeSingle();

  let meetingTranscriptionId: string | null = null;

  if (existingTranscription) {
    meetingTranscriptionId = existingTranscription.id;
    await supabase
      .from("meeting_transcriptions")
      .update({
        meeting_title: eventTitle,
        meeting_date: meetingDate,
        duration_minutes: durationMinutes,
        participants,
        transcript_text: transcriptContent || "",
        summary,
        key_points: keyPoints,
        action_items: actionItems,
        recording_url: recordingUrl,
        recording_file_id: recordingFileId,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingTranscription.id);
  } else {
    const { data: newTranscription } = await supabase
      .from("meeting_transcriptions")
      .insert({
        org_id: session.org_id,
        meeting_source: "google_meet",
        external_meeting_id: session.google_event_id,
        meeting_title: eventTitle,
        meeting_date: meetingDate,
        duration_minutes: durationMinutes,
        participants,
        transcript_text: transcriptContent || "",
        summary,
        key_points: keyPoints,
        action_items: actionItems,
        recording_url: recordingUrl,
        recording_file_id: recordingFileId,
        imported_by: session.user_id,
        processed_at: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();

    if (newTranscription) {
      meetingTranscriptionId = newTranscription.id;
    }
  }

  const attendeeEmails = (session.attendees || [])
    .map((a: { email?: string }) => a.email?.toLowerCase())
    .filter(Boolean) as string[];

  if (session.organizer_email) {
    const orgEmail = session.organizer_email.toLowerCase();
    if (!attendeeEmails.includes(orgEmail)) {
      attendeeEmails.push(orgEmail);
    }
  }

  let matchedContacts: { id: string; email: string }[] = [];

  if (attendeeEmails.length > 0) {
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, email")
      .eq("organization_id", session.org_id)
      .in("email", attendeeEmails);

    matchedContacts = (contacts || []).filter(
      (c: { id: string; email: string }) => c.email
    );
  }

  if (meetingTranscriptionId && matchedContacts.length > 0) {
    for (const contact of matchedContacts) {
      await supabase
        .from("meeting_transcription_contacts")
        .upsert(
          {
            org_id: session.org_id,
            meeting_transcription_id: meetingTranscriptionId,
            contact_id: contact.id,
            participant_email: contact.email,
          },
          { onConflict: "meeting_transcription_id,contact_id" }
        );
    }
  }

  if (matchedContacts.length > 0) {
    await upsertContactNotes(supabase, session, matchedContacts, {
      recordingUrl,
      transcriptUrl,
      geminiNotesContent,
      geminiNotesUrl,
      recordingFileId,
      transcriptFileId,
      geminiNotesFileId,
      meetingTranscriptionId,
      durationMinutes,
    });
  }

  if (matchedContacts.length > 0 && actionItems.length > 0 && meetingTranscriptionId) {
    await createContactTasks(supabase, session, matchedContacts, actionItems, meetingTranscriptionId);
  }

  if (meetingTranscriptionId) {
    await publishMeetingProcessedEvent(supabase, session, meetingTranscriptionId, matchedContacts, actionItems, {
      hasRecording: !!recording,
      hasTranscript: !!transcript,
      hasGeminiNotes: !!geminiNotes,
      durationMinutes,
    });
  }

  await supabase
    .from("google_meet_sessions")
    .update({
      recording_file_id: recordingFileId,
      recording_url: recordingUrl,
      transcript_file_id: transcriptFileId,
      transcript_url: transcriptUrl,
      transcript_content: transcriptContent,
      gemini_notes_file_id: geminiNotesFileId,
      gemini_notes_url: geminiNotesUrl,
      gemini_notes_content: geminiNotesContent,
      meeting_transcription_id: meetingTranscriptionId,
      status: "completed",
      processed: true,
      processing_error: null,
      last_processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.id);
}

interface NoteArtifacts {
  recordingUrl: string | null;
  transcriptUrl: string | null;
  geminiNotesContent: string | null;
  geminiNotesUrl: string | null;
  recordingFileId: string | null;
  transcriptFileId: string | null;
  geminiNotesFileId: string | null;
  meetingTranscriptionId: string | null;
  durationMinutes: number | null;
}

async function upsertContactNotes(
  supabase: Supabase,
  session: MeetSession,
  contacts: { id: string; email: string }[],
  artifacts: NoteArtifacts
): Promise<void> {
  const eventTitle = session.calendar_event_summary || "Meeting";
  const noteTitle = `Google Meet -- ${eventTitle}`;

  const startFormatted = session.event_start_time
    ? new Date(session.event_start_time).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Unknown";
  const endFormatted = session.event_end_time
    ? new Date(session.event_end_time).toLocaleString("en-US", { timeStyle: "short" })
    : "";

  const attendeeList = (session.attendees || [])
    .map((a: { displayName?: string; email?: string }) =>
      a.displayName ? `${a.displayName} (${a.email})` : a.email
    )
    .join(", ");

  let content = `Meeting: ${eventTitle}\n`;
  content += `Date: ${startFormatted}${endFormatted ? ` - ${endFormatted}` : ""}\n`;
  if (artifacts.durationMinutes) content += `Duration: ${artifacts.durationMinutes} minutes\n`;
  if (session.organizer_email) content += `Organizer: ${session.organizer_email}\n`;
  if (attendeeList) content += `Attendees: ${attendeeList}\n`;
  content += "\n";

  if (session.meet_link) content += `Meet Link: ${session.meet_link}\n`;
  if (artifacts.recordingUrl) content += `Recording: ${artifacts.recordingUrl}\n`;
  if (artifacts.transcriptUrl) content += `Transcript: ${artifacts.transcriptUrl}\n`;
  if (session.html_link) content += `Calendar Event: ${session.html_link}\n`;
  content += "\n";

  if (artifacts.geminiNotesContent) {
    content += `--- Gemini Meeting Notes ---\n${artifacts.geminiNotesContent}\n`;
  }

  const metadata = {
    google_event_id: session.google_event_id,
    meet_conference_id: session.meet_conference_id,
    drive_file_ids: {
      recording: artifacts.recordingFileId,
      transcript: artifacts.transcriptFileId,
      gemini_notes: artifacts.geminiNotesFileId,
    },
    drive_urls: {
      recording: artifacts.recordingUrl,
      transcript: artifacts.transcriptUrl,
      gemini_notes: artifacts.geminiNotesUrl,
    },
    meeting_transcription_id: artifacts.meetingTranscriptionId,
    calendar_html_link: session.html_link,
    meet_link: session.meet_link,
    organizer_email: session.organizer_email,
    attendees: session.attendees,
    duration_minutes: artifacts.durationMinutes,
  };

  for (const contact of contacts) {
    const { data: existing } = await supabase
      .from("contact_notes")
      .select("id")
      .eq("contact_id", contact.id)
      .eq("source_type", "google_meet")
      .eq("source_id", session.google_event_id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("contact_notes")
        .update({
          title: noteTitle,
          content,
          metadata,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      const { data: newNote } = await supabase
        .from("contact_notes")
        .insert({
          contact_id: contact.id,
          user_id: session.user_id,
          title: noteTitle,
          content,
          source_type: "google_meet",
          source_id: session.google_event_id,
          metadata,
        })
        .select("id")
        .maybeSingle();

      if (newNote) {
        await supabase.from("contact_timeline").insert({
          contact_id: contact.id,
          user_id: session.user_id,
          event_type: "note_added",
          metadata: {
            note_id: newNote.id,
            preview: noteTitle,
            source: "google_meet",
          },
        });
      }
    }
  }
}

async function createContactTasks(
  supabase: Supabase,
  session: MeetSession,
  contacts: { id: string; email: string }[],
  actionItems: EnrichedActionItem[],
  meetingTranscriptionId: string
): Promise<void> {
  const eventTitle = session.calendar_event_summary || "Meeting";

  const { data: orgUsers } = await supabase
    .from("users")
    .select("id, name, email")
    .eq("organization_id", session.org_id);

  const userMap = new Map<string, string>();
  for (const u of orgUsers || []) {
    if (u.email) userMap.set(u.email.toLowerCase(), u.id);
    if (u.name) userMap.set(u.name.toLowerCase(), u.id);
  }

  for (const contact of contacts) {
    for (const item of actionItems) {
      const { data: existingActionItem } = await supabase
        .from("meeting_action_items")
        .select("id, status, contact_task_id")
        .eq("meeting_transcription_id", meetingTranscriptionId)
        .eq("contact_id", contact.id)
        .eq("description", item.description)
        .maybeSingle();

      if (existingActionItem) continue;

      let assignedUserId: string | null = null;
      if (item.assignee) {
        assignedUserId = userMap.get(item.assignee.toLowerCase()) || null;
      }
      if (!assignedUserId) assignedUserId = session.user_id;

      const title = item.description.length > 100
        ? item.description.substring(0, 97) + "..."
        : item.description;

      const description = `${item.description}\n\n[Source: Google Meet -- ${eventTitle}]`;

      const { data: newTask } = await supabase
        .from("contact_tasks")
        .insert({
          contact_id: contact.id,
          created_by_user_id: session.user_id,
          assigned_to_user_id: assignedUserId,
          title,
          description,
          due_date: item.due_date || null,
          priority: item.priority,
          status: "pending",
          source_meeting_id: meetingTranscriptionId,
        })
        .select("id")
        .maybeSingle();

      const taskId = newTask?.id || null;

      await supabase.from("meeting_action_items").insert({
        org_id: session.org_id,
        meeting_transcription_id: meetingTranscriptionId,
        contact_id: contact.id,
        contact_task_id: taskId,
        description: item.description,
        assignee_name: item.assignee || null,
        assignee_user_id: assignedUserId,
        due_date: item.due_date || null,
        priority: item.priority,
        status: taskId ? "task_created" : "pending",
        source: "gemini_notes",
        raw_text: item.raw_text,
      });

      if (newTask) {
        await supabase.from("contact_timeline").insert({
          contact_id: contact.id,
          user_id: session.user_id,
          event_type: "task_created",
          metadata: {
            task_id: newTask.id,
            task_title: title,
            source: "google_meet",
            meeting_transcription_id: meetingTranscriptionId,
          },
        });
      }
    }
  }
}

async function publishMeetingProcessedEvent(
  supabase: Supabase,
  session: MeetSession,
  meetingTranscriptionId: string,
  contacts: { id: string; email: string }[],
  actionItems: EnrichedActionItem[],
  artifacts: {
    hasRecording: boolean;
    hasTranscript: boolean;
    hasGeminiNotes: boolean;
    durationMinutes: number | null;
  }
): Promise<void> {
  try {
    await supabase.from("event_outbox").insert({
      organization_id: session.org_id,
      event_type: "meeting_processed",
      payload: {
        meeting_transcription_id: meetingTranscriptionId,
        google_meet_session_id: session.id,
        google_event_id: session.google_event_id,
        contact_ids: contacts.map((c) => c.id),
        action_item_count: actionItems.length,
        has_recording: artifacts.hasRecording,
        has_transcript: artifacts.hasTranscript,
        has_gemini_notes: artifacts.hasGeminiNotes,
        meeting_title: session.calendar_event_summary || "Meeting",
        meeting_date: session.event_start_time || new Date().toISOString(),
        duration_minutes: artifacts.durationMinutes,
      },
    });
  } catch (err) {
    console.warn("[MeetProcessor] Failed to publish meeting_processed event:", (err as Error).message);
  }
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    const supabase = getSupabaseClient();

    const { data: sessions, error: fetchError } = await supabase
      .from("google_meet_sessions")
      .select("*")
      .eq("processed", false)
      .in("status", ["detected", "queued"])
      .lt("retry_count", MAX_RETRIES)
      .lte("first_check_after", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(MAX_SESSIONS_PER_RUN);

    if (fetchError) {
      console.error("[MeetProcessor] Failed to fetch sessions:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch sessions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!sessions || sessions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "No sessions to process" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let processed = 0;
    let failed = 0;

    for (const session of sessions) {
      try {
        await processSession(supabase, session as MeetSession);
        processed++;
      } catch (err) {
        const errMsg = (err as Error).message || String(err);
        console.error(`[MeetProcessor] Session ${session.id} failed:`, errMsg);

        const newRetryCount = (session.retry_count || 0) + 1;
        const newStatus = newRetryCount >= MAX_RETRIES ? "failed" : "queued";

        await supabase
          .from("google_meet_sessions")
          .update({
            status: newStatus,
            processing_error: errMsg,
            retry_count: newRetryCount,
            processed: newStatus === "failed",
            last_processed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", session.id);

        failed++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed, failed, total: sessions.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[MeetProcessor] Unhandled error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
