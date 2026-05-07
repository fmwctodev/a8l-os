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
  source_table: "payment_provider_connections" | "integration_connections";
}

async function findConnection(
  supabase: ReturnType<typeof createClient>,
  orgId: string
): Promise<QBOConnection | null> {
  const { data: qboConn } = await supabase
    .from("payment_provider_connections")
    .select("*")
    .eq("org_id", orgId)
    .eq("provider", "quickbooks_online")
    .maybeSingle();

  if (qboConn) {
    return { ...qboConn, source_table: "payment_provider_connections" as const };
  }

  const { data: intConn } = await supabase
    .from("integration_connections")
    .select("id, org_id, access_token_encrypted, refresh_token_encrypted, token_expires_at, account_info")
    .eq("org_id", orgId)
    .eq("status", "connected")
    .maybeSingle();

  if (!intConn) return null;

  const realmId = intConn.account_info?.realm_id;
  if (!realmId) return null;

  return {
    id: intConn.id,
    org_id: intConn.org_id,
    realm_id: realmId,
    access_token_encrypted: intConn.access_token_encrypted,
    refresh_token_encrypted: intConn.refresh_token_encrypted,
    token_expiry: intConn.token_expires_at,
    source_table: "integration_connections" as const,
  };
}

class QBOTokenExpiredError extends Error {
  constructor() {
    super("QBO token expired and could not be refreshed. Please reconnect QuickBooks.");
    this.name = "QBOTokenExpiredError";
  }
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

  if (!qboClientId || !qboClientSecret) {
    throw new QBOTokenExpiredError();
  }

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
    throw new QBOTokenExpiredError();
  }

  const tokens = await tokenResponse.json();
  const newExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  const updatedAt = new Date().toISOString();

  await supabase
    .from("payment_provider_connections")
    .update({
      access_token_encrypted: tokens.access_token,
      refresh_token_encrypted: tokens.refresh_token,
      token_expiry: newExpiry,
      updated_at: updatedAt,
    })
    .eq("org_id", connection.org_id)
    .eq("provider", "quickbooks_online");

  await supabase
    .from("integration_connections")
    .update({
      access_token_encrypted: tokens.access_token,
      refresh_token_encrypted: tokens.refresh_token,
      token_expires_at: newExpiry,
    })
    .eq("org_id", connection.org_id)
    .eq("status", "connected")
    .filter("account_info->>realm_id", "eq", connection.realm_id);

  connection.access_token_encrypted = tokens.access_token;
  connection.refresh_token_encrypted = tokens.refresh_token;
  connection.token_expiry = newExpiry;

  return tokens.access_token;
}

