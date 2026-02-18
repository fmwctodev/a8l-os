import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RecurringProfile {
  id: string;
  org_id: string;
  contact_id: string;
  qbo_recurring_template_id: string | null;
  name: string;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'annually';
  status: string;
  next_invoice_date: string;
  end_date: string | null;
  auto_send: boolean;
  created_by: string | null;
  contact: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    company: string | null;
  };
  items: {
    id: string;
    product_id: string | null;
    description: string;
    quantity: number;
    unit_price: number;
    product: {
      id: string;
      name: string;
      qbo_item_id: string | null;
    } | null;
  }[];
}

function calculateNextInvoiceDate(
  currentDate: string,
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'annually'
): string {
  const date = new Date(currentDate);

  switch (frequency) {
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'annually':
      date.setFullYear(date.getFullYear() + 1);
      break;
  }

  return date.toISOString().split('T')[0];
}

function calculateDueDate(invoiceDate: string, daysUntilDue = 30): string {
  const date = new Date(invoiceDate);
  date.setDate(date.getDate() + daysUntilDue);
  return date.toISOString().split('T')[0];
}

async function createQBOInvoiceIfConnected(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  profile: RecurringProfile,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<{ qbo_invoice_id?: string; doc_number?: string; payment_link_url?: string }> {
  const { data: qboConnection } = await supabase
    .from('qbo_connections')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle();

  if (!qboConnection) {
    const { data: intConn } = await supabase
      .from('integration_connections')
      .select('id, org_id, account_info')
      .eq('org_id', orgId)
      .eq('status', 'connected')
      .maybeSingle();

    if (!intConn || !intConn.account_info?.realm_id) {
      return {};
    }
  }

  try {
    const qboApiUrl = `${supabaseUrl}/functions/v1/qbo-api`;

    const customerResponse = await fetch(qboApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        action: 'findOrCreateCustomer',
        org_id: orgId,
        contact: {
          id: profile.contact.id,
          first_name: profile.contact.first_name,
          last_name: profile.contact.last_name,
          email: profile.contact.email,
          phone: profile.contact.phone,
          company: profile.contact.company,
        },
      }),
    });

    if (!customerResponse.ok) {
      console.error('Failed to find/create QBO customer');
      return {};
    }

    const { customer } = await customerResponse.json();

    const lineItems = profile.items.map(item => ({
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      qbo_item_id: item.product?.qbo_item_id || undefined,
    }));

    const dueDate = calculateDueDate(new Date().toISOString().split('T')[0]);

    const invoiceResponse = await fetch(qboApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        action: 'createInvoice',
        org_id: orgId,
        customer_id: customer.Id,
        line_items: lineItems,
        due_date: dueDate,
        memo: `Recurring invoice from: ${profile.name}`,
      }),
    });

    if (!invoiceResponse.ok) {
      console.error('Failed to create QBO invoice');
      return {};
    }

    const { invoice: qboInvoice } = await invoiceResponse.json();

    return {
      qbo_invoice_id: qboInvoice.Id,
      doc_number: qboInvoice.DocNumber,
      payment_link_url: qboInvoice.InvoiceLink || null,
    };
  } catch (error) {
    console.error('QBO integration error:', error);
    return {};
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().split('T')[0];

    const { data: dueProfiles, error: fetchError } = await supabase
      .from('recurring_profiles')
      .select(`
        id,
        org_id,
        contact_id,
        qbo_recurring_template_id,
        name,
        frequency,
        status,
        next_invoice_date,
        end_date,
        auto_send,
        created_by,
        contact:contacts!recurring_profiles_contact_id_fkey(
          id, first_name, last_name, email, phone, company
        )
      `)
      .eq('status', 'active')
      .lte('next_invoice_date', today)
      .order('next_invoice_date', { ascending: true })
      .limit(50);

    if (fetchError) {
      throw new Error(`Failed to fetch recurring profiles: ${fetchError.message}`);
    }

    if (!dueProfiles || dueProfiles.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No due profiles', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: Array<{
      profileId: string;
      status: string;
      invoiceId?: string;
      error?: string;
    }> = [];

    for (const profileData of dueProfiles) {
      try {
        const { data: items } = await supabase
          .from('recurring_profile_items')
          .select(`
            id,
            product_id,
            description,
            quantity,
            unit_price,
            product:products!recurring_profile_items_product_id_fkey(
              id, name, qbo_item_id
            )
          `)
          .eq('recurring_profile_id', profileData.id)
          .order('sort_order');

        const profile: RecurringProfile = {
          ...profileData,
          contact: profileData.contact as RecurringProfile['contact'],
          items: (items || []) as RecurringProfile['items'],
        };

        if (profile.end_date && new Date(profile.end_date) < new Date(today)) {
          await supabase
            .from('recurring_profiles')
            .update({
              status: 'cancelled',
              next_invoice_date: null,
            })
            .eq('id', profile.id);

          results.push({
            profileId: profile.id,
            status: 'cancelled',
            error: 'End date reached',
          });
          continue;
        }

        let subtotal = 0;
        const lineItemsWithTotal = profile.items.map(item => {
          const total = item.quantity * item.unit_price;
          subtotal += total;
          return {
            org_id: profile.org_id,
            product_id: item.product_id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: total,
          };
        });

        const qboResult = await createQBOInvoiceIfConnected(
          supabase,
          profile.org_id,
          profile,
          supabaseUrl,
          supabaseServiceKey
        );

        let docNumber = qboResult.doc_number;
        if (!docNumber) {
          const { count } = await supabase
            .from('invoices')
            .select('*', { count: 'exact', head: true })
            .eq('org_id', profile.org_id);

          docNumber = `INV-${String((count || 0) + 1).padStart(5, '0')}`;
        }

        const dueDate = calculateDueDate(today);

        const { data: invoice, error: invoiceError } = await supabase
          .from('invoices')
          .insert({
            org_id: profile.org_id,
            contact_id: profile.contact_id,
            qbo_invoice_id: qboResult.qbo_invoice_id || null,
            doc_number: docNumber,
            status: profile.auto_send ? 'sent' : 'draft',
            subtotal,
            discount_amount: 0,
            discount_type: 'flat',
            total: subtotal,
            due_date: dueDate,
            payment_link_url: qboResult.payment_link_url || null,
            memo: `Generated from recurring profile: ${profile.name}`,
            sent_at: profile.auto_send ? new Date().toISOString() : null,
            created_by: profile.created_by,
          })
          .select()
          .single();

        if (invoiceError) {
          throw new Error(`Failed to create invoice: ${invoiceError.message}`);
        }

        const lineItemInserts = lineItemsWithTotal.map((item, index) => ({
          ...item,
          invoice_id: invoice.id,
          sort_order: index,
        }));

        const { error: lineItemError } = await supabase
          .from('invoice_line_items')
          .insert(lineItemInserts);

        if (lineItemError) {
          console.error('Failed to create line items:', lineItemError);
        }

        await supabase.from('event_outbox').insert({
          organization_id: profile.org_id,
          event_type: 'invoice_created',
          contact_id: profile.contact_id,
          entity_type: 'invoice',
          entity_id: invoice.id,
          payload: {
            invoice_id: invoice.id,
            contact_id: profile.contact_id,
            total: subtotal,
            doc_number: docNumber,
            recurring_profile_id: profile.id,
            auto_generated: true,
          },
        });

        if (profile.auto_send && profile.contact.email && qboResult.qbo_invoice_id) {
          try {
            const sendResponse = await fetch(`${supabaseUrl}/functions/v1/qbo-api`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                action: 'sendInvoice',
                org_id: profile.org_id,
                invoice_id: qboResult.qbo_invoice_id,
                email: profile.contact.email,
              }),
            });

            if (sendResponse.ok) {
              const { invoice: sentInvoice } = await sendResponse.json();
              if (sentInvoice?.InvoiceLink) {
                await supabase
                  .from('invoices')
                  .update({ payment_link_url: sentInvoice.InvoiceLink })
                  .eq('id', invoice.id);
              }

              await supabase.from('event_outbox').insert({
                organization_id: profile.org_id,
                event_type: 'invoice_sent',
                contact_id: profile.contact_id,
                entity_type: 'invoice',
                entity_id: invoice.id,
                payload: {
                  invoice_id: invoice.id,
                  contact_id: profile.contact_id,
                  email: profile.contact.email,
                  recurring_profile_id: profile.id,
                },
              });
            }
          } catch (sendError) {
            console.error('Failed to send invoice:', sendError);
          }
        }

        const nextInvoiceDate = calculateNextInvoiceDate(
          profile.next_invoice_date,
          profile.frequency
        );

        let newStatus = 'active';
        let finalNextDate: string | null = nextInvoiceDate;

        if (profile.end_date && new Date(nextInvoiceDate) > new Date(profile.end_date)) {
          newStatus = 'cancelled';
          finalNextDate = null;
        }

        await supabase
          .from('recurring_profiles')
          .update({
            status: newStatus,
            next_invoice_date: finalNextDate,
            updated_at: new Date().toISOString(),
          })
          .eq('id', profile.id);

        results.push({
          profileId: profile.id,
          status: 'success',
          invoiceId: invoice.id,
        });
      } catch (error) {
        console.error(`Error processing profile ${profileData.id}:`, error);
        results.push({
          profileId: profileData.id,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    return new Response(
      JSON.stringify({
        processed: results.length,
        success: successCount,
        errors: errorCount,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Recurring invoice generator error:', error);

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
