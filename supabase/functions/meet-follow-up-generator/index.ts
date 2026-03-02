import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestPayload {
  meeting_transcription_id: string;
  contact_id: string;
  channel: "sms" | "email";
  org_id: string;
  ai_instructions?: string;
}

function getSupabaseClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function buildSmsPrompt(
  contactName: string,
  meetingTitle: string,
  summary: string | null,
  actionItems: { description: string }[],
  customInstructions: string | null
): string {
  let prompt = `Generate a concise, professional follow-up SMS message (under 320 characters) for ${contactName} after a meeting titled "${meetingTitle}".`;

  if (summary) {
    prompt += `\n\nMeeting summary:\n${summary.substring(0, 800)}`;
  }

  if (actionItems.length > 0) {
    prompt += `\n\nKey action items:\n${actionItems
      .slice(0, 5)
      .map((a) => `- ${a.description}`)
      .join("\n")}`;
  }

  if (customInstructions) {
    prompt += `\n\nAdditional tone/style instructions: ${customInstructions}`;
  }

  prompt += `\n\nRequirements:
- Keep it under 320 characters
- Be warm but professional
- Reference the meeting briefly
- Mention 1-2 key next steps if applicable
- Do not use placeholder brackets like [Name]
- Address the person by their first name
- Return ONLY the message text, no labels or prefixes`;

  return prompt;
}

function buildEmailPrompt(
  contactName: string,
  meetingTitle: string,
  meetingDate: string,
  summary: string | null,
  keyPoints: string[],
  actionItems: { description: string; assignee?: string; due_date?: string }[],
  customInstructions: string | null
): string {
  let prompt = `Generate a professional follow-up email for ${contactName} after a meeting titled "${meetingTitle}" on ${meetingDate}.`;

  if (summary) {
    prompt += `\n\nMeeting summary:\n${summary.substring(0, 1500)}`;
  }

  if (keyPoints.length > 0) {
    prompt += `\n\nKey discussion points:\n${keyPoints
      .slice(0, 8)
      .map((p) => `- ${p}`)
      .join("\n")}`;
  }

  if (actionItems.length > 0) {
    prompt += `\n\nAction items:\n${actionItems
      .slice(0, 10)
      .map((a) => {
        let line = `- ${a.description}`;
        if (a.assignee) line += ` (${a.assignee})`;
        if (a.due_date) line += ` - due ${new Date(a.due_date).toLocaleDateString()}`;
        return line;
      })
      .join("\n")}`;
  }

  if (customInstructions) {
    prompt += `\n\nAdditional tone/style instructions: ${customInstructions}`;
  }

  prompt += `\n\nRequirements:
- Generate a subject line on the first line prefixed with "Subject: "
- Then a blank line, followed by the email body
- Include a greeting using the person's first name
- Briefly recap key discussion highlights
- List action items with clear ownership
- Close professionally with next steps
- Do not use placeholder brackets like [Name] or [Company]
- Keep it concise but thorough (under 500 words)
- Return ONLY the subject line and email body`;

  return prompt;
}

function generateMockSms(contactName: string, meetingTitle: string): string {
  const firstName = contactName.split(" ")[0] || contactName;
  return `Hi ${firstName}, great connecting in our "${meetingTitle}" meeting! I'll follow up on the action items we discussed. Let me know if you need anything in the meantime.`;
}

