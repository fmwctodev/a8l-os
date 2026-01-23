import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const QBO_API_BASE = "https://quickbooks.api.intuit.com/v3/company";
const QBO_TOKEN_ENDPOINT = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

interface QBOConnection {
  id: string;
  org_id: string;
  realm_id: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  token_expiry: string;
}

async function getValidAccessToken(
  supabase: ReturnType<typeof createClient>,
  connection: QBOConnection
): Promise<string> {
  const tokenExpiry = new Date(connection.token_expiry);
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  if (tokenExpiry > fiveMinutesFromNow) {
    return connection.access_token_encrypted;
  }

  const qboClientId = Deno.env.get("QBO_CLIENT_ID");
  const qboClientSecret = Deno.env.get("QBO_CLIENT_SECRET");

  const basicAuth = btoa(`${qboClientId}:${qboClientSecret}`);
  const tokenResponse = await fetch(QBO_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `grant_type=refresh_token&refresh_token=${connection.refresh_token_encrypted}`,
  });

  if (!tokenResponse.ok) {
    throw new Error("Failed to refresh QBO token");
  }

  const tokens = await tokenResponse.json();
  const newExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  await supabase
    .from("qbo_connections")
    .update({
      access_token_encrypted: tokens.access_token,
      refresh_token_encrypted: tokens.refresh_token,
      token_expiry: newExpiry,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id);

  return tokens.access_token;
}

