import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  createStripeInvoice,
  findOrCreateStripeCustomer,
  getDecryptedStripeCreds,
  sendStripeInvoice,
  voidStripeInvoice,
  type StripeLineItemInput,
} from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateInvoiceRequest {
  action: "createInvoice";
  org_id: string;
  contact: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone?: string | null;
    company?: string | null;
  };
  line_items: StripeLineItemInput[];
  due_days?: number;
  memo?: string;
  auto_send?: boolean;
}

interface SendInvoiceRequest {
  action: "sendInvoice";
  org_id: string;
  invoice_id: string;
}

interface VoidInvoiceRequest {
  action: "voidInvoice";
  org_id: string;
  invoice_id: string;
}

type Payload = CreateInvoiceRequest | SendInvoiceRequest | VoidInvoiceRequest;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const payload: Payload = await req.json();
    const creds = await getDecryptedStripeCreds(payload.org_id, supabase, supabaseUrl, serviceRoleKey);
    if (!creds) {
      return jsonResponse({ error: "Stripe not connected for this organization" }, 404);
    }

    if (payload.action === "createInvoice") {
      const customerResult = await findOrCreateStripeCustomer(creds.secretKey, payload.contact);
      if (!customerResult.ok || !customerResult.customer) {
        return jsonResponse({ error: customerResult.error || "Failed to find/create Stripe customer" }, 500);
      }

      const invoiceResult = await createStripeInvoice(
        creds.secretKey,
        customerResult.customer.id,
        payload.line_items,
        {
          dueDays: payload.due_days,
          memo: payload.memo,
          autoSend: payload.auto_send,
        },
      );
      if (!invoiceResult.ok || !invoiceResult.invoice) {
        return jsonResponse({ error: invoiceResult.error || "Failed to create Stripe invoice" }, 500);
      }

      return jsonResponse({
        success: true,
        invoice: invoiceResult.invoice,
        customer: customerResult.customer,
      });
    }

    if (payload.action === "sendInvoice") {
      const result = await sendStripeInvoice(creds.secretKey, payload.invoice_id);
      if (!result.ok) return jsonResponse({ error: result.error }, 500);
      return jsonResponse({ success: true, invoice: result.invoice });
    }

    if (payload.action === "voidInvoice") {
      const result = await voidStripeInvoice(creds.secretKey, payload.invoice_id);
      if (!result.ok) return jsonResponse({ error: result.error }, 500);
      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
