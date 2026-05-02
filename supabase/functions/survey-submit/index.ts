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

interface FormValidationRule {
  type:
    | "min_length"
    | "max_length"
    | "pattern"
    | "min"
    | "max"
    | "min_date"
    | "max_date"
    | "format";
  value: string | number;
  message?: string;
}

interface SurveyQuestion {
  id: string;
  type: string;
  label: string;
  required?: boolean;
  validationRules?: FormValidationRule[];
  options?: SurveyQuestionOption[];
  mapping?: {
    contactField?: string;
    customFieldId?: string;
    objectId?: string;
    objectFieldKey?: string;
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
  captchaEnabled?: boolean;
  captchaProvider?: "hcaptcha";
  captchaSiteKey?: string;
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

// Columns on the public.contacts table that submissions may auto-populate.
const CONTACT_COLUMNS = [
  "first_name", "last_name", "email", "phone", "company", "job_title",
  "address_line1", "address_line2", "city", "state", "postal_code", "country",
  "source",
] as const;

function buildContactDataFromSurvey(
  answers: Record<string, unknown>,
  definition: SurveyDefinition,
): Record<string, unknown> {
  const contactData: Record<string, unknown> = {};
  const setIfPresent = (key: string, value: unknown) => {
    if (value === undefined || value === null) return;
    if (typeof value === "string" && value.trim() === "") return;
    contactData[key] = value;
  };

  for (const step of definition.steps) {
    for (const question of step.questions) {
      const value = answers[question.id];
      if (value === undefined || value === null) continue;

      // Explicit contact-field mapping wins
      if (question.mapping?.contactField) {
        setIfPresent(question.mapping.contactField, value);
        continue;
      }
      // Wired to custom field or custom object — handled elsewhere
      if (question.mapping?.customFieldId || question.mapping?.objectId) continue;

      if (question.type === "contact_capture") {
        if (typeof value === "object" && value !== null) {
          const c = value as Record<string, unknown>;
          if (c.email) setIfPresent("email", c.email);
          if (c.phone) setIfPresent("phone", c.phone);
          if (c.first_name) setIfPresent("first_name", c.first_name);
          if (c.last_name) setIfPresent("last_name", c.last_name);
          if (c.company) setIfPresent("company", c.company);
          if (c.name) {
            const nameParts = String(c.name).trim().split(/\s+/);
            if (nameParts[0]) setIfPresent("first_name", nameParts[0]);
            if (nameParts.length > 1) setIfPresent("last_name", nameParts.slice(1).join(" "));
          }
        }
        continue;
      }

      switch (question.type) {
        case "email":
          setIfPresent("email", value);
          break;
        case "phone":
          setIfPresent("phone", value);
          break;
        case "first_name":
          setIfPresent("first_name", value);
          break;
        case "last_name":
          setIfPresent("last_name", value);
          break;
        case "full_name": {
          const nameParts = String(value).trim().split(/\s+/);
          if (nameParts[0]) setIfPresent("first_name", nameParts[0]);
          if (nameParts.length > 1) setIfPresent("last_name", nameParts.slice(1).join(" "));
          break;
        }
        case "company":
          setIfPresent("company", value);
          break;
        case "city":
          setIfPresent("city", value);
          break;
        case "state":
          setIfPresent("state", value);
          break;
        case "postal_code":
          setIfPresent("postal_code", value);
          break;
        case "country":
          setIfPresent("country", value);
          break;
        case "source":
          setIfPresent("source", value);
          break;
        case "address": {
          if (typeof value === "object") {
            const a = value as Record<string, unknown>;
            if (a.street) setIfPresent("address_line1", a.street);
            if (a.city) setIfPresent("city", a.city);
            if (a.state) setIfPresent("state", a.state);
            if (a.postal_code) setIfPresent("postal_code", a.postal_code);
            if (a.country) setIfPresent("country", a.country);
          } else if (typeof value === "string") {
            setIfPresent("address_line1", value);
          }
          break;
        }
      }
    }
  }

  return contactData;
}

async function findExistingContact(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  email?: string,
  phone?: string,
): Promise<{ id: string } | null> {
  if (email) {
    const { data } = await supabase
      .from("contacts")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("email", email)
      .eq("status", "active")
      .maybeSingle();
    if (data) return data;
  }
  if (phone) {
    const { data } = await supabase
      .from("contacts")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("phone", phone)
      .eq("status", "active")
      .maybeSingle();
    if (data) return data;
  }
  return null;
}

async function applyContactUpdate(
  supabase: ReturnType<typeof createClient>,
  contactId: string,
  contactData: Record<string, unknown>,
  fieldOverwrite: "always" | "only_if_empty",
): Promise<void> {
  if (Object.keys(contactData).length === 0) return;

  let updates: Record<string, unknown> = {};

  if (fieldOverwrite === "always") {
    updates = { ...contactData };
  } else {
    const { data: current } = await supabase
      .from("contacts")
      .select(CONTACT_COLUMNS.join(","))
      .eq("id", contactId)
      .maybeSingle();
    if (!current) return;
    const cur = current as Record<string, unknown>;
    for (const [k, v] of Object.entries(contactData)) {
      const existing = cur[k];
      if (existing === null || existing === undefined || existing === "") {
        updates[k] = v;
      }
    }
  }

  if (Object.keys(updates).length === 0) return;
  const { error } = await supabase.from("contacts").update(updates).eq("id", contactId);
  if (error) console.error("Error updating contact:", error);
}

async function findOrCreateContact(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  departmentId: string,
  answers: Record<string, unknown>,
  definition: SurveyDefinition,
  settings: SurveySettings
): Promise<string | null> {
  const contactData = buildContactDataFromSurvey(answers, definition);

  const email = contactData.email as string | undefined;
  const phone = contactData.phone as string | undefined;

  // Anti-dup: try email then phone unless user explicitly chose create_new
  if (settings.contactMatching !== "create_new") {
    const existing = await findExistingContact(supabase, organizationId, email, phone);
    if (existing) {
      // Surveys don't expose a fieldOverwrite setting yet — default to only_if_empty (safe)
      await applyContactUpdate(supabase, existing.id, contactData, "only_if_empty");
      return existing.id;
    }
  }

  if (!email && !phone && settings.contactMatching !== "create_new") {
    return null;
  }

  const insert: Record<string, unknown> = {
    organization_id: organizationId,
    department_id: departmentId,
    status: "active",
    first_name: "",
    last_name: "",
    source: "survey",
    ...contactData,
  };

  const { data: newContact, error } = await supabase
    .from("contacts")
    .insert(insert)
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

async function writeCustomFieldValues(
  supabase: ReturnType<typeof createClient>,
  contactId: string,
  answers: Record<string, unknown>,
  definition: SurveyDefinition
): Promise<void> {
  const inserts: { contact_id: string; custom_field_id: string; value: unknown }[] = [];
  for (const step of definition.steps) {
    for (const question of step.questions) {
      const customFieldId = question.mapping?.customFieldId;
      if (!customFieldId) continue;
      const value = answers[question.id];
      if (value === undefined) continue;
      inserts.push({
        contact_id: contactId,
        custom_field_id: customFieldId,
        value: value === null ? null : value,
      });
    }
  }
  if (inserts.length === 0) return;
  const { error } = await supabase
    .from("contact_custom_field_values")
    .upsert(inserts, { onConflict: "contact_id,custom_field_id" });
  if (error) {
    console.error("Error writing custom field values:", error);
  }
}

async function writeObjectRecords(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  contactId: string | null,
  answers: Record<string, unknown>,
  definition: SurveyDefinition
): Promise<void> {
  const groups = new Map<string, Record<string, unknown>>();
  for (const step of definition.steps) {
    for (const question of step.questions) {
      const objectId = question.mapping?.objectId;
      const fieldKey = question.mapping?.objectFieldKey;
      if (!objectId || !fieldKey) continue;
      const value = answers[question.id];
      if (value === undefined || value === null || value === "") continue;
      const existing = groups.get(objectId) || {};
      existing[fieldKey] = value;
      groups.set(objectId, existing);
    }
  }

  if (groups.size === 0) return;

  const objectIds = Array.from(groups.keys());
  const { data: defs, error: defsError } = await supabase
    .from("custom_object_definitions")
    .select("id, primary_field_key")
    .in("id", objectIds);
  if (defsError) {
    console.error("Error loading object definitions:", defsError);
    return;
  }

  for (const def of (defs || []) as { id: string; primary_field_key: string }[]) {
    const values = groups.get(def.id) || {};
    const primaryValue = (values[def.primary_field_key] as string | undefined) ?? null;

    if (contactId) {
      const { data: existing } = await supabase
        .from("custom_object_records")
        .select("id, values, primary_value")
        .eq("organization_id", organizationId)
        .eq("object_def_id", def.id)
        .eq("contact_id", contactId)
        .is("deleted_at", null)
        .maybeSingle();

      if (existing) {
        const merged = { ...(existing.values as Record<string, unknown> || {}), ...values };
        const { error } = await supabase
          .from("custom_object_records")
          .update({
            values: merged,
            primary_value: primaryValue ?? existing.primary_value,
          })
          .eq("id", existing.id);
        if (error) console.error("Error updating object record:", error);
        continue;
      }
    }

    const { error } = await supabase.from("custom_object_records").insert({
      organization_id: organizationId,
      object_def_id: def.id,
      contact_id: contactId,
      primary_value: primaryValue,
      values,
    });
    if (error) console.error("Error inserting object record:", error);
  }
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

function validateAnswers(
  answers: Record<string, unknown>,
  definition: SurveyDefinition,
): string | null {
  for (const step of definition.steps) {
    for (const q of step.questions) {
      const raw = answers[q.id];
      const isEmpty =
        raw === undefined ||
        raw === null ||
        raw === "" ||
        (Array.isArray(raw) && raw.length === 0);

      if (q.required && q.type !== "hidden" && q.type !== "divider") {
        if (isEmpty) {
          return `${q.label || q.id} is required`;
        }
      }

      if (isEmpty || !q.validationRules) continue;

      const value = String(raw ?? "");
      const numValue = typeof raw === "number" ? raw : parseFloat(value);

      for (const rule of q.validationRules) {
        if (rule.type === "min_length" && value.length < Number(rule.value)) {
          return rule.message || `${q.label}: minimum ${rule.value} characters`;
        }
        if (rule.type === "max_length" && value.length > Number(rule.value)) {
          return rule.message || `${q.label}: maximum ${rule.value} characters`;
        }
        if (rule.type === "pattern") {
          try {
            if (!new RegExp(String(rule.value)).test(value)) {
              return rule.message || `${q.label}: invalid format`;
            }
          } catch {
            // bad pattern
          }
        }
        if (rule.type === "min" && !isNaN(numValue) && numValue < Number(rule.value)) {
          return rule.message || `${q.label}: must be at least ${rule.value}`;
        }
        if (rule.type === "max" && !isNaN(numValue) && numValue > Number(rule.value)) {
          return rule.message || `${q.label}: must be at most ${rule.value}`;
        }
        if (rule.type === "min_date" && value && value < String(rule.value)) {
          return rule.message || `${q.label}: must be on or after ${rule.value}`;
        }
        if (rule.type === "max_date" && value && value > String(rule.value)) {
          return rule.message || `${q.label}: must be on or before ${rule.value}`;
        }
        if (rule.type === "format") {
          if (q.type === "email") {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
              return rule.message || `${q.label}: invalid email`;
            }
          } else if (q.type === "phone") {
            const digits = value.replace(/\D+/g, "");
            if (digits.length < 7 || digits.length > 15) {
              return rule.message || `${q.label}: invalid phone number`;
            }
          } else if (q.type === "website") {
            try {
              const u = new URL(value.includes("://") ? value : `https://${value}`);
              if (!u.hostname.includes(".")) throw new Error();
            } catch {
              return rule.message || `${q.label}: invalid URL`;
            }
          }
        }
      }
    }
  }
  return null;
}

async function verifyHCaptcha(token: string, remoteIp?: string): Promise<boolean> {
  const secret = Deno.env.get("HCAPTCHA_SECRET");
  if (!secret) {
    console.warn("HCAPTCHA_SECRET not set; skipping captcha verification");
    return true;
  }
  try {
    const params = new URLSearchParams();
    params.set("secret", secret);
    params.set("response", token);
    if (remoteIp) params.set("remoteip", remoteIp);
    const res = await fetch("https://api.hcaptcha.com/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const json = await res.json();
    return Boolean(json?.success);
  } catch (e) {
    console.error("hCaptcha verification error:", e);
    return false;
  }
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

    if (settings.captchaEnabled && settings.captchaProvider === "hcaptcha") {
      const token = body._captcha_token as string | undefined;
      if (!token) {
        return new Response(
          JSON.stringify({ error: "Captcha required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const remoteIp = req.headers.get("x-forwarded-for")?.split(",")[0] || undefined;
      const ok = await verifyHCaptcha(token, remoteIp);
      if (!ok) {
        return new Response(
          JSON.stringify({ error: "Captcha verification failed" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const validationError = validateAnswers(answers, typedSurvey.definition);
    if (validationError) {
      return new Response(
        JSON.stringify({ error: validationError }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

      await writeCustomFieldValues(supabase, contactId, answers, typedSurvey.definition);
    }

    await writeObjectRecords(
      supabase,
      typedSurvey.organization_id,
      contactId,
      answers,
      typedSurvey.definition,
    );

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