function generateMockEmail(
  contactName: string,
  meetingTitle: string,
  actionItems: { description: string }[]
): { subject: string; body: string } {
  const firstName = contactName.split(" ")[0] || contactName;
  const itemsList =
    actionItems.length > 0
      ? actionItems
          .slice(0, 5)
          .map((a) => `- ${a.description}`)
          .join("\n")
      : "- No specific action items recorded";

  return {
    subject: `Follow-up: ${meetingTitle}`,
    body: `Hi ${firstName},\n\nThank you for taking the time to meet today. I wanted to follow up on our discussion and recap the key action items:\n\n${itemsList}\n\nPlease let me know if I missed anything or if you have questions about next steps.\n\nBest regards`,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseClient();
    const payload: RequestPayload = await req.json();
    const {
      meeting_transcription_id,
      contact_id,
      channel,
      org_id,
      ai_instructions,
    } = payload;

    const { data: meeting } = await supabase
      .from("meeting_transcriptions")
      .select("meeting_title, meeting_date, summary, key_points, action_items, duration_minutes")
      .eq("id", meeting_transcription_id)
      .maybeSingle();

    if (!meeting) {
      return new Response(
        JSON.stringify({ success: false, error: "Meeting not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: contact } = await supabase
      .from("contacts")
      .select("first_name, last_name, email, phone, company")
      .eq("id", contact_id)
      .maybeSingle();

    if (!contact) {
      return new Response(
        JSON.stringify({ success: false, error: "Contact not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const contactName = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "there";
    const actionItems = (meeting.action_items || []) as { description: string; assignee?: string; due_date?: string }[];
    const keyPoints = (meeting.key_points || []) as string[];
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    let aiDraftContent = "";
    let aiDraftSubject: string | null = null;

    if (channel === "sms") {
      if (openaiKey) {
        const prompt = buildSmsPrompt(
          contactName,
          meeting.meeting_title,
          meeting.summary,
          actionItems,
          ai_instructions || null
        );

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-5.1",
            max_tokens: 256,
            temperature: 0.7,
            messages: [{ role: "user", content: prompt }],
          }),
        });

        if (response.ok) {
          const result = await response.json();
          aiDraftContent = result.choices?.[0]?.message?.content?.trim() || "";
        }
      }

      if (!aiDraftContent) {
        aiDraftContent = generateMockSms(contactName, meeting.meeting_title);
      }
    } else {
      if (openaiKey) {
        const prompt = buildEmailPrompt(
          contactName,
          meeting.meeting_title,
          new Date(meeting.meeting_date).toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
          meeting.summary,
          keyPoints,
          actionItems,
          ai_instructions || null
        );

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-5.1",
            max_tokens: 1024,
            temperature: 0.7,
            messages: [{ role: "user", content: prompt }],
          }),
        });

        if (response.ok) {
          const result = await response.json();
          const fullText = result.choices?.[0]?.message?.content?.trim() || "";
          const subjectMatch = fullText.match(/^Subject:\s*(.+)/im);
          if (subjectMatch) {
            aiDraftSubject = subjectMatch[1].trim();
            aiDraftContent = fullText.replace(/^Subject:\s*.+\n\n?/im, "").trim();
          } else {
            aiDraftContent = fullText;
          }
        }
      }

      if (!aiDraftContent) {
        const mock = generateMockEmail(contactName, meeting.meeting_title, actionItems);
        aiDraftSubject = mock.subject;
        aiDraftContent = mock.body;
      }

      if (!aiDraftSubject) {
        aiDraftSubject = `Follow-up: ${meeting.meeting_title}`;
      }
    }

    const generationContext = {
      meeting_title: meeting.meeting_title,
      meeting_date: meeting.meeting_date,
      duration_minutes: meeting.duration_minutes,
      action_item_count: actionItems.length,
      key_point_count: keyPoints.length,
      has_summary: !!meeting.summary,
      contact_name: contactName,
      channel,
    };

    const { data: existing } = await supabase
      .from("meeting_follow_ups")
      .select("id")
      .eq("meeting_transcription_id", meeting_transcription_id)
      .eq("contact_id", contact_id)
      .eq("channel", channel)
      .maybeSingle();

    let followUpId: string | null = null;

    if (existing) {
      const { data: updated } = await supabase
        .from("meeting_follow_ups")
        .update({
          ai_draft_content: aiDraftContent,
          ai_draft_subject: aiDraftSubject,
          generation_context: generationContext,
          status: "draft",
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select("id")
        .maybeSingle();
      followUpId = updated?.id || existing.id;
    } else {
      const { data: created } = await supabase
        .from("meeting_follow_ups")
        .insert({
          org_id,
          meeting_transcription_id,
          contact_id,
          channel,
          ai_draft_content: aiDraftContent,
          ai_draft_subject: aiDraftSubject,
          status: "draft",
          generation_context: generationContext,
        })
        .select("id")
        .maybeSingle();
      followUpId = created?.id || null;
    }

    return new Response(
      JSON.stringify({
        success: true,
        follow_up_id: followUpId,
        channel,
        ai_draft_content: aiDraftContent,
        ai_draft_subject: aiDraftSubject,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[MeetFollowUpGenerator] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
