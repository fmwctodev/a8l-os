import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SurveyQuestionOption {
  id: string;
  label: string;
  value: string;
  score?: number;
}

interface SurveyQuestion {
  id: string;
  type: string;
  label: string;
  options?: SurveyQuestionOption[];
  mapping?: {
    contactField?: string;
  };
}

interface SurveyStep {
  id: string;
  questions: SurveyQuestion[];
}

interface SurveyDefinition {
  steps: SurveyStep[];
}

interface SurveyScoreBand {
  label: string;
  minScore: number;
  maxScore: number;
  tagId?: string;
}

interface SurveySettings {
  thankYouMessage?: string;
  redirectUrl?: string;
  contactMatching: "email_first" | "phone_first" | "create_new";
  scoringEnabled?: boolean;
  scoreBands?: SurveyScoreBand[];
  completionTagId?: string;
  tagRules?: Array<{
    questionId: string;
    answerValue: string;
    tagId: string;
  }>;
  partialCompletionEnabled?: boolean;
}

interface Survey {
  id: string;
  organization_id: string;
  name: string;
  definition: SurveyDefinition;
  settings: SurveySettings;
  status: string;
}

interface AttributionData {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  referrer?: string;
  landing_page?: string;
  ip_address?: string;
  user_agent?: string;
}

function extractAttribution(req: Request, body: Record<string, unknown>): AttributionData {
  const url = new URL(req.url);
  return {
    utm_source: (body.utm_source as string) || url.searchParams.get("utm_source") || undefined,
    utm_medium: (body.utm_medium as string) || url.searchParams.get("utm_medium") || undefined,
    utm_campaign: (body.utm_campaign as string) || url.searchParams.get("utm_campaign") || undefined,
    utm_term: (body.utm_term as string) || url.searchParams.get("utm_term") || undefined,
    utm_content: (body.utm_content as string) || url.searchParams.get("utm_content") || undefined,
    referrer: (body.referrer as string) || req.headers.get("referer") || undefined,
    landing_page: body.landing_page as string || undefined,
    ip_address: req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("cf-connecting-ip") || undefined,
    user_agent: req.headers.get("user-agent") || undefined,
  };
}

function calculateScore(
  answers: Record<string, unknown>,
  definition: SurveyDefinition
): number {
  let totalScore = 0;

  for (const step of definition.steps) {
    for (const question of step.questions) {
      const answer = answers[question.id];
      if (answer === undefined || answer === null) continue;

      if (question.options) {
        if (Array.isArray(answer)) {
          for (const val of answer) {
            const option = question.options.find((o) => o.value === val || o.id === val);
            if (option?.score !== undefined) {
              totalScore += option.score;
            }
          }
        } else {
          const option = question.options.find((o) => o.value === answer || o.id === answer);
          if (option?.score !== undefined) {
            totalScore += option.score;
          }
        }
      }

      if (
        question.type === "nps" ||
        question.type === "rating" ||
        question.type === "opinion_scale" ||
        question.type === "math_calculation"
      ) {
        const numValue = Number(answer);
        if (!isNaN(numValue)) {
          totalScore += numValue;
        }
      }

      // Auto-detect: any question with "score" in its label is treated as a numeric scoring element
      if (question.label && /\bscore\b/i.test(question.label) && !question.options) {
        const numValue = Number(answer);
        if (!isNaN(numValue)) {
          totalScore += numValue;
        }
      }
    }
  }

  return totalScore;
}

function determineScoreBand(
  score: number,
  scoreBands: SurveyScoreBand[] | undefined
): { label: string; tagId?: string } | null {
  if (!scoreBands || scoreBands.length === 0) return null;

  for (const band of scoreBands) {
    if (score >= band.minScore && score <= band.maxScore) {
      return { label: band.label, tagId: band.tagId };
    }
  }

  return null;
}

function collectTagsFromAnswers(
  answers: Record<string, unknown>,
  tagRules: SurveySettings["tagRules"]
): string[] {
  if (!tagRules || tagRules.length === 0) return [];

  const tagIds: string[] = [];

  for (const rule of tagRules) {
    const answer = answers[rule.questionId];
    if (answer === undefined || answer === null) continue;

    if (Array.isArray(answer)) {
      if (answer.includes(rule.answerValue)) {
        tagIds.push(rule.tagId);
      }
    } else if (String(answer) === rule.answerValue) {
      tagIds.push(rule.tagId);
    }
  }

  return tagIds;
}

