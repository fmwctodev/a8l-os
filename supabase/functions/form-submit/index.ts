import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

interface FormField {
  id: string;
  type: string;
  label: string;
  required?: boolean;
  validationRules?: FormValidationRule[];
  mapping?: {
    contactField?: string;
    customFieldId?: string;
    objectId?: string;
    objectFieldKey?: string;
  };
}

interface FormDefinition {
  fields: FormField[];
}

interface FormSettings {
  thankYouMessage?: string;
  redirectUrl?: string;
  contactMatching: "email_first" | "phone_first" | "create_new";
  fieldOverwrite: "always" | "only_if_empty";
  tagIds?: string[];
  ownerId?: string;
  departmentId?: string;
  honeypotEnabled?: boolean;
  rateLimitPerIp?: number;
  captchaEnabled?: boolean;
  captchaProvider?: "hcaptcha";
  captchaSiteKey?: string;
}

interface Form {
  id: string;
  organization_id: string;
  definition: FormDefinition;
  settings: FormSettings;
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

async function checkRateLimit(
  supabase: ReturnType<typeof createClient>,
  formId: string,
  ip: string,
  limit: number,
): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  // ip_address is stored inside the attribution jsonb column, not as a top-level column
  const { count, error } = await supabase
    .from("form_submissions")
    .select("id", { count: "exact", head: true })
    .eq("form_id", formId)
    .eq("attribution->>ip_address", ip)
    .gte("submitted_at", oneHourAgo);

  if (error) {
    console.error("Rate limit check error:", error);
    // Fail open - allow submission if check fails
    return true;
  }

