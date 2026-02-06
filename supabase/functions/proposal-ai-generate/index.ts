import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface UploadedDocument {
  name: string;
  text: string;
}

interface RequestPayload {
  proposal_id: string;
  contact_id: string;
  opportunity_id?: string;
  meeting_ids?: string[];
  template_id?: string;
  custom_instructions?: string;
  sections_to_generate: ('intro' | 'scope' | 'deliverables' | 'timeline' | 'pricing' | 'terms')[];
  include_contact_history?: boolean;
  include_opportunity_data?: boolean;
  user_id: string;
  uploaded_documents?: UploadedDocument[];
}

interface ContactData {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  job_title: string | null;
}

interface OpportunityData {
  id: string;
  value_amount: number;
  currency: string;
  source: string | null;
  pipeline_name: string;
  stage_name: string;
}

interface MeetingData {
  id: string;
  meeting_title: string;
  meeting_date: string;
  summary: string | null;
  key_points: string[];
  action_items: { description: string; assignee?: string }[];
  recording_url: string | null;
}

interface GeneratedSection {
  section_type: string;
  title: string;
  content: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: RequestPayload = await req.json();
    const {
      proposal_id,
      contact_id,
      opportunity_id,
      meeting_ids,
      template_id,
      custom_instructions,
      sections_to_generate,
      include_contact_history,
      include_opportunity_data,
      user_id,
      uploaded_documents,
    } = payload;

    if (!proposal_id || !contact_id || !user_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: proposal, error: proposalError } = await supabase
      .from("proposals")
      .select("*, contact:contacts(*), opportunity:opportunities(*)")
      .eq("id", proposal_id)
      .single();

