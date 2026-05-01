import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface FormField {
  id: string;
  type: string;
  label: string;
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
  const { count, error } = await supabase
    .from("form_submissions")
    .select("id", { count: "exact", head: true })
    .eq("form_id", formId)
    .eq("ip_address", ip)
    .gte("created_at", oneHourAgo);

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

async function findOrCreateContact(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  departmentId: string,
  payload: Record<string, unknown>,
  fields: FormField[],
  settings: FormSettings
): Promise<string | null> {
  const contactData: Record<string, unknown> = {};

  for (const field of fields) {
    const value = payload[field.id];
    if (value === undefined || value === null || value === "") continue;

    if (field.mapping?.contactField) {
      contactData[field.mapping.contactField] = value;
    } else {
      switch (field.type) {
        case "email":
          contactData.email = value;
          break;
        case "phone":
          contactData.phone = value;
          break;
        case "first_name":
          contactData.first_name = value;
          break;
        case "last_name":
          contactData.last_name = value;
          break;
        case "full_name": {
          const nameParts = String(value).trim().split(/\s+/);
          contactData.first_name = nameParts[0] || "";
          contactData.last_name = nameParts.slice(1).join(" ") || "";
          break;
        }
        case "company":
          contactData.company = value;
          break;
      }
    }
  }

  const email = contactData.email as string | undefined;
  const phone = contactData.phone as string | undefined;

  if (settings.contactMatching === "create_new" || (!email && !phone)) {
    const { data: newContact, error } = await supabase
      .from("contacts")
      .insert({
        organization_id: organizationId,
        department_id: departmentId,
        owner_id: settings.ownerId || null,
        first_name: contactData.first_name || "",
        last_name: contactData.last_name || "",
        email: email || null,
        phone: phone || null,
        company: contactData.company || null,
        source: "form",
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
    if (settings.fieldOverwrite === "always") {
      await supabase
        .from("contacts")
        .update({
          first_name: contactData.first_name || undefined,
          last_name: contactData.last_name || undefined,
          email: email || undefined,
          phone: phone || undefined,
          company: contactData.company || undefined,
        })
        .eq("id", existingContact.id);
    }
    return existingContact.id;
  }

  const { data: newContact, error } = await supabase
    .from("contacts")
    .insert({
      organization_id: organizationId,
      department_id: departmentId,
      owner_id: settings.ownerId || null,
      first_name: contactData.first_name || "",
      last_name: contactData.last_name || "",
      email: email || null,
      phone: phone || null,
      company: contactData.company || null,
      source: "form",
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