async function qboRequest(
  accessToken: string,
  realmId: string,
  endpoint: string,
  method: string = "GET",
  body?: unknown
): Promise<unknown> {
  const separator = endpoint.includes("?") ? "&" : "?";
  const url = `${QBO_API_BASE}/${realmId}${endpoint}${separator}minorversion=65`;

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

async function listQBOItems(
  accessToken: string,
  realmId: string
): Promise<Array<{ Id: string; Name: string; Description?: string; UnitPrice?: number; Type: string; Active: boolean }>> {
  const allItems: Array<{ Id: string; Name: string; Description?: string; UnitPrice?: number; Type: string; Active: boolean }> = [];
  let startPosition = 1;
  const maxResults = 1000;

  while (true) {
    const query = `SELECT * FROM Item WHERE Active = true STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`;
    const response = await qboRequest(
      accessToken,
      realmId,
      `/query?query=${encodeURIComponent(query)}`
    ) as { QueryResponse: { Item?: Array<{ Id: string; Name: string; Description?: string; UnitPrice?: number; Type: string; Active: boolean }> } };

    const batch = response.QueryResponse.Item || [];
    allItems.push(...batch);

    if (batch.length < maxResults) break;
    startPosition += maxResults;
  }

  return allItems;
}

async function findOrCreateItem(
  accessToken: string,
  realmId: string,
  product: { name: string; description?: string; price_amount: number; billing_type: string }
): Promise<{ Id: string; SyncToken: string }> {
  const escapedName = product.name.replace(/'/g, "\\'");
  const queryResponse = await qboRequest(
    accessToken,
    realmId,
    `/query?query=${encodeURIComponent(`SELECT * FROM Item WHERE Name = '${escapedName}' MAXRESULTS 1`)}`
  ) as { QueryResponse: { Item?: Array<{ Id: string; SyncToken: string }> } };

  if (queryResponse.QueryResponse.Item?.length) {
    return queryResponse.QueryResponse.Item[0];
  }

  return createQBOItem(accessToken, realmId, product);
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

async function getQBOPayment(
  accessToken: string,
  realmId: string,
  paymentId: string
): Promise<{ Payment: unknown }> {
  const response = await qboRequest(
    accessToken,
    realmId,
    `/payment/${paymentId}`
  ) as { Payment: unknown };

  return { Payment: response.Payment };
}

interface QBOInvoiceResponse {
  Id: string;
  DocNumber: string;
  TxnDate: string;
  DueDate?: string;
  TotalAmt: number;
  Balance: number;
  CustomerRef?: { value: string; name?: string };
  CustomerMemo?: { value: string };
  PrivateNote?: string;
  InvoiceLink?: string;
  EmailStatus?: string;
  Line?: Array<{
    Id?: string;
    LineNum?: number;
    Description?: string;
    Amount: number;
    DetailType: string;
    SalesItemLineDetail?: {
      ItemRef?: { value: string; name?: string };
      Qty?: number;
      UnitPrice?: number;
    };
  }>;
  MetaData?: { CreateTime: string; LastUpdatedTime: string };
}

async function listAllQBOInvoices(
  accessToken: string,
  realmId: string
): Promise<QBOInvoiceResponse[]> {
  const allInvoices: QBOInvoiceResponse[] = [];
  let startPosition = 1;
  const maxResults = 1000;

  while (true) {
    const query = `SELECT * FROM Invoice STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`;
    const response = await qboRequest(
      accessToken,
      realmId,
      `/query?query=${encodeURIComponent(query)}`
    ) as { QueryResponse: { Invoice?: QBOInvoiceResponse[]; totalCount?: number } };

    const batch = response.QueryResponse.Invoice || [];
    allInvoices.push(...batch);

    if (batch.length < maxResults) break;
    startPosition += maxResults;
  }

  return allInvoices;
}

function mapQBOStatus(invoice: QBOInvoiceResponse): string {
  if (invoice.Balance === 0 && invoice.TotalAmt > 0) return "paid";
  if (invoice.DueDate) {
    const due = new Date(invoice.DueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (due < today && invoice.Balance > 0) return "overdue";
  }
  if (invoice.EmailStatus === "EmailSent") return "sent";
  return "draft";
}

async function syncInvoicesFromQBO(
  supabase: ReturnType<typeof createClient>,
  accessToken: string,
  realmId: string,
  orgId: string
): Promise<{ synced: number; updated: number; total: number }> {
  const qboInvoices = await listAllQBOInvoices(accessToken, realmId);
  let synced = 0;
  let updated = 0;

  for (const qboInv of qboInvoices) {
    const { data: existing } = await supabase
      .from("invoices")
      .select("id, status, contact_id, total")
      .eq("org_id", orgId)
      .eq("provider_invoice_id", qboInv.Id)
      .eq("provider", "quickbooks_online")
      .maybeSingle();

    const status = mapQBOStatus(qboInv);

    if (existing) {
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (existing.status !== status && existing.status !== "void") {
        updates.status = status;
        if (status === "paid") updates.paid_at = new Date().toISOString();
      }
      await supabase.from("invoices").update(updates).eq("id", existing.id);

      const amountPaidInQBO = qboInv.TotalAmt - qboInv.Balance;
      if (amountPaidInQBO > 0 && existing.contact_id) {
        const { data: existingPayments } = await supabase
          .from("payments")
          .select("amount")
          .eq("invoice_id", existing.id);

        const currentPaymentTotal = (existingPayments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
        const deficit = amountPaidInQBO - currentPaymentTotal;

        if (deficit > 0.005) {
          await supabase.from("payments").insert({
            org_id: orgId,
            contact_id: existing.contact_id,
            invoice_id: existing.id,
            amount: Math.round(deficit * 100) / 100,
            currency: "USD",
            payment_method: "other",
            received_at: qboInv.MetaData?.LastUpdatedTime || new Date().toISOString(),
          });
        }
      }

      updated++;
      continue;
    }

    let contactId: string | null = null;
    const customerName = qboInv.CustomerRef?.name;

    if (customerName) {
      const parts = customerName.split(" ");
      const firstName = parts[0] || "";
      const lastName = parts.slice(1).join(" ") || "";

      const { data: matchedContact } = await supabase
        .from("contacts")
        .select("id")
        .eq("organization_id", orgId)
        .or(`company.ilike.%${customerName}%,and(first_name.ilike.%${firstName}%,last_name.ilike.%${lastName}%)`)
        .limit(1)
        .maybeSingle();

      if (matchedContact) {
        contactId = matchedContact.id;
      }
    }

    if (!contactId) continue;

    const lineItems = (qboInv.Line || []).filter(
      (l) => l.DetailType === "SalesItemLineDetail"
    );
    const subtotal = lineItems.reduce((sum, l) => sum + l.Amount, 0);

    const { data: { user: systemUser } } = await supabase.auth.admin.listUsers();
    const firstUserId = systemUser?.[0]?.id;

    const { data: orgUser } = await supabase
      .from("users")
      .select("id")
      .eq("organization_id", orgId)
      .limit(1)
      .maybeSingle();

    const createdBy = orgUser?.id || firstUserId;
    if (!createdBy) continue;

    const { data: invoice, error: invError } = await supabase
      .from("invoices")
      .insert({
        org_id: orgId,
        contact_id: contactId,
        provider_invoice_id: qboInv.Id,
        provider: "quickbooks_online",
        doc_number: qboInv.DocNumber || `QBO-${qboInv.Id}`,
        status,
        subtotal,
        discount_amount: 0,
        discount_type: "flat",
        total: qboInv.TotalAmt,
        due_date: qboInv.DueDate || null,
        payment_link_url: qboInv.InvoiceLink || null,
        memo: qboInv.CustomerMemo?.value || null,
        internal_notes: qboInv.PrivateNote || null,
        sent_at: qboInv.EmailStatus === "EmailSent" ? (qboInv.MetaData?.LastUpdatedTime || new Date().toISOString()) : null,
        paid_at: status === "paid" ? new Date().toISOString() : null,
        created_by: createdBy,
        created_at: qboInv.MetaData?.CreateTime || new Date().toISOString(),
      })
      .select("id")
      .single();

    if (invError || !invoice) {
      console.error(`Failed to sync QBO invoice ${qboInv.Id}:`, invError);
      continue;
    }

    if (lineItems.length > 0) {
      const lineInserts = lineItems.map((line, index) => ({
        org_id: orgId,
        invoice_id: invoice.id,
        description: line.Description || line.SalesItemLineDetail?.ItemRef?.name || "Item",
        quantity: line.SalesItemLineDetail?.Qty || 1,
        unit_price: line.SalesItemLineDetail?.UnitPrice || line.Amount,
        total_price: line.Amount,
        sort_order: index,
      }));

      await supabase.from("invoice_line_items").insert(lineInserts);
    }

    const newInvAmountPaid = qboInv.TotalAmt - qboInv.Balance;
    if (newInvAmountPaid > 0.005 && contactId) {
      await supabase.from("payments").insert({
        org_id: orgId,
        contact_id: contactId,
        invoice_id: invoice.id,
        amount: Math.round(newInvAmountPaid * 100) / 100,
        currency: "USD",
        payment_method: "other",
        received_at: qboInv.MetaData?.LastUpdatedTime || new Date().toISOString(),
      });
    }

    synced++;
  }

  return { synced, updated, total: qboInvoices.length };
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

    const connection = await findConnection(supabase, userData.organization_id);

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

      case "find_or_create_item": {
        const { product: itemProduct } = body;
        result = await findOrCreateItem(accessToken, connection.realm_id, itemProduct);
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

      case "getPayment": {
        const { payment_id } = body;
        const paymentResult = await getQBOPayment(accessToken, connection.realm_id, payment_id);
        result = { payment: paymentResult.Payment };
        break;
      }

      case "sync_invoices": {
        result = await syncInvoicesFromQBO(
          supabase,
          accessToken,
          connection.realm_id,
          userData.organization_id
        );
        break;
      }

      case "list_items": {
        result = await listQBOItems(accessToken, connection.realm_id);
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    await supabase
      .from("payment_provider_connections")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("org_id", connection.org_id)
      .eq("provider", "quickbooks_online");

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("QBO API error:", error);
    if (error instanceof QBOTokenExpiredError) {
      return new Response(
        JSON.stringify({ error: "QBO_TOKEN_EXPIRED", message: error.message }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
