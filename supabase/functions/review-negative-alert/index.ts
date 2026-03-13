import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ENCRYPTION_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!.slice(0, 32);

async function decrypt(encryptedText: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(ENCRYPTION_KEY.padEnd(32, "0").slice(0, 32));
  const key = await crypto.subtle.importKey("raw", keyData, { name: "AES-GCM" }, false, ["decrypt"]);
  const combined = Uint8Array.from(atob(encryptedText), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(decrypted);
}

interface Review {
  id: string;
  organization_id: string;
  rating: number;
  comment: string | null;
  reviewer_name: string;
  reviewer_email: string | null;
  contact_id: string | null;
  provider: string;
  received_at: string;
}

interface ReputationSettings {
  negative_review_threshold: number;
  negative_review_create_task: boolean;
  negative_review_task_assignee: string | null;
  negative_review_task_due_hours: number;
  negative_review_notify_email: boolean;
  negative_review_notify_sms: boolean;
  notification_recipients: string[];
  brand_name: string | null;
}

interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
}

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
}

async function getDecryptedSendGridKey(
  orgId: string,
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<string | null> {
  const { data: conn } = await supabase
    .from("integration_connections")
    .select("credentials_encrypted, credentials_iv, status, integrations!inner(key)")
    .eq("org_id", orgId)
    .eq("integrations.key", "sendgrid")
    .maybeSingle();

  if (!conn || conn.status !== "connected" || !conn.credentials_encrypted || !conn.credentials_iv) return null;

  const response = await fetch(`${supabaseUrl}/functions/v1/email-crypto`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "decrypt",
      encrypted: conn.credentials_encrypted,
      iv: conn.credentials_iv,
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  return data.plaintext;
}

async function sendEmailNotification(
  recipients: User[],
  review: Review,
  contact: Contact | null,
  orgName: string,
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<void> {
  const sendgridKey = await getDecryptedSendGridKey(review.organization_id, supabase, supabaseUrl, serviceRoleKey);
  if (!sendgridKey) {
    console.log("SendGrid not connected for org, skipping email notification");
    return;
  }

  const { data: fromAddress } = await supabase
    .from("email_from_addresses")
    .select("email, display_name")
    .eq("org_id", review.organization_id)
    .eq("active", true)
    .eq("is_default", true)
    .maybeSingle();

  const fromEmail = fromAddress?.email || "notifications@autom8ion.com";
  const fromName = fromAddress?.display_name || orgName;

  const reviewLink = `${supabaseUrl.replace('.supabase.co', '')}/reputation?review=${review.id}`;
  const customerName = contact
    ? `${contact.first_name} ${contact.last_name}`
    : review.reviewer_name;

  const ratingStars = "\u2605".repeat(review.rating) + "\u2606".repeat(5 - review.rating);

  for (const recipient of recipients) {
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Negative Review Alert</h2>
        <p>A negative review has been received for <strong>${orgName}</strong> that requires your attention.</p>

        <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0;"><strong>Rating:</strong> ${ratingStars} (${review.rating}/5)</p>
          <p style="margin: 0 0 8px 0;"><strong>Customer:</strong> ${customerName}</p>
          <p style="margin: 0 0 8px 0;"><strong>Platform:</strong> ${review.provider}</p>
          <p style="margin: 0 0 8px 0;"><strong>Date:</strong> ${new Date(review.received_at).toLocaleDateString()}</p>
          ${review.comment ? `<p style="margin: 16px 0 0 0; font-style: italic;">"${review.comment}"</p>` : ""}
        </div>

        ${contact ? `
        <div style="background: #f3f4f6; padding: 16px; margin: 20px 0; border-radius: 8px;">
          <h3 style="margin: 0 0 12px 0;">Customer Contact Information</h3>
          ${contact.email ? `<p style="margin: 0 0 4px 0;"><strong>Email:</strong> <a href="mailto:${contact.email}">${contact.email}</a></p>` : ""}
          ${contact.phone ? `<p style="margin: 0;"><strong>Phone:</strong> <a href="tel:${contact.phone}">${contact.phone}</a></p>` : ""}
        </div>
        ` : ""}

        <p>Please follow up with this customer as soon as possible to address their concerns.</p>

        <a href="${reviewLink}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">View Review Details</a>
      </div>
    `;

    try {
      await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sendgridKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: recipient.email }] }],
          from: { email: fromEmail, name: fromName },
          subject: `[Action Required] Negative ${review.rating}-Star Review from ${customerName}`,
          content: [{ type: "text/html", value: emailContent }],
        }),
      });
    } catch (error) {
      console.error(`Failed to send email to ${recipient.email}:`, error);
    }
  }
}

async function sendSmsNotification(
  recipients: User[],
  review: Review,
  contact: Contact | null,
  orgName: string,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  const { data: connection } = await supabase
    .from("twilio_connection")
    .select("account_sid, auth_token_encrypted, status")
    .eq("org_id", review.organization_id)
    .maybeSingle();

  if (!connection || connection.status !== "connected") {
    console.log("Twilio not connected for org, skipping SMS notification");
    return;
  }

  let authToken: string;
  try {
    authToken = await decrypt(connection.auth_token_encrypted);
  } catch {
    console.error("Failed to decrypt Twilio auth token");
    return;
  }

  const accountSid = connection.account_sid;

  const { data: defaultNum } = await supabase
    .from("twilio_numbers")
    .select("phone_number")
    .eq("org_id", review.organization_id)
    .eq("is_default_sms", true)
    .eq("status", "active")
    .maybeSingle();

  let fromNumber = defaultNum?.phone_number;
  if (!fromNumber) {
    const { data: anyNum } = await supabase
      .from("twilio_numbers")
      .select("phone_number")
      .eq("org_id", review.organization_id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    fromNumber = anyNum?.phone_number;
  }

  if (!fromNumber) {
    console.log("No active Twilio number found for org, skipping SMS notification");
    return;
  }

  const customerName = contact
    ? `${contact.first_name} ${contact.last_name}`
    : review.reviewer_name;

  const message = `[${orgName}] ALERT: ${review.rating}-star review from ${customerName}. "${(review.comment || "No comment").substring(0, 100)}${(review.comment?.length || 0) > 100 ? "..." : ""}" Please follow up ASAP.`;

  for (const recipient of recipients) {
    if (!recipient.phone) continue;

    try {
      const auth = btoa(`${accountSid}:${authToken}`);
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: recipient.phone,
          From: fromNumber,
          Body: message,
        }),
      });
    } catch (error) {
      console.error(`Failed to send SMS to ${recipient.phone}:`, error);
    }
  }
}

async function createFollowUpTask(
  review: Review,
  contact: Contact | null,
  settings: ReputationSettings,
  supabase: ReturnType<typeof createClient>
): Promise<string | null> {
  const dueDate = new Date();
  dueDate.setHours(dueDate.getHours() + (settings.negative_review_task_due_hours || 24));

  const customerName = contact
    ? `${contact.first_name} ${contact.last_name}`
    : review.reviewer_name;

  const taskDescription = `
Follow up on negative ${review.rating}-star review from ${customerName}.

Review Details:
- Platform: ${review.provider}
- Rating: ${review.rating}/5
- Date: ${new Date(review.received_at).toLocaleDateString()}
${review.comment ? `- Comment: "${review.comment}"` : ""}

${contact ? `
Customer Contact:
- Email: ${contact.email || "Not available"}
- Phone: ${contact.phone || "Not available"}
` : ""}

Action Items:
1. Contact the customer to understand their concerns
2. Apologize and offer resolution
3. Document the outcome
4. Consider posting a public response to the review
`.trim();

  const { data: task, error: taskError } = await supabase
    .from("contact_tasks")
    .insert({
      organization_id: review.organization_id,
      contact_id: contact?.id || null,
      title: `Follow up on negative review from ${customerName}`,
      description: taskDescription,
      status: "pending",
      priority: "high",
      due_date: dueDate.toISOString(),
      assigned_to: settings.negative_review_task_assignee || null,
    })
    .select()
    .single();

  if (taskError) {
    console.error("Failed to create task:", taskError);
    return null;
  }

  const { error: linkError } = await supabase
    .from("negative_review_tasks")
    .insert({
      organization_id: review.organization_id,
      review_id: review.id,
      task_id: task.id,
      contact_id: contact?.id || null,
    });

  if (linkError) {
    console.error("Failed to link task to review:", linkError);
  }

  if (contact?.id) {
    await supabase.from("contact_timeline").insert({
      contact_id: contact.id,
      event_type: "task_created",
      event_data: {
        task_id: task.id,
        reason: "negative_review",
        review_id: review.id,
      },
    });
  }

  return task.id;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { review_id } = body;

    if (!review_id) {
      return new Response(
        JSON.stringify({ error: "review_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: review, error: reviewError } = await supabase
      .from("reviews")
      .select("*")
      .eq("id", review_id)
      .single();

    if (reviewError || !review) {
      return new Response(
        JSON.stringify({ error: "Review not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: settings } = await supabase
      .from("reputation_settings")
      .select("*")
      .eq("organization_id", review.organization_id)
      .maybeSingle();

    const threshold = settings?.negative_review_threshold || 3;
    if (review.rating > threshold) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Review rating above threshold, no action needed",
          rating: review.rating,
          threshold,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: existingTask } = await supabase
      .from("negative_review_tasks")
      .select("id")
      .eq("review_id", review_id)
      .maybeSingle();

    if (existingTask) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Task already exists for this review",
          task_id: existingTask.id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let contact: Contact | null = null;
    if (review.contact_id) {
      const { data: contactData } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email, phone")
        .eq("id", review.contact_id)
        .single();
      contact = contactData as Contact | null;
    }

    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", review.organization_id)
      .single();

    const orgName = settings?.brand_name || org?.name || "Your Business";

    let taskId: string | null = null;
    if (settings?.negative_review_create_task !== false) {
      taskId = await createFollowUpTask(
        review as Review,
        contact,
        settings as ReputationSettings,
        supabase
      );
    }

    let recipientIds = settings?.notification_recipients || [];
    if (recipientIds.length === 0) {
      const { data: admins } = await supabase
        .from("users")
        .select("id")
        .eq("organization_id", review.organization_id)
        .in("role_id", (
          await supabase
            .from("roles")
            .select("id")
            .in("name", ["Admin", "Manager"])
        ).data?.map(r => r.id) || [])
        .limit(5);

      recipientIds = admins?.map(a => a.id) || [];
    }

    let recipients: User[] = [];
    if (recipientIds.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("id, name, email, phone")
        .in("id", recipientIds);
      recipients = (users || []) as User[];
    }

    let notificationMethod: "email" | "sms" | "both" | null = null;

    if (settings?.negative_review_notify_email !== false && recipients.length > 0) {
      await sendEmailNotification(
        recipients,
        review as Review,
        contact,
        orgName,
        supabase,
        supabaseUrl,
        serviceRoleKey
      );
      notificationMethod = "email";
    }

    if (settings?.negative_review_notify_sms && recipients.length > 0) {
      await sendSmsNotification(recipients, review as Review, contact, orgName, supabase);
      notificationMethod = notificationMethod ? "both" : "sms";
    }

    if (taskId && notificationMethod) {
      await supabase
        .from("negative_review_tasks")
        .update({
          notification_sent_at: new Date().toISOString(),
          notification_method: notificationMethod,
        })
        .eq("review_id", review_id);
    }

    await supabase.from("event_outbox").insert({
      org_id: review.organization_id,
      event_type: "review.negative_received",
      contact_id: review.contact_id,
      entity_type: "review",
      entity_id: review.id,
      payload: {
        review_id: review.id,
        rating: review.rating,
        provider: review.provider,
        task_id: taskId,
        contact_id: review.contact_id,
        notification_method: notificationMethod,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        review_id,
        rating: review.rating,
        threshold,
        task_created: !!taskId,
        task_id: taskId,
        notifications_sent: notificationMethod,
        recipients_count: recipients.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Review negative alert error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
