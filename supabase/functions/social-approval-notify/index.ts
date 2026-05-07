import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getDecryptedMailgunCreds, sendMailgunEmail } from "../_shared/mailgun.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface NotifyRequest {
  postId: string;
}

interface SocialPost {
  id: string;
  organization_id: string;
  body: string;
  scheduled_at_utc: string | null;
  approval_token: string;
  created_by: string;
  targets: string[];
}

interface UserInfo {
  id: string;
  email: string;
  full_name: string | null;
}

async function getAdminsWithApprovalPermission(
  supabase: ReturnType<typeof createClient>,
  orgId: string
): Promise<UserInfo[]> {
  const { data: rolePermissions } = await supabase
    .from("role_permissions")
    .select(`
      role_id,
      permissions!inner(key)
    `)
    .eq("permissions.key", "marketing.social.approve");

  if (!rolePermissions || rolePermissions.length === 0) {
    return [];
  }

  const roleIds = rolePermissions.map((rp) => rp.role_id);

  const { data: users } = await supabase
    .from("users")
    .select("id, email, full_name, role_id")
    .eq("org_id", orgId)
    .eq("status", "active")
    .in("role_id", roleIds);

  if (!users) {
    return [];
  }

  const { data: overrides } = await supabase
    .from("user_permission_overrides")
    .select("user_id, granted")
    .eq("permission_key", "marketing.social.approve")
    .in(
      "user_id",
      users.map((u) => u.id)
    );

  const overrideMap = new Map(overrides?.map((o) => [o.user_id, o.granted]) || []);

  return users.filter((user) => {
    const override = overrideMap.get(user.id);
    if (override !== undefined) {
      return override;
    }
    return true;
  });
}

function buildApprovalEmailHtml(
  post: SocialPost,
  creatorName: string,
  approvalUrl: string,
  orgName: string,
  targetNames: string[]
): string {
  const scheduledText = post.scheduled_at_utc
    ? `Scheduled for: ${new Date(post.scheduled_at_utc).toLocaleString()}`
    : "Immediate posting";

  const truncatedBody = post.body.length > 200 ? post.body.substring(0, 200) + "..." : post.body;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Social Post Approval Required</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="padding: 32px 40px; border-bottom: 1px solid #eee;">
              <h1 style="margin: 0; font-size: 24px; color: #1a1a1a; font-weight: 600;">
                Social Post Approval Required
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 40px;">
              <p style="margin: 0 0 20px; color: #4a4a4a; font-size: 15px; line-height: 1.6;">
                <strong>${creatorName}</strong> has submitted a social media post for your approval.
              </p>

              <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <p style="margin: 0 0 8px; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">
                  Post Content
                </p>
                <p style="margin: 0; color: #1a1a1a; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">
                  ${truncatedBody}
                </p>
              </div>

              <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
                    <span style="color: #6b7280; font-size: 14px;">Target Accounts</span>
                  </td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">
                    <span style="color: #1a1a1a; font-size: 14px;">${targetNames.join(", ") || "None selected"}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
                    <span style="color: #6b7280; font-size: 14px;">Schedule</span>
                  </td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">
                    <span style="color: #1a1a1a; font-size: 14px;">${scheduledText}</span>
                  </td>
                </tr>
              </table>

              <div style="text-align: center;">
                <a href="${approvalUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #3b82f6 0%, #0ea5e9 100%); color: white; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600;">
                  Review &amp; Approve Post
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px; background: #f8f9fa; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; color: #6b7280; font-size: 13px; text-align: center;">
                This email was sent by ${orgName}. You received this because you have approval permissions for social posts.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { postId }: NotifyRequest = await req.json();

    if (!postId) {
      return new Response(
        JSON.stringify({ success: false, error: "postId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: post, error: postError } = await supabase
      .from("social_posts")
      .select("id, organization_id, body, scheduled_at_utc, approval_token, created_by, targets")
      .eq("id", postId)
      .maybeSingle();

    if (postError || !post) {
      return new Response(
        JSON.stringify({ success: false, error: "Post not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!post.approval_token) {
      return new Response(
        JSON.stringify({ success: false, error: "Post does not require approval" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: org } = await supabase
      .from("organizations")
      .select("name, custom_domain")
      .eq("id", post.organization_id)
      .maybeSingle();

    const { data: creator } = await supabase
      .from("users")
      .select("full_name, email")
      .eq("id", post.created_by)
      .maybeSingle();

    const admins = await getAdminsWithApprovalPermission(supabase, post.organization_id);

    if (admins.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No users with approval permission found",
          notified: 0
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: accounts } = await supabase
      .from("social_accounts")
      .select("id, display_name")
      .in("id", post.targets || []);

    const targetNames = accounts?.map((a) => a.display_name) || [];

    const mgCreds = await getDecryptedMailgunCreds(post.organization_id, supabase, supabaseUrl, serviceRoleKey);

    if (!mgCreds) {
      await supabase.from("social_post_logs").insert({
        post_id: post.id,
        account_id: null,
        action: "approval_requested",
        details: {
          notified: 0,
          error: "Email provider not configured",
        },
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Email provider not configured",
          notified: 0
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: defaults } = await supabase
      .from("email_defaults")
      .select("default_from_address_id")
      .eq("org_id", post.organization_id)
      .maybeSingle();

    if (!defaults?.default_from_address_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No default from address configured",
          notified: 0
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: fromAddress } = await supabase
      .from("email_from_addresses")
      .select("email, display_name")
      .eq("id", defaults.default_from_address_id)
      .maybeSingle();

    if (!fromAddress) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "From address not found",
          notified: 0
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = org?.custom_domain || "https://os.autom8ionlab.com";
    const approvalUrl = `${baseUrl}/marketing/social/approve/${post.approval_token}`;
    const creatorName = creator?.full_name || creator?.email || "A team member";
    const orgName = org?.name || "Your Organization";

    const htmlBody = buildApprovalEmailHtml(post, creatorName, approvalUrl, orgName, targetNames);

    let notifiedCount = 0;
    const errors: string[] = [];

    for (const admin of admins) {
      const result = await sendMailgunEmail({
        apiKey: mgCreds.apiKey,
        domain: mgCreds.domain,
        region: mgCreds.region,
        from: `${fromAddress.display_name} <${fromAddress.email}>`,
        to: admin.email,
        toName: admin.full_name || undefined,
        subject: `[Action Required] Social Post Approval - ${orgName}`,
        html: htmlBody,
        trackOpens: true,
        trackClicks: false,
      });

      if (result.ok) {
        notifiedCount++;
      } else {
        errors.push(`${admin.email}: ${result.error || "Failed to send"}`);
      }
    }

    await supabase.from("social_post_logs").insert({
      post_id: post.id,
      account_id: null,
      action: "approval_requested",
      details: {
        notified: notifiedCount,
        total_admins: admins.length,
        errors: errors.length > 0 ? errors : undefined,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        notified: notifiedCount,
        total: admins.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