    if (proposalError || !proposal) {
      return new Response(
        JSON.stringify({ error: "Proposal not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", contact_id)
      .single();

    if (contactError || !contact) {
      return new Response(
        JSON.stringify({ error: "Contact not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const contactData: ContactData = {
      id: contact.id,
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email,
      phone: contact.phone,
      company: contact.company,
      job_title: contact.job_title,
    };

    let opportunityData: OpportunityData | null = null;
    if (opportunity_id && include_opportunity_data) {
      const { data: opp } = await supabase
        .from("opportunities")
        .select("*, pipeline:pipelines(name), stage:pipeline_stages(name)")
        .eq("id", opportunity_id)
        .single();

      if (opp) {
        opportunityData = {
          id: opp.id,
          value_amount: opp.value_amount,
          currency: opp.currency,
          source: opp.source,
          pipeline_name: opp.pipeline?.name || "",
          stage_name: opp.stage?.name || "",
        };
      }
    }

    let meetingsData: MeetingData[] = [];
    if (meeting_ids && meeting_ids.length > 0) {
      const { data: meetings } = await supabase
        .from("meeting_transcriptions")
        .select("*")
        .in("id", meeting_ids)
        .order("meeting_date", { ascending: false });

      if (meetings) {
        meetingsData = meetings.map((m) => ({
          id: m.id,
          meeting_title: m.meeting_title,
          meeting_date: m.meeting_date,
          summary: m.summary,
          key_points: m.key_points || [],
          action_items: m.action_items || [],
          recording_url: m.recording_url,
        }));
      }
    }

    let contactHistory = "";
    if (include_contact_history) {
      const { data: notes } = await supabase
        .from("contact_notes")
        .select("content, created_at")
        .eq("contact_id", contact_id)
        .order("created_at", { ascending: false })
        .limit(5);

      const { data: timeline } = await supabase
        .from("contact_timeline_events")
        .select("event_type, event_data, created_at")
        .eq("contact_id", contact_id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (notes && notes.length > 0) {
        contactHistory += "\n\nRecent Notes:\n" + notes.map((n) => `- ${n.content}`).join("\n");
      }
      if (timeline && timeline.length > 0) {
        contactHistory +=
          "\n\nRecent Activity:\n" +
          timeline.map((t) => `- ${t.event_type}: ${JSON.stringify(t.event_data)}`).join("\n");
      }
    }

    let templateContent = "";
    if (template_id) {
      const { data: template } = await supabase
        .from("proposal_templates")
        .select("content, variables")
        .eq("id", template_id)
        .single();

      if (template) {
        templateContent = template.content;
      }
    }

    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", proposal.org_id)
      .single();

    const { data: activeBrandKit } = await supabase
      .from("brand_kits")
      .select("*, latest_version:brand_kit_versions(*)")
      .eq("org_id", proposal.org_id)
      .eq("active", true)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const brandKitVersion = activeBrandKit?.latest_version?.[0] || null;

    const { data: activeBrandVoice } = await supabase
      .from("brand_voices")
      .select("*, latest_version:brand_voice_versions(*)")
      .eq("org_id", proposal.org_id)
      .eq("active", true)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const brandVoiceVersion = activeBrandVoice?.latest_version?.[0] || null;

    const { data: llmProvider } = await supabase
      .from("llm_providers")
      .select("*, models:llm_models(*)")
      .eq("org_id", proposal.org_id)
      .eq("enabled", true)
      .maybeSingle();

    if (!llmProvider) {
      return new Response(
        JSON.stringify({ error: "No LLM provider configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const defaultModel = llmProvider.models?.find((m: { is_default: boolean }) => m.is_default) || llmProvider.models?.[0];
    if (!defaultModel) {
      return new Response(
        JSON.stringify({ error: "No LLM model configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = buildSystemPrompt(
      org?.name || "Our Company",
      brandVoiceVersion,
      brandKitVersion,
      templateContent
    );

    const userPrompt = buildUserPrompt(
      contactData,
      opportunityData,
      meetingsData,
      contactHistory,
      sections_to_generate,
      custom_instructions,
      uploaded_documents
    );

    const generatedSections = await callLLM(
      llmProvider.provider,
      llmProvider.api_key_encrypted,
      defaultModel.model_key,
      systemPrompt,
      userPrompt
    );

    for (const section of generatedSections) {
      const maxSortOrder = await getMaxSectionSortOrder(supabase, proposal_id);

      await supabase.from("proposal_sections").insert({
        org_id: proposal.org_id,
        proposal_id: proposal_id,
        title: section.title,
        content: section.content,
        section_type: section.section_type,
        sort_order: maxSortOrder + 1,
        ai_generated: true,
      });
    }

    const aiContext = {
      meetings_used: meeting_ids || [],
      uploaded_documents: uploaded_documents?.map((d) => d.name) || [],
      contact_history_included: include_contact_history || false,
      opportunity_data_included: include_opportunity_data || false,
      custom_instructions: custom_instructions || null,
      generated_at: new Date().toISOString(),
    };

    await supabase
      .from("proposals")
      .update({ ai_context: aiContext })
      .eq("id", proposal_id);

    await supabase.from("proposal_activities").insert({
      org_id: proposal.org_id,
      proposal_id: proposal_id,
      activity_type: "ai_generated",
      description: `AI generated ${generatedSections.length} section(s)`,
      metadata: {
        sections_generated: generatedSections.map((s) => s.section_type),
        meetings_used: meeting_ids?.length || 0,
      },
      actor_user_id: user_id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        sections_generated: generatedSections.length,
        sections: generatedSections,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Proposal AI generation error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildSystemPrompt(
  companyName: string,
  brandVoiceVersion: Record<string, unknown> | null,
  brandKitVersion: Record<string, unknown> | null,
  templateContent: string
): string {
  let prompt = `You are a professional proposal writer for ${companyName}. Your task is to generate high-quality proposal content that is persuasive, professional, and tailored to the client.

Guidelines:
- Write in a professional yet approachable tone
- Focus on client benefits and value proposition
- Use clear, concise language
- Structure content with proper headings and bullet points where appropriate
- Personalize content based on client information provided
`;

  if (brandVoiceVersion) {
    const toneSettings = brandVoiceVersion.tone_settings as Record<string, number> || {};
    const dos = (brandVoiceVersion.dos as string[]) || [];
    const donts = (brandVoiceVersion.donts as string[]) || [];
    const vocabPreferred = (brandVoiceVersion.vocabulary_preferred as string[]) || [];
    const vocabProhibited = (brandVoiceVersion.vocabulary_prohibited as string[]) || [];

    prompt += `\nBrand Voice Guidelines:`;

    if (Object.keys(toneSettings).length > 0) {
      prompt += `\n- Tone Settings:`;
      if (toneSettings.formality !== undefined) {
        const level = toneSettings.formality > 0.5 ? "Formal" : "Casual";
        prompt += `\n  • Formality: ${level}`;
      }
      if (toneSettings.friendliness !== undefined) {
        const level = toneSettings.friendliness > 0.5 ? "Warm and friendly" : "Direct and professional";
        prompt += `\n  • Approach: ${level}`;
      }
      if (toneSettings.energy !== undefined) {
        const level = toneSettings.energy > 0.5 ? "Energetic and dynamic" : "Calm and measured";
        prompt += `\n  • Energy: ${level}`;
      }
      if (toneSettings.confidence !== undefined) {
        const level = toneSettings.confidence > 0.5 ? "Assertive and confident" : "Humble and consultative";
        prompt += `\n  • Confidence: ${level}`;
      }
    }

    if (dos.length > 0) {
      prompt += `\n- Do use: ${dos.join(", ")}`;
    }
    if (donts.length > 0) {
      prompt += `\n- Avoid: ${donts.join(", ")}`;
    }
    if (vocabPreferred.length > 0) {
      prompt += `\n- Preferred vocabulary: ${vocabPreferred.join(", ")}`;
    }
    if (vocabProhibited.length > 0) {
      prompt += `\n- Never use: ${vocabProhibited.join(", ")}`;
    }
  }

  if (brandKitVersion) {
    const colors = brandKitVersion.colors as Record<string, { hex: string }> || {};
    prompt += `\nBrand Colors (for reference in describing visual elements):`;
    if (colors.primary) prompt += `\n- Primary: ${colors.primary.hex}`;
    if (colors.secondary) prompt += `\n- Secondary: ${colors.secondary.hex}`;
  }

  if (templateContent) {
    prompt += `\nTemplate Structure to Follow:
${templateContent}
`;
  }

  prompt += `\nOutput Format:
Return a JSON array of sections, each with:
- section_type: one of (intro, scope, deliverables, timeline, pricing, terms)
- title: section heading
- content: the section content in HTML format (use <p>, <h3>, <ul>, <li> tags)`;

  return prompt;
}

function buildUserPrompt(
  contact: ContactData,
  opportunity: OpportunityData | null,
  meetings: MeetingData[],
  contactHistory: string,
  sectionsToGenerate: string[],
  customInstructions?: string,
  uploadedDocuments?: UploadedDocument[]
): string {
  let prompt = `Generate proposal content for the following sections: ${sectionsToGenerate.join(", ")}

Client Information:
- Name: ${contact.first_name} ${contact.last_name}
- Company: ${contact.company || "N/A"}
- Title: ${contact.job_title || "N/A"}
- Email: ${contact.email || "N/A"}
`;

  if (opportunity) {
    prompt += `\nDeal Information:
- Value: ${opportunity.currency} ${opportunity.value_amount.toLocaleString()}
- Pipeline: ${opportunity.pipeline_name}
- Stage: ${opportunity.stage_name}
- Source: ${opportunity.source || "N/A"}
`;
  }

  if (meetings.length > 0) {
    prompt += `\nMeeting Context:`;
    for (const meeting of meetings) {
      prompt += `\n\nMeeting: ${meeting.meeting_title} (${meeting.meeting_date})`;
      if (meeting.summary) {
        prompt += `\nSummary: ${meeting.summary}`;
      }
      if (meeting.key_points.length > 0) {
        prompt += `\nKey Points:\n${meeting.key_points.map((p) => `- ${p}`).join("\n")}`;
      }
      if (meeting.action_items.length > 0) {
        prompt += `\nAction Items:\n${meeting.action_items.map((a) => `- ${a.description}`).join("\n")}`;
      }
      if (meeting.recording_url) {
        prompt += `\n[Meeting recording available]`;
      }
    }
  }

  if (uploadedDocuments && uploadedDocuments.length > 0) {
    prompt += `\n\nUploaded Document Context:`;
    for (const doc of uploadedDocuments) {
      prompt += `\n\n--- Document: ${doc.name} ---\n${doc.text}`;
    }
  }

  if (contactHistory) {
    prompt += `\n${contactHistory}`;
  }

  if (customInstructions) {
    prompt += `\n\nAdditional Instructions:\n${customInstructions}`;
  }

  return prompt;
}

async function callLLM(
  provider: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<GeneratedSection[]> {
  let response: Response;
  let responseText: string;

  if (provider === "openai") {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    responseText = data.choices[0].message.content;
  } else if (provider === "anthropic") {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    responseText = data.content[0].text;
  } else {
    throw new Error(`Unsupported LLM provider: ${provider}`);
  }

  try {
    const parsed = JSON.parse(responseText);
    return parsed.sections || parsed;
  } catch {
    const sections: GeneratedSection[] = [];
    const sectionMatches = responseText.match(/##\s*(.+?)\n([\s\S]*?)(?=##|$)/g);

    if (sectionMatches) {
      for (const match of sectionMatches) {
        const titleMatch = match.match(/##\s*(.+?)\n/);
        const content = match.replace(/##\s*.+?\n/, "").trim();
        if (titleMatch) {
          sections.push({
            section_type: "custom",
            title: titleMatch[1].trim(),
            content: content,
          });
        }
      }
    }

    if (sections.length === 0) {
      sections.push({
        section_type: "custom",
        title: "Generated Content",
        content: responseText,
      });
    }

    return sections;
  }
}

async function getMaxSectionSortOrder(
  supabase: ReturnType<typeof createClient>,
  proposalId: string
): Promise<number> {
  const { data } = await supabase
    .from("proposal_sections")
    .select("sort_order")
    .eq("proposal_id", proposalId)
    .order("sort_order", { ascending: false })
    .limit(1);

  return data?.[0]?.sort_order ?? -1;
}
