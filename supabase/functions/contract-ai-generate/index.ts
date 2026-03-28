import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildAnthropicHeaders,
  type AnthropicResponse,
} from "../_shared/claraConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const CONTRACT_MODEL = "claude-opus-4-6";
const CONTRACT_MAX_TOKENS = 16384;
const CONTRACT_TEMPERATURE = 0.4;

const CONTRACT_SECTION_TYPES = [
  "scope",
  "deliverables",
  "payment_terms",
  "timeline",
  "intellectual_property",
  "confidentiality",
  "termination",
  "liability",
  "dispute_resolution",
  "governing_law",
  "general_provisions",
  "signatures",
] as const;

interface RequestPayload {
  contract_id: string;
  proposal_id: string;
  contact_id: string;
  opportunity_id?: string;
  contract_type: string;
  custom_instructions?: string;
  user_id: string;
}

interface ContactData {
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  job_title: string | null;
}

interface GeneratedSection {
  section_type: string;
  title: string;
  content: string;
  annotation: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "") || "";
    const isServiceRole = token === supabaseKey;

    if (!isServiceRole) {
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: "Missing authorization header" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const anonClient = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
      const { error: authError } = await anonClient.auth.getUser(token);
      if (authError) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired token" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    const payload: RequestPayload = await req.json();
    const {
      contract_id,
      proposal_id,
      contact_id,
      contract_type,
      custom_instructions,
      user_id,
    } = payload;

    if (!contract_id || !proposal_id || !contact_id || !user_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: contract, error: contractError } = await supabase
      .from("contracts")
      .select("*")
      .eq("id", contract_id)
      .single();

    if (contractError || !contract) {
      return new Response(
        JSON.stringify({ error: "Contract not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: proposal, error: proposalError } = await supabase
      .from("proposals")
      .select(
        "*, contact:contacts(*), opportunity:opportunities(*), sections:proposal_sections(*)"
      )
      .eq("id", proposal_id)
      .single();

    if (proposalError || !proposal) {
      return new Response(
        JSON.stringify({ error: "Source proposal not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: contact } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", contact_id)
      .single();

    const contactData: ContactData = contact
      ? {
          first_name: contact.first_name,
          last_name: contact.last_name,
          email: contact.email,
          phone: contact.phone,
          company: contact.company,
          job_title: contact.job_title,
        }
      : {
          first_name: "N/A",
          last_name: "",
          email: null,
          phone: null,
          company: null,
          job_title: null,
        };

    let proposalContext = "";
    const isSigned = ["signed"].includes(proposal.signature_status || "");
    const hasFrozenSnapshot =
      proposal.frozen_html_snapshot && proposal.frozen_json_snapshot;

    if (isSigned && hasFrozenSnapshot) {
      const snapshot = proposal.frozen_json_snapshot as Record<string, unknown>;
      proposalContext = `SOURCE PROPOSAL (Signed — Frozen Snapshot):
Title: ${snapshot.title || proposal.title}
Total Value: ${snapshot.total_value || proposal.total_value} ${snapshot.currency || proposal.currency || "USD"}

Proposal Sections:`;
      const sections = (snapshot.sections as Array<Record<string, unknown>>) || [];
      for (const s of sections) {
        proposalContext += `\n\n### ${s.title || s.section_type}:\n${stripHtml(String(s.content || ""))}`;
      }
    } else {
      proposalContext = `SOURCE PROPOSAL (Live):
Title: ${proposal.title}
Total Value: ${proposal.total_value || 0} ${proposal.currency || "USD"}

Proposal Sections:`;
      const liveSections = (proposal.sections || []).sort(
        (a: { sort_order: number }, b: { sort_order: number }) =>
          a.sort_order - b.sort_order
      );
      for (const s of liveSections) {
        proposalContext += `\n\n### ${s.title || s.section_type}:\n${stripHtml(String(s.content || ""))}`;
      }
    }

    let opportunityContext = "";
    if (proposal.opportunity) {
      const opp = proposal.opportunity;
      opportunityContext = `
DEAL INFORMATION:
- Value: ${opp.currency || "USD"} ${(opp.value_amount || 0).toLocaleString()}
- Source: ${opp.source || "N/A"}`;
    }

    const { data: org } = await supabase
      .from("organizations")
      .select(
        "name, contact_email, contact_phone, website, business_state, business_city"
      )
      .eq("id", contract.org_id)
      .single();

    const { data: activeBrandVoice } = await supabase
      .from("brand_voices")
      .select("*, latest_version:brand_voice_versions(*)")
      .eq("org_id", contract.org_id)
      .eq("active", true)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const brandVoiceVersion = activeBrandVoice?.latest_version?.[0] || null;

    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicApiKey) {
      return new Response(
        JSON.stringify({ error: "Anthropic API key not configured" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const companyName = org?.name || "Our Company";
    const companyInfo = {
      name: companyName,
      email: org?.contact_email || "",
      phone: org?.contact_phone || "",
      website: org?.website || "",
      state: org?.business_state || "",
      city: org?.business_city || "",
    };

    const systemPrompt = buildSystemPrompt(
      companyInfo,
      brandVoiceVersion,
      contract_type
    );

    const userPrompt = buildUserPrompt(
      contactData,
      proposalContext,
      opportunityContext,
      contract_type,
      contract,
      companyInfo,
      custom_instructions
    );

    let generatedSections: GeneratedSection[];
    try {
      generatedSections = await callLLM(
        anthropicApiKey,
        CONTRACT_MODEL,
        systemPrompt,
        userPrompt
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ error: `AI generation failed: ${String(err)}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    for (let i = 0; i < generatedSections.length; i++) {
      const section = generatedSections[i];
      await supabase.from("contract_sections").insert({
        org_id: contract.org_id,
        contract_id,
        title: section.title,
        content: section.content,
        section_type: section.section_type,
        sort_order: i,
        annotation: section.annotation || null,
        ai_generated: true,
      });
    }

    const aiContext = {
      source_proposal_id: proposal_id,
      proposal_was_signed: isSigned,
      contract_type,
      custom_instructions: custom_instructions || null,
      sections_generated: generatedSections.map((s) => s.section_type),
      generated_at: new Date().toISOString(),
    };

    await supabase
      .from("contracts")
      .update({ ai_context: aiContext })
      .eq("id", contract_id);

    await supabase.from("contract_activities").insert({
      org_id: contract.org_id,
      contract_id,
      activity_type: "ai_generated",
      description: `AI generated ${generatedSections.length} contract section(s) from proposal`,
      metadata: {
        sections_generated: generatedSections.map((s) => s.section_type),
        source_proposal_id: proposal_id,
        contract_type,
      },
      actor_user_id: user_id,
    });

    try {
      const { data: orgUsers } = await supabase
        .from("users")
        .select("id")
        .eq("organization_id", contract.org_id);

      if (orgUsers?.length) {
        await supabase.from("notifications").insert(
          orgUsers.map((u: { id: string }) => ({
            user_id: u.id,
            type: "ai_draft_ready",
            title: "AI Contract Draft Ready",
            body: `An AI-generated contract draft is ready for "${contract.title || "Untitled"}"`,
            link: `/contracts/${contract_id}`,
            metadata: { contract_id },
          }))
        );
      }
    } catch {}

    return new Response(
      JSON.stringify({
        success: true,
        sections_generated: generatedSections.length,
        sections: generatedSections,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Contract AI generation error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

interface CompanyInfo {
  name: string;
  email: string;
  phone: string;
  website: string;
  state: string;
  city: string;
}

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  freelance_service: "Freelance Service Agreement",
  retainer: "Retainer Agreement",
  partnership: "Partnership Agreement",
  nda: "Non-Disclosure Agreement",
};

function buildSystemPrompt(
  company: CompanyInfo,
  brandVoiceVersion: Record<string, unknown> | null,
  contractType: string
): string {
  const typeLabel = CONTRACT_TYPE_LABELS[contractType] || contractType;

  let prompt = `You are an expert contract writer for ${company.name}. You draft professional, clear, and fair service agreements.

CONTRACT TYPE: ${typeLabel}

LEGAL DISCLAIMER (must be understood): Every contract you generate is a template for informational purposes only. It does not constitute legal advice. All contracts must be reviewed by a qualified attorney before signing or enforcement.

CORE PRINCIPLE: Every contract must protect both parties fairly, use plain language wherever possible, and be treated as a starting template for attorney review.

COMPANY INFORMATION:
- Company: ${company.name}
- Email: ${company.email}
- Phone: ${company.phone}
- Website: ${company.website}
- Location: ${company.city ? `${company.city}, ` : ""}${company.state || "[STATE]"}

REQUIRED SECTIONS (generate all 12 in order):

1. Scope of Work (section_type: "scope")
   - Define exactly what work is included
   - Explicit exclusions (what is NOT included)
   - Annotation: "This defines exactly what work is being done. If it is not listed here, it is not included."

2. Deliverables (section_type: "deliverables")
   - Table format: Deliverable | Description | Due Date
   - Every deliverable must be a tangible thing the client receives
   - Annotation: "These are the specific items the service provider will hand over."

3. Payment Terms (section_type: "payment_terms")
   - Total compensation, payment schedule, late payment terms
   - For projects under $10K: 50% upfront, 50% on completion
   - For projects over $10K: 50% upfront, 25% at midpoint, 25% on completion
   - Annotation: "How much is owed, when payments are due, and what happens if late."

4. Timeline and Milestones (section_type: "timeline")
   - Table format: Milestone | Target Date | Notes
   - Milestones must be concrete checkpoints
   - Annotation: "The project calendar — start date, key checkpoints, end date."

5. Intellectual Property (section_type: "intellectual_property")
   - Default: Client owns all deliverables upon full payment
   - Provider retains portfolio rights
   - Annotation: "Who owns the work product after the project is complete."

6. Confidentiality (section_type: "confidentiality")
   - Mutual obligation, 2-year survival period
   - Exclusions for public/independent/legally-required info
   - Annotation: "Both parties agree not to share private business information with outsiders."

7. Termination (section_type: "termination")
   - 30 days written notice by either party
   - Payment for completed work, refund of prepaid fees for undelivered work
   - Annotation: "The exit clause — how to end the contract, notice required, what happens to payments."

8. Limitation of Liability (section_type: "liability")
   - Liability cap at total contract value
   - Exclusion of indirect/consequential damages
   - Annotation: "Caps the maximum amount either party could owe if something goes wrong."

9. Dispute Resolution (section_type: "dispute_resolution")
   - Mediation first, then binding arbitration
   - Annotation: "How to resolve disagreements without going to court."

10. Governing Law (section_type: "governing_law")
    - State laws, conflict of laws provision
    - Annotation: "Which state's laws apply to this contract."

11. General Provisions (section_type: "general_provisions")
    - Entire agreement, amendments in writing, severability, force majeure, notices
    - Annotation: "Standard housekeeping clauses for edge cases."

12. Signatures (section_type: "signatures")
    - Signature lines, printed names, dates for both parties
    - Annotation: "The contract is not binding until both parties sign and date it."

DRAFTING RULES:
- Plain language always. Write "The client pays $5,000 within 10 days of signing" not legalese
- Never leave a critical term blank. Use defaults from the proposal data
- Adapt sections to the contract type: NDA skips Deliverables; Retainer adds Term and Renewal; Partnership adds Profit Distribution
- Use HTML markup in content: <p>, <h3>, <h4>, <ul>, <ol>, <li>, <strong>, <em>, <table>, <thead>, <tbody>, <tr>, <th>, <td>
- Round monetary amounts to clean numbers

ANTI-PATTERNS — NEVER DO THESE:
- Overly complex legalese
- Vague payment terms ("payment upon completion" without specifics)
- Promising enforceability — always note attorney review is needed
- Inserting unflagged clauses the user did not request
- Boilerplate contradicting the actual proposal terms`;

  if (brandVoiceVersion) {
    const toneSettings =
      (brandVoiceVersion.tone_settings as Record<string, number>) || {};
    const dos = (brandVoiceVersion.dos as string[]) || [];
    const donts = (brandVoiceVersion.donts as string[]) || [];

    prompt += `\n\nBRAND VOICE GUIDELINES:`;
    if (Object.keys(toneSettings).length > 0) {
      prompt += `\n- Tone:`;
      if (toneSettings.formality !== undefined) {
        prompt += ` ${toneSettings.formality > 0.5 ? "Formal" : "Casual"},`;
      }
      if (toneSettings.confidence !== undefined) {
        prompt += ` ${toneSettings.confidence > 0.5 ? "Assertive" : "Consultative"},`;
      }
    }
    if (dos.length > 0) prompt += `\n- Do: ${dos.join(", ")}`;
    if (donts.length > 0) prompt += `\n- Avoid: ${donts.join(", ")}`;
  }

  prompt += `

OUTPUT FORMAT — CRITICAL, FOLLOW EXACTLY:

Return ONLY a raw JSON array. Do NOT wrap it in markdown code fences. Do NOT include any text before or after the JSON array.

Each element must have exactly these four string fields:
- "section_type": one of ${CONTRACT_SECTION_TYPES.map((s) => `"${s}"`).join(", ")}
- "title": the section heading
- "content": the section body as well-formatted HTML
- "annotation": a plain-language explanation of what this section means (1-2 sentences)

The "content" field must be HTML. Use <p>, <h3>, <h4>, <ul>, <ol>, <li>, <strong>, <em>, <table> tags.

Example:
[{"section_type":"scope","title":"Scope of Work","content":"<p>Service Provider will...</p>","annotation":"This defines exactly what work is being done."}]`;

  return prompt;
}

function buildUserPrompt(
  contact: ContactData,
  proposalContext: string,
  opportunityContext: string,
  contractType: string,
  contract: Record<string, unknown>,
  company: CompanyInfo,
  customInstructions?: string
): string {
  const typeLabel = CONTRACT_TYPE_LABELS[contractType] || contractType;

  let prompt = `Generate a complete ${typeLabel} with all 12 required sections.

PARTIES:
Party A (Service Provider): ${contract.party_a_name || company.name}
  Email: ${contract.party_a_email || company.email || "N/A"}

Party B (Client): ${contact.first_name} ${contact.last_name}
  Company: ${contact.company || "N/A"}
  Email: ${contact.email || "N/A"}
  Title: ${contact.job_title || "N/A"}

COMMERCIAL TERMS:
- Contract Value: ${contract.total_value || 0} ${contract.currency || "USD"}
- Effective Date: ${contract.effective_date || "Upon signing"}
- Governing Law: ${contract.governing_law_state || company.state || "[STATE]"}

${proposalContext}
${opportunityContext}`;

  if (customInstructions) {
    prompt += `\n\nADDITIONAL INSTRUCTIONS FROM THE USER:\n${customInstructions}`;
  }

  prompt += `\n\nGenerate all 12 sections with professional HTML content and plain-language annotations. Derive all terms from the proposal data above. Return ONLY the raw JSON array.`;

  return prompt;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function stripCodeFences(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json|JSON)?\s*\n?/m, "");
  cleaned = cleaned.replace(/\n?\s*```\s*$/m, "");
  return cleaned.trim();
}

function extractJsonArray(text: string): string | null {
  const firstBracket = text.indexOf("[");
  const lastBracket = text.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    return text.substring(firstBracket, lastBracket + 1);
  }
  return null;
}

function validateSection(s: unknown): s is GeneratedSection {
  if (!s || typeof s !== "object") return false;
  const obj = s as Record<string, unknown>;
  return (
    typeof obj.section_type === "string" &&
    typeof obj.title === "string" &&
    typeof obj.content === "string" &&
    obj.content.length > 0
  );
}

function parseAIResponse(responseText: string): GeneratedSection[] {
  let text = responseText.trim();
  text = stripCodeFences(text);

  try {
    const parsed = JSON.parse(text);
    const arr = Array.isArray(parsed) ? parsed : parsed?.sections;
    if (Array.isArray(arr)) {
      const validated = arr.filter(validateSection).map(ensureAnnotation);
      if (validated.length > 0) return validated;
    }
  } catch {
    // first parse failed
  }

  const extracted = extractJsonArray(text);
  if (extracted) {
    try {
      const parsed = JSON.parse(extracted);
      if (Array.isArray(parsed)) {
        const validated = parsed.filter(validateSection).map(ensureAnnotation);
        if (validated.length > 0) return validated;
      }
    } catch {
      // extraction parse also failed
    }
  }

  const sections: GeneratedSection[] = [];
  const sectionMatches = responseText.match(/##\s*(.+?)\n([\s\S]*?)(?=##|$)/g);
  if (sectionMatches) {
    for (const match of sectionMatches) {
      const titleMatch = match.match(/##\s*(.+?)\n/);
      const content = match.replace(/##\s*.+?\n/, "").trim();
      if (titleMatch && content) {
        const htmlContent = content
          .split("\n\n")
          .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
          .join("\n");
        sections.push({
          section_type: guessSectionType(titleMatch[1].trim()),
          title: titleMatch[1].trim(),
          content: htmlContent,
          annotation: "",
        });
      }
    }
  }

  if (sections.length === 0 && responseText.trim().length > 0) {
    const htmlContent = responseText
      .split("\n\n")
      .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
      .join("\n");
    sections.push({
      section_type: "custom",
      title: "Generated Content",
      content: htmlContent,
      annotation: "",
    });
  }

  return sections;
}

function ensureAnnotation(s: GeneratedSection): GeneratedSection {
  if (s.annotation) return s;
  const defaults: Record<string, string> = {
    scope:
      "This defines exactly what work is being done. If it is not listed here, it is not included.",
    deliverables:
      "These are the specific items the service provider will hand over.",
    payment_terms:
      "How much is owed, when payments are due, and what happens if late.",
    timeline:
      "The project calendar — start date, key checkpoints, end date.",
    intellectual_property:
      "Who owns the work product after the project is complete.",
    confidentiality:
      "Both parties agree not to share private business information with outsiders.",
    termination:
      "The exit clause — how to end the contract, notice required, what happens to payments.",
    liability:
      "Caps the maximum amount either party could owe if something goes wrong.",
    dispute_resolution:
      "How to resolve disagreements without going to court.",
    governing_law: "Which state's laws apply to this contract.",
    general_provisions: "Standard housekeeping clauses for edge cases.",
    signatures:
      "The contract is not binding until both parties sign and date it.",
  };
  return { ...s, annotation: defaults[s.section_type] || "" };
}

function guessSectionType(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes("scope") || lower.includes("work")) return "scope";
  if (lower.includes("deliverable")) return "deliverables";
  if (lower.includes("payment") || lower.includes("compensation"))
    return "payment_terms";
  if (
    lower.includes("timeline") ||
    lower.includes("milestone") ||
    lower.includes("schedule")
  )
    return "timeline";
  if (
    lower.includes("intellectual") ||
    lower.includes("ip") ||
    lower.includes("ownership")
  )
    return "intellectual_property";
  if (lower.includes("confidential") || lower.includes("nda"))
    return "confidentiality";
  if (lower.includes("terminat")) return "termination";
  if (lower.includes("liability") || lower.includes("limitation"))
    return "liability";
  if (lower.includes("dispute") || lower.includes("resolution"))
    return "dispute_resolution";
  if (lower.includes("governing") || lower.includes("law"))
    return "governing_law";
  if (lower.includes("general") || lower.includes("provision"))
    return "general_provisions";
  if (lower.includes("signature")) return "signatures";
  return "custom";
}

async function callLLM(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<GeneratedSection[]> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: buildAnthropicHeaders(apiKey),
    body: JSON.stringify({
      model,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      temperature: CONTRACT_TEMPERATURE,
      max_tokens: CONTRACT_MAX_TOKENS,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errBody}`);
  }

  const data = (await response.json()) as AnthropicResponse;
  const responseText =
    data.content.find((b) => b.type === "text")?.text || "";

  return parseAIResponse(responseText);
}