async function findOrCreateContact(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  departmentId: string,
  answers: Record<string, unknown>,
  definition: SurveyDefinition,
  settings: SurveySettings
): Promise<string | null> {
  const contactData: Record<string, unknown> = {};

  for (const step of definition.steps) {
    for (const question of step.questions) {
      const value = answers[question.id];
      if (value === undefined || value === null || value === "") continue;

      if (question.mapping?.contactField) {
        contactData[question.mapping.contactField] = value;
      } else if (question.type === "contact_capture") {
        if (typeof value === "object" && value !== null) {
          const captureData = value as Record<string, unknown>;
          if (captureData.email) contactData.email = captureData.email;
          if (captureData.phone) contactData.phone = captureData.phone;
          if (captureData.first_name) contactData.first_name = captureData.first_name;
          if (captureData.last_name) contactData.last_name = captureData.last_name;
          if (captureData.name) {
            const nameParts = String(captureData.name).trim().split(/\s+/);
            contactData.first_name = nameParts[0] || "";
            contactData.last_name = nameParts.slice(1).join(" ") || "";
          }
        }
      } else if (question.type === "email") {
        contactData.email = value;
      } else if (question.type === "phone") {
        contactData.phone = value;
      } else if (question.type === "first_name") {
        contactData.first_name = value;
      } else if (question.type === "last_name") {
        contactData.last_name = value;
      } else if (question.type === "full_name") {
        const nameParts = String(value).trim().split(/\s+/);
        contactData.first_name = nameParts[0] || "";
        contactData.last_name = nameParts.slice(1).join(" ") || "";
      } else if (question.type === "company") {
        contactData.company = value;
      }
    }
  }

  const email = contactData.email as string | undefined;
  const phone = contactData.phone as string | undefined;

  if (!email && !phone) {
    return null;
  }

  if (settings.contactMatching === "create_new") {
    const { data: newContact, error } = await supabase
      .from("contacts")
      .insert({
        organization_id: organizationId,
        department_id: departmentId,
        first_name: contactData.first_name || "",
        last_name: contactData.last_name || "",
        email: email || null,
        phone: phone || null,
        company: contactData.company || null,
        source: "survey",
        status: "active",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error creating contact:", error);
      return null;
    }

    return newContact.id;
  }

  let existingContact = null;

  if (settings.contactMatching === "email_first" && email) {
    const { data } = await supabase
      .from("contacts")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("email", email)
      .eq("status", "active")
      .maybeSingle();
    existingContact = data;
  }

  if (!existingContact && settings.contactMatching === "phone_first" && phone) {
    const { data } = await supabase
      .from("contacts")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("phone", phone)
      .eq("status", "active")
      .maybeSingle();
    existingContact = data;
  }

  if (!existingContact && email) {
    const { data } = await supabase
      .from("contacts")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("email", email)
      .eq("status", "active")
      .maybeSingle();
    existingContact = data;
  }

  if (!existingContact && phone) {
    const { data } = await supabase
      .from("contacts")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("phone", phone)
      .eq("status", "active")
      .maybeSingle();
    existingContact = data;
  }

  if (existingContact) {
    return existingContact.id;
  }

  const { data: newContact, error } = await supabase
    .from("contacts")
    .insert({
      organization_id: organizationId,
      department_id: departmentId,
      first_name: contactData.first_name || "",
      last_name: contactData.last_name || "",
      email: email || null,
      phone: phone || null,
      source: "survey",
      status: "active",
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error creating contact:", error);
    return null;
  }

  return newContact.id;
}

async function applyTags(
  supabase: ReturnType<typeof createClient>,
  contactId: string,
  tagIds: string[]
): Promise<void> {
  if (!tagIds || tagIds.length === 0) return;

  const uniqueTagIds = [...new Set(tagIds)];
  const inserts = uniqueTagIds.map((tagId) => ({
    contact_id: contactId,
    tag_id: tagId,
  }));

  await supabase.from("contact_tags").upsert(inserts, { onConflict: "contact_id,tag_id" });
}

async function createTimelineEvent(
  supabase: ReturnType<typeof createClient>,
  contactId: string,
  surveyId: string,
  surveyName: string,
  scoreTotal: number,
  scoreBand: string | null
): Promise<void> {
  await supabase.from("contact_timeline_events").insert({
    contact_id: contactId,
    event_type: "survey_submitted",
    event_data: {
      survey_id: surveyId,
      survey_name: surveyName,
      score: scoreTotal,
      score_band: scoreBand,
    },
  });
}

async function emitOutboxEvent(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  surveyId: string,
  contactId: string | null,
  submissionId: string,
  scoreBand: string | null
): Promise<void> {
  await supabase.from("event_outbox").insert({
    org_id: organizationId,
    event_type: "survey_submitted",
    contact_id: contactId,
    entity_type: "survey_submission",
    entity_id: submissionId,
    payload: {
      survey_id: surveyId,
      submission_id: submissionId,
      contact_id: contactId,
      score_band: scoreBand,
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let body: Record<string, unknown>;
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      body = await req.json();
    } else {
      body = await req.json().catch(() => ({}));
    }

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const trailingSlug = pathParts[pathParts.length - 1];
    const slug = trailingSlug && trailingSlug !== "survey-submit" ? trailingSlug : undefined;
    const surveyIdFromBody = body.surveyId as string | undefined;

    if (!slug && !surveyIdFromBody) {
      return new Response(
        JSON.stringify({ error: "Survey slug or surveyId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let surveyQuery = supabase
      .from("surveys")
      .select("*")
      .eq("status", "published");
    if (slug) {
      surveyQuery = surveyQuery.eq("public_slug", slug);
    } else if (surveyIdFromBody) {
      surveyQuery = surveyQuery.eq("id", surveyIdFromBody);
    }
    const { data: survey, error: surveyError } = await surveyQuery.maybeSingle();

    if (surveyError || !survey) {
      return new Response(
        JSON.stringify({ error: "Survey not found or not published" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const typedSurvey = survey as Survey;
    const settings = typedSurvey.settings;

    const answers = (body.answers as Record<string, unknown>) || body;
    const isPartial = body.partial === true;

    if (isPartial) {
      // Partial completion: only create/match the contact, don't store a submission row
      if (!settings.partialCompletionEnabled) {
        return new Response(
          JSON.stringify({ error: "Partial completion is not enabled for this survey" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: defaultDept } = await supabase
        .from("departments")
        .select("id")
        .eq("organization_id", typedSurvey.organization_id)
        .limit(1)
        .maybeSingle();

      const departmentId = defaultDept?.id;
      if (!departmentId) {
        return new Response(
          JSON.stringify({ error: "No department configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const partialContactId = await findOrCreateContact(
        supabase,
        typedSurvey.organization_id,
        departmentId,
        answers,
        typedSurvey.definition,
        settings
      );

      return new Response(
        JSON.stringify({ success: true, partial: true, contact_id: partialContactId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const idempotencyKey = body._idempotency_key as string | undefined;
    if (idempotencyKey) {
      const { data: existingSubmission } = await supabase
        .from("survey_submissions")
        .select("id")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      if (existingSubmission) {
        return new Response(
          JSON.stringify({ success: true, message: "Submission already processed", duplicate: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const attribution = extractAttribution(req, body);

    let scoreTotal = 0;
    let scoreBand: string | null = null;
    let scoreBandTagId: string | undefined;

    if (settings.scoringEnabled) {
      scoreTotal = calculateScore(answers, typedSurvey.definition);
      const bandResult = determineScoreBand(scoreTotal, settings.scoreBands);
      if (bandResult) {
        scoreBand = bandResult.label;
        scoreBandTagId = bandResult.tagId;
      }
    }

    const { data: defaultDept } = await supabase
      .from("departments")
      .select("id")
      .eq("organization_id", typedSurvey.organization_id)
      .limit(1)
      .maybeSingle();

    const departmentId = defaultDept?.id;

    let contactId: string | null = null;
    if (departmentId) {
      contactId = await findOrCreateContact(
        supabase,
        typedSurvey.organization_id,
        departmentId,
        answers,
        typedSurvey.definition,
        settings
      );
    }

    if (contactId) {
      const tagsToApply: string[] = [];

      if (settings.completionTagId) {
        tagsToApply.push(settings.completionTagId);
      }

      if (scoreBandTagId) {
        tagsToApply.push(scoreBandTagId);
      }

      const answerBasedTags = collectTagsFromAnswers(answers, settings.tagRules);
      tagsToApply.push(...answerBasedTags);

      if (tagsToApply.length > 0) {
        await applyTags(supabase, contactId, tagsToApply);
      }
    }

    const { data: submission, error: submitError } = await supabase
      .from("survey_submissions")
      .insert({
        organization_id: typedSurvey.organization_id,
        survey_id: typedSurvey.id,
        contact_id: contactId,
        answers,
        score_total: scoreTotal,
        score_band: scoreBand,
        attribution,
        processed_status: "processed",
        idempotency_key: idempotencyKey || null,
      })
      .select("id")
      .single();

    if (submitError) {
      console.error("Error creating submission:", submitError);
      return new Response(
        JSON.stringify({ error: "Failed to save submission" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (contactId) {
      await createTimelineEvent(
        supabase,
        contactId,
        typedSurvey.id,
        typedSurvey.name,
        scoreTotal,
        scoreBand
      );
    }

    await emitOutboxEvent(
      supabase,
      typedSurvey.organization_id,
      typedSurvey.id,
      contactId,
      submission.id,
      scoreBand
    );

    const isAjax = req.headers.get("accept")?.includes("application/json") ||
      req.headers.get("x-requested-with") === "XMLHttpRequest";

    if (!isAjax && settings.redirectUrl) {
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          Location: settings.redirectUrl,
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: settings.thankYouMessage || "Thank you for completing this survey!",
        submission_id: submission.id,
        contact_id: contactId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Survey submission error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
