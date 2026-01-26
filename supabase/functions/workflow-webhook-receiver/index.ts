import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Webhook-Signature",
};

interface PayloadMapping {
  sourceField: string;
  targetField: string;
}

interface WorkflowDefinition {
  nodes: Array<{ id: string; type: string; data: Record<string, unknown> }>;
  edges: Array<{ id: string; source: string; target: string; sourceHandle?: string }>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const token = pathParts[pathParts.length - 1];

    if (!token || token === "workflow-webhook-receiver") {
      return new Response(JSON.stringify({ error: "Missing webhook token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: trigger } = await supabase
      .from("workflow_webhook_triggers")
      .select(`
        *,
        workflow:workflows(id, org_id, status, published_definition)
      `)
      .eq("token", token)
      .maybeSingle();

    if (!trigger) {
      return new Response(JSON.stringify({ error: "Webhook not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!trigger.is_active) {
      return new Response(JSON.stringify({ error: "Webhook is inactive" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (trigger.workflow?.status !== "published") {
      return new Response(JSON.stringify({ error: "Workflow is not published" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawBody = await req.text();
    let payload: unknown;

    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (trigger.secret_hash) {
      const signature = req.headers.get("X-Webhook-Signature");
      if (!signature) {
        return new Response(JSON.stringify({ error: "Missing signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const isValid = await verifySignature(rawBody, signature, trigger.secret_hash);
      if (!isValid) {
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const items = Array.isArray(payload) ? payload : [payload];

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
                     req.headers.get("x-real-ip") ||
                     null;
    const userAgent = req.headers.get("user-agent") || null;

    const { data: requestLog } = await supabase
      .from("workflow_webhook_requests")
      .insert({
        org_id: trigger.org_id,
        trigger_id: trigger.id,
        request_payload: payload,
        items_received: items.length,
        status: "processing",
        ip_address: clientIp,
        user_agent: userAgent,
      })
      .select()
      .single();

    const results = {
      received_count: items.length,
      processed_count: 0,
      contacts_created: 0,
      contacts_updated: 0,
      enrollments_created: 0,
      errors: [] as Array<{ index: number; error: string }>,
    };

    const { data: latestVersion } = await supabase
      .from("workflow_versions")
      .select("id")
      .eq("workflow_id", trigger.workflow_id)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latestVersion) {
      await supabase
        .from("workflow_webhook_requests")
        .update({
          status: "failed",
          processed_at: new Date().toISOString(),
          error_details: { error: "No published workflow version found" },
        })
        .eq("id", requestLog.id);

      return new Response(JSON.stringify({ error: "Workflow has no published version" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const definition = trigger.workflow.published_definition as WorkflowDefinition;
    const triggerNode = definition.nodes.find((n) => n.type === "trigger");
    const firstEdge = triggerNode
      ? definition.edges.find((e) => e.source === triggerNode.id)
      : null;
    const firstNodeId = firstEdge?.target || null;

    for (let i = 0; i < items.length; i++) {
      const item = items[i] as Record<string, unknown>;

      try {
        const contactResult = await resolveOrCreateContact(
          supabase,
          trigger,
          item
        );

        if (!contactResult.contact) {
          results.errors.push({ index: i, error: contactResult.error || "Could not resolve contact" });
          continue;
        }

        if (contactResult.created) {
          results.contacts_created++;
        } else if (contactResult.updated) {
          results.contacts_updated++;
        }

        const shouldEnroll = await checkReEnrollmentPolicy(
          supabase,
          trigger.workflow_id,
          contactResult.contact.id,
          trigger.re_enrollment_policy
        );

        if (!shouldEnroll) {
          results.processed_count++;
          continue;
        }

        const { data: enrollment } = await supabase
          .from("workflow_enrollments")
          .insert({
            org_id: trigger.org_id,
            workflow_id: trigger.workflow_id,
            version_id: latestVersion.id,
            contact_id: contactResult.contact.id,
            status: "active",
            current_node_id: firstNodeId,
            context_data: {
              trigger_source: "webhook",
              trigger_id: trigger.id,
              trigger_name: trigger.name,
              webhook_request_id: requestLog.id,
              webhook_payload: item,
              enrolled_at: new Date().toISOString(),
            },
          })
          .select()
          .single();

        if (enrollment && firstNodeId) {
          await supabase.from("workflow_jobs").insert({
            org_id: trigger.org_id,
            enrollment_id: enrollment.id,
            node_id: firstNodeId,
            run_at: new Date().toISOString(),
            status: "pending",
            execution_key: `${enrollment.id}-${firstNodeId}-${Date.now()}`,
          });

          await supabase.from("workflow_execution_logs").insert({
            org_id: trigger.org_id,
            enrollment_id: enrollment.id,
            node_id: "trigger",
            event_type: "trigger_fired",
            payload: {
              source: "webhook",
              trigger_id: trigger.id,
              trigger_name: trigger.name,
              request_id: requestLog.id,
            },
          });

          results.enrollments_created++;
        }

        results.processed_count++;
      } catch (err) {
        results.errors.push({ index: i, error: err.message });
      }
    }

    const finalStatus = results.errors.length === 0
      ? "success"
      : results.processed_count > 0
        ? "partial_failure"
        : "failed";

    await supabase
      .from("workflow_webhook_requests")
      .update({
        contacts_created: results.contacts_created,
        contacts_updated: results.contacts_updated,
        enrollments_created: results.enrollments_created,
        status: finalStatus,
        processed_at: new Date().toISOString(),
        error_details: results.errors.length > 0 ? { errors: results.errors } : null,
      })
      .eq("id", requestLog.id);

    await supabase
      .from("workflow_webhook_triggers")
      .update({
        request_count: trigger.request_count + 1,
        last_request_at: new Date().toISOString(),
      })
      .eq("id", trigger.id);

    return new Response(JSON.stringify(results), {
      status: results.errors.length === items.length ? 400 : 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook receiver error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function verifySignature(
  body: string,
  signature: string,
  secretHash: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secretHash),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const computedSignature = Array.from(new Uint8Array(signatureBytes))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const expectedSig = signature.startsWith("sha256=")
      ? signature.slice(7)
      : signature;

    return computedSignature === expectedSig.toLowerCase();
  } catch {
    return false;
  }
}

async function resolveOrCreateContact(
  supabase: ReturnType<typeof createClient>,
  trigger: {
    org_id: string;
    contact_identifier_field: string;
    contact_identifier_path: string;
    payload_mapping: PayloadMapping[];
    create_contact_if_missing: boolean;
    update_existing_contact: boolean;
  },
  payload: Record<string, unknown>
): Promise<{
  contact: { id: string; [key: string]: unknown } | null;
  created: boolean;
  updated: boolean;
  error?: string;
}> {
  const identifierValue = getNestedValue(payload, trigger.contact_identifier_path);

  if (!identifierValue) {
    return { contact: null, created: false, updated: false, error: "Missing contact identifier" };
  }

  let identifierColumn: string;
  switch (trigger.contact_identifier_field) {
    case "email":
      identifierColumn = "email";
      break;
    case "phone":
      identifierColumn = "phone";
      break;
    case "external_id":
      identifierColumn = "external_id";
      break;
    default:
      identifierColumn = "email";
  }

  const { data: existingContact } = await supabase
    .from("contacts")
    .select("*")
    .eq("org_id", trigger.org_id)
    .eq(identifierColumn, identifierValue)
    .maybeSingle();

  const mappedFields = applyPayloadMapping(payload, trigger.payload_mapping);

  if (existingContact) {
    if (trigger.update_existing_contact && Object.keys(mappedFields).length > 0) {
      const { data: updatedContact } = await supabase
        .from("contacts")
        .update({
          ...mappedFields,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingContact.id)
        .select()
        .single();

      await supabase.from("contact_timeline").insert({
        contact_id: existingContact.id,
        event_type: "contact_updated",
        event_data: {
          source: "webhook",
          fields_updated: Object.keys(mappedFields),
        },
      });

      return { contact: updatedContact, created: false, updated: true };
    }

    return { contact: existingContact, created: false, updated: false };
  }

  if (!trigger.create_contact_if_missing) {
    return { contact: null, created: false, updated: false, error: "Contact not found and creation disabled" };
  }

  const contactData: Record<string, unknown> = {
    org_id: trigger.org_id,
    [identifierColumn]: identifierValue,
    source: "webhook",
    status: "lead",
    ...mappedFields,
  };

  if (!contactData.first_name && !contactData.last_name) {
    if (identifierColumn === "email") {
      const emailParts = String(identifierValue).split("@")[0];
      contactData.first_name = emailParts.charAt(0).toUpperCase() + emailParts.slice(1);
    }
  }

  const { data: newContact, error } = await supabase
    .from("contacts")
    .insert(contactData)
    .select()
    .single();

  if (error) {
    return { contact: null, created: false, updated: false, error: error.message };
  }

  await supabase.from("contact_timeline").insert({
    contact_id: newContact.id,
    event_type: "contact_created",
    event_data: {
      source: "webhook",
      identifier_field: identifierColumn,
    },
  });

  return { contact: newContact, created: true, updated: false };
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (typeof current === "object") {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

function applyPayloadMapping(
  payload: Record<string, unknown>,
  mapping: PayloadMapping[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const map of mapping || []) {
    const value = getNestedValue(payload, map.sourceField);
    if (value !== undefined) {
      result[map.targetField] = value;
    }
  }

  return result;
}

async function checkReEnrollmentPolicy(
  supabase: ReturnType<typeof createClient>,
  workflowId: string,
  contactId: string,
  policy: string
): Promise<boolean> {
  if (policy === "always") {
    const { data: activeEnrollment } = await supabase
      .from("workflow_enrollments")
      .select("id")
      .eq("workflow_id", workflowId)
      .eq("contact_id", contactId)
      .eq("status", "active")
      .maybeSingle();

    return !activeEnrollment;
  }

  if (policy === "after_completion") {
    const { data: existingEnrollment } = await supabase
      .from("workflow_enrollments")
      .select("id, status")
      .eq("workflow_id", workflowId)
      .eq("contact_id", contactId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!existingEnrollment) return true;
    return existingEnrollment.status === "completed";
  }

  const { data: existingEnrollment } = await supabase
    .from("workflow_enrollments")
    .select("id")
    .eq("workflow_id", workflowId)
    .eq("contact_id", contactId)
    .maybeSingle();

  return !existingEnrollment;
}
