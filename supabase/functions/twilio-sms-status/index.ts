import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const STATUS_MAP: Record<string, string> = {
  'queued': 'pending',
  'sending': 'pending',
  'sent': 'sent',
  'delivered': 'delivered',
  'undelivered': 'failed',
  'failed': 'failed',
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing environment variables");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const formData = await req.formData();
    const messageSid = formData.get("MessageSid") as string;
    const messageStatus = formData.get("MessageStatus") as string;
    const errorCode = formData.get("ErrorCode") as string | null;
    const errorMessage = formData.get("ErrorMessage") as string | null;

    if (!messageSid || !messageStatus) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const mappedStatus = STATUS_MAP[messageStatus.toLowerCase()] || messageStatus;

    const { data: message, error: findError } = await supabase
      .from("messages")
      .select("id, metadata")
      .eq("external_id", messageSid)
      .maybeSingle();

    if (findError) {
      console.error("Error finding message:", findError);
      throw findError;
    }

    if (!message) {
      console.log("Message not found for SID:", messageSid);
      return new Response(
        JSON.stringify({ status: "ok", message: "Message not found" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const updateData: Record<string, unknown> = {
      status: mappedStatus,
    };

    if (errorCode || errorMessage) {
      updateData.metadata = {
        ...(message.metadata || {}),
        error_code: errorCode,
        error_message: errorMessage,
      };
    }

    const { error: updateError } = await supabase
      .from("messages")
      .update(updateData)
      .eq("id", message.id);

    if (updateError) {
      console.error("Error updating message:", updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({ status: "ok" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Twilio status webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