  return (count ?? 0) < limit;
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

// Columns on the public.contacts table that submissions may auto-populate.
const CONTACT_COLUMNS = [
  "first_name", "last_name", "email", "phone", "company", "job_title",
  "address_line1", "address_line2", "city", "state", "postal_code", "country",
  "source",
] as const;

function buildContactDataFromForm(
  payload: Record<string, unknown>,
  fields: FormField[],
): Record<string, unknown> {
  const contactData: Record<string, unknown> = {};
  const setIfPresent = (key: string, value: unknown) => {
    if (value === undefined || value === null) return;
    if (typeof value === "string" && value.trim() === "") return;
    contactData[key] = value;
  };

  for (const field of fields) {
    const value = payload[field.id];
    if (value === undefined || value === null) continue;

    // Explicit contact-field mapping wins over auto-detect
    if (field.mapping?.contactField) {
      setIfPresent(field.mapping.contactField, value);
      continue;
    }
    // Field is wired to a custom field or custom object — handled elsewhere
    if (field.mapping?.customFieldId || field.mapping?.objectId) continue;

    switch (field.type) {
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
        // Composite { street, city, state, postal_code, country }
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

  return contactData;
}

async function findExistingContact(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  email?: string,
  phone?: string,
): Promise<{ id: string } | null> {
  // Always email-first, then phone — anti-duplicate guard regardless of form setting.
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
    // only_if_empty: read current row and only fill in columns that are NULL or empty string
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
  payload: Record<string, unknown>,
  fields: FormField[],
  settings: FormSettings
): Promise<string | null> {
  const contactData = buildContactDataFromForm(payload, fields);

  const email = contactData.email as string | undefined;
  const phone = contactData.phone as string | undefined;

  // contactMatching === "create_new" is an explicit opt-out from de-dup.
  // Default behavior: try email then phone; create only if no match.
  if (settings.contactMatching !== "create_new") {
    const existing = await findExistingContact(supabase, organizationId, email, phone);
    if (existing) {
      await applyContactUpdate(supabase, existing.id, contactData, settings.fieldOverwrite || "only_if_empty");
      return existing.id;
    }
  }

  // No identifying fields and user did NOT explicitly choose create_new — skip orphan creation
  if (!email && !phone && settings.contactMatching !== "create_new") {
    return null;
  }

  const insert: Record<string, unknown> = {
    organization_id: organizationId,
    department_id: departmentId,
    owner_id: settings.ownerId || null,
    status: "active",
    first_name: "",
    last_name: "",
    source: "form",
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

  const inserts = tagIds.map((tagId) => ({
    contact_id: contactId,
    tag_id: tagId,
  }));

  await supabase.from("contact_tags").upsert(inserts, { onConflict: "contact_id,tag_id" });
}

async function writeCustomFieldValues(
  supabase: ReturnType<typeof createClient>,
  contactId: string,
  payload: Record<string, unknown>,
  fields: FormField[]
): Promise<void> {
  const inserts: { contact_id: string; custom_field_id: string; value: unknown }[] = [];
  for (const field of fields) {
    const customFieldId = field.mapping?.customFieldId;
    if (!customFieldId) continue;
    const value = payload[field.id];
    if (value === undefined) continue;
    inserts.push({
      contact_id: contactId,
      custom_field_id: customFieldId,
      value: value === null ? null : value,
    });
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
  payload: Record<string, unknown>,
  fields: FormField[]
): Promise<void> {
  // Group submitted values by objectId
  const groups = new Map<string, Record<string, unknown>>();
  for (const field of fields) {
    const objectId = field.mapping?.objectId;
    const fieldKey = field.mapping?.objectFieldKey;
    if (!objectId || !fieldKey) continue;
    const value = payload[field.id];
    if (value === undefined || value === null || value === "") continue;
    const existing = groups.get(objectId) || {};
    existing[fieldKey] = value;
    groups.set(objectId, existing);
  }

  if (groups.size === 0) return;

  // Look up object definitions to find primary_field_key
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

    // Try to find an existing record for this contact + object
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
  formId: string,
  formName: string,
  payload: Record<string, unknown>
): Promise<void> {
  await supabase.from("contact_timeline_events").insert({
    contact_id: contactId,
    event_type: "form_submitted",
    event_data: {
      form_id: formId,
      form_name: formName,
      submitted_fields: Object.keys(payload),
    },
  });
}

function validateSubmission(
  payload: Record<string, unknown>,
  fields: FormField[],
): string | null {
  for (const field of fields) {
    const raw = payload[field.id];
    const isEmpty =
      raw === undefined ||
      raw === null ||
      raw === "" ||
      (Array.isArray(raw) && raw.length === 0);

    if (field.required && field.type !== "hidden" && field.type !== "divider") {
      if (isEmpty) {
        return `${field.label || field.id} is required`;
      }
    }

    if (isEmpty || !field.validationRules) continue;

    const value = String(raw ?? "");
    const numValue = typeof raw === "number" ? raw : parseFloat(value);

    for (const rule of field.validationRules) {
      if (rule.type === "min_length" && value.length < Number(rule.value)) {
        return rule.message || `${field.label}: minimum ${rule.value} characters`;
      }
      if (rule.type === "max_length" && value.length > Number(rule.value)) {
        return rule.message || `${field.label}: maximum ${rule.value} characters`;
      }
      if (rule.type === "pattern") {
        try {
          if (!new RegExp(String(rule.value)).test(value)) {
            return rule.message || `${field.label}: invalid format`;
          }
        } catch {
          // bad pattern in builder — ignore at runtime
        }
      }
      if (rule.type === "min" && !isNaN(numValue) && numValue < Number(rule.value)) {
        return rule.message || `${field.label}: must be at least ${rule.value}`;
      }
      if (rule.type === "max" && !isNaN(numValue) && numValue > Number(rule.value)) {
        return rule.message || `${field.label}: must be at most ${rule.value}`;
      }
      if (rule.type === "min_date" && value && value < String(rule.value)) {
        return rule.message || `${field.label}: must be on or after ${rule.value}`;
      }
      if (rule.type === "max_date" && value && value > String(rule.value)) {
        return rule.message || `${field.label}: must be on or before ${rule.value}`;
      }
      if (rule.type === "format") {
        if (field.type === "email") {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            return rule.message || `${field.label}: invalid email`;
          }
        } else if (field.type === "phone") {
          const digits = value.replace(/\D+/g, "");
          if (digits.length < 7 || digits.length > 15) {
            return rule.message || `${field.label}: invalid phone number`;
          }
        } else if (field.type === "website") {
          try {
            const u = new URL(value.includes("://") ? value : `https://${value}`);
            if (!u.hostname.includes(".")) throw new Error();
          } catch {
            return rule.message || `${field.label}: invalid URL`;
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
  formId: string,
  contactId: string | null,
  submissionId: string
): Promise<void> {
  await supabase.from("event_outbox").insert({
    org_id: organizationId,
    event_type: "form_submitted",
    contact_id: contactId,
    entity_type: "form_submission",
    entity_id: submissionId,
    payload: {
      form_id: formId,
      submission_id: submissionId,
      contact_id: contactId,
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
    } else if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      body = Object.fromEntries(formData.entries());
    } else {
      body = await req.json().catch(() => ({}));
    }

    // Form submission data may live under body.data or directly on body
    if (body.data && typeof body.data === "object") {
      body = { ...body, ...(body.data as Record<string, unknown>) };
    }

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const trailingSlug = pathParts[pathParts.length - 1];
    const slug = trailingSlug && trailingSlug !== "form-submit" ? trailingSlug : undefined;
    const formIdFromBody = body.formId as string | undefined;

    if (!slug && !formIdFromBody) {
      return new Response(
        JSON.stringify({ error: "Form slug or formId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let formQuery = supabase
      .from("forms")
      .select("*")
      .eq("status", "published");
    if (slug) {
      formQuery = formQuery.eq("public_slug", slug);
    } else if (formIdFromBody) {
      formQuery = formQuery.eq("id", formIdFromBody);
    }
    const { data: form, error: formError } = await formQuery.maybeSingle();

    if (formError || !form) {
      return new Response(
        JSON.stringify({ error: "Form not found or not published" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const typedForm = form as Form;
    const settings = typedForm.settings;

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";

    if (settings.rateLimitPerIp && !(await checkRateLimit(supabase, typedForm.id, clientIp, settings.rateLimitPerIp))) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (settings.honeypotEnabled && body._honeypot) {
      return new Response(
        JSON.stringify({ success: true, message: settings.thankYouMessage || "Thank you for your submission!" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (settings.captchaEnabled && settings.captchaProvider === "hcaptcha") {
      const token = body._captcha_token as string | undefined;
      if (!token) {
        return new Response(
          JSON.stringify({ error: "Captcha required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const ok = await verifyHCaptcha(token, clientIp);
      if (!ok) {
        return new Response(
          JSON.stringify({ error: "Captcha verification failed" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const validationError = validateSubmission(body, typedForm.definition.fields);
    if (validationError) {
      return new Response(
        JSON.stringify({ error: validationError }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const idempotencyKey = body._idempotency_key as string | undefined;
    if (idempotencyKey) {
      const { data: existingSubmission } = await supabase
        .from("form_submissions")
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

    const { data: defaultDept } = await supabase
      .from("departments")
      .select("id")
      .eq("organization_id", typedForm.organization_id)
      .limit(1)
      .maybeSingle();

    const departmentId = settings.departmentId || defaultDept?.id;

    if (!departmentId) {
      return new Response(
        JSON.stringify({ error: "No department configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const contactId = await findOrCreateContact(
      supabase,
      typedForm.organization_id,
      departmentId,
      body,
      typedForm.definition.fields,
      settings
    );

    if (settings.tagIds && settings.tagIds.length > 0 && contactId) {
      await applyTags(supabase, contactId, settings.tagIds);
    }

    if (contactId) {
      await writeCustomFieldValues(supabase, contactId, body, typedForm.definition.fields);
    }

    await writeObjectRecords(
      supabase,
      typedForm.organization_id,
      contactId,
      body,
      typedForm.definition.fields,
    );

    const { data: submission, error: submitError } = await supabase
      .from("form_submissions")
      .insert({
        organization_id: typedForm.organization_id,
        form_id: typedForm.id,
        contact_id: contactId,
        payload: body,
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
      const { data: formData } = await supabase
        .from("forms")
        .select("name")
        .eq("id", typedForm.id)
        .single();

      await createTimelineEvent(supabase, contactId, typedForm.id, formData?.name || "Form", body);
    }

    await emitOutboxEvent(supabase, typedForm.organization_id, typedForm.id, contactId, submission.id);

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
        message: settings.thankYouMessage || "Thank you for your submission!",
        submission_id: submission.id,
        contact_id: contactId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Form submission error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