async function qboRequest(
  accessToken: string,
  realmId: string,
  endpoint: string,
  method: string = "GET",
  body?: unknown
): Promise<unknown> {
  const url = `${QBO_API_BASE}/${realmId}${endpoint}?minorversion=65`;

  const headers: Record<string, string> = {
    "Authorization": `Bearer ${accessToken}`,
    "Accept": "application/json",
  };

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`QBO API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

async function findOrCreateCustomer(
  accessToken: string,
  realmId: string,
  contact: { id: string; email?: string; first_name: string; last_name: string; phone?: string; company?: string }
): Promise<{ Id: string; SyncToken: string }> {
  const displayName = contact.company || `${contact.first_name} ${contact.last_name}`;

  const queryResponse = await qboRequest(
    accessToken,
    realmId,
    `/query?query=${encodeURIComponent(`SELECT * FROM Customer WHERE DisplayName = '${displayName.replace(/'/g, "\\'")}' MAXRESULTS 1`)}`
  ) as { QueryResponse: { Customer?: Array<{ Id: string; SyncToken: string }> } };

  if (queryResponse.QueryResponse.Customer?.length) {
    return queryResponse.QueryResponse.Customer[0];
  }

  const customerData = {
    DisplayName: displayName,
    GivenName: contact.first_name,
    FamilyName: contact.last_name,
    PrimaryEmailAddr: contact.email ? { Address: contact.email } : undefined,
    PrimaryPhone: contact.phone ? { FreeFormNumber: contact.phone } : undefined,
    CompanyName: contact.company || undefined,
  };

  const createResponse = await qboRequest(
    accessToken,
    realmId,
    "/customer",
    "POST",
    customerData
  ) as { Customer: { Id: string; SyncToken: string } };

  return createResponse.Customer;
}

async function createQBOItem(
  accessToken: string,
  realmId: string,
  product: { name: string; description?: string; price_amount: number; billing_type: string }
): Promise<{ Id: string; SyncToken: string }> {
  const accountQuery = await qboRequest(
    accessToken,
    realmId,
    `/query?query=${encodeURIComponent("SELECT * FROM Account WHERE AccountType = 'Income' MAXRESULTS 1")}`
  ) as { QueryResponse: { Account?: Array<{ Id: string }> } };

  const incomeAccountId = accountQuery.QueryResponse.Account?.[0]?.Id;

  const itemData = {
    Name: product.name,
    Description: product.description || product.name,
    Type: "Service",
    UnitPrice: product.price_amount,
    IncomeAccountRef: incomeAccountId ? { value: incomeAccountId } : undefined,
  };

  const response = await qboRequest(
    accessToken,
    realmId,
    "/item",
    "POST",
    itemData
  ) as { Item: { Id: string; SyncToken: string } };

  return response.Item;
}

async function createQBOInvoice(
  accessToken: string,
  realmId: string,
  customerId: string,
  lineItems: Array<{ description: string; quantity: number; unit_price: number; qbo_item_id?: string }>,
  dueDate?: string,
  memo?: string
): Promise<{ Id: string; DocNumber: string; InvoiceLink?: string }> {
  const lines = lineItems.map((item, index) => ({
    LineNum: index + 1,
    Description: item.description,
    Amount: item.quantity * item.unit_price,
    DetailType: "SalesItemLineDetail",
    SalesItemLineDetail: {
      ItemRef: item.qbo_item_id ? { value: item.qbo_item_id } : undefined,
      Qty: item.quantity,
      UnitPrice: item.unit_price,
    },
  }));

  const invoiceData: Record<string, unknown> = {
    CustomerRef: { value: customerId },
    Line: lines,
    CustomerMemo: memo ? { value: memo } : undefined,
  };

  if (dueDate) {
    invoiceData.DueDate = dueDate;
  }

  const response = await qboRequest(
    accessToken,
    realmId,
    "/invoice",
    "POST",
    invoiceData
  ) as { Invoice: { Id: string; DocNumber: string; InvoiceLink?: string } };

  return response.Invoice;
}

async function sendQBOInvoice(
  accessToken: string,
  realmId: string,
  invoiceId: string,
  email: string
): Promise<{ Invoice: { Id: string; InvoiceLink?: string } }> {
  const response = await qboRequest(
    accessToken,
    realmId,
    `/invoice/${invoiceId}/send?sendTo=${encodeURIComponent(email)}`,
    "POST"
  ) as { Invoice: { Id: string; InvoiceLink?: string } };

  return { Invoice: response.Invoice };
}

async function getQBOInvoice(
  accessToken: string,
  realmId: string,
  invoiceId: string
): Promise<{ Invoice: unknown }> {
  const response = await qboRequest(
    accessToken,
    realmId,
    `/invoice/${invoiceId}`
  ) as { Invoice: unknown };

  return { Invoice: response.Invoice };
}

async function voidQBOInvoice(
  accessToken: string,
  realmId: string,
  invoiceId: string,
  syncToken: string
): Promise<void> {
  await qboRequest(
    accessToken,
    realmId,
    `/invoice?operation=void`,
    "POST",
    { Id: invoiceId, SyncToken: syncToken }
  );
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: userData } = await supabase
      .from("users")
      .select("id, organization_id")
      .eq("id", user.id)
      .single();

    if (!userData) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: connection } = await supabase
      .from("qbo_connections")
      .select("*")
      .eq("org_id", userData.organization_id)
      .single();

    if (!connection) {
      return new Response(
        JSON.stringify({ error: "QuickBooks Online is not connected" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = await getValidAccessToken(supabase, connection);
    const body = await req.json();
    const { action } = body;

    let result: unknown;

    switch (action) {
      case "find_or_create_customer": {
        const { contact } = body;
        result = await findOrCreateCustomer(accessToken, connection.realm_id, contact);
        break;
      }

      case "create_item": {
        const { product } = body;
        result = await createQBOItem(accessToken, connection.realm_id, product);
        break;
      }

      case "create_invoice": {
        const { customerId, lineItems, dueDate, memo } = body;
        result = await createQBOInvoice(accessToken, connection.realm_id, customerId, lineItems, dueDate, memo);
        break;
      }

      case "send_invoice": {
        const { invoiceId, email } = body;
        result = await sendQBOInvoice(accessToken, connection.realm_id, invoiceId, email);
        break;
      }

      case "get_invoice": {
        const { invoiceId } = body;
        result = await getQBOInvoice(accessToken, connection.realm_id, invoiceId);
        break;
      }

      case "void_invoice": {
        const { invoiceId, syncToken } = body;
        await voidQBOInvoice(accessToken, connection.realm_id, invoiceId, syncToken);
        result = { success: true };
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    await supabase
      .from("qbo_connections")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", connection.id);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("QBO API error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});