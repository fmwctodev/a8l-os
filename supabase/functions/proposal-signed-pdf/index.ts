import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResp(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errResp(code: string, message: string, status = 400): Response {
  return jsonResp({ success: false, error: { code, message } }, status);
}

async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function buildSignedProposalHTML(
  frozenHtml: string,
  signature: {
    signer_name: string;
    signer_email: string;
    signature_type: string;
    signature_text?: string;
    signature_image_url?: string;
    signed_at: string;
    ip_address?: string;
    consent_text: string;
    document_hash: string;
  }
): string {
  const signedDate = new Date(signature.signed_at).toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  const signatureDisplay =
    signature.signature_type === "drawn" && signature.signature_image_url
      ? `<img src="${signature.signature_image_url}" alt="Signature" style="max-height:80px;max-width:300px;" />`
      : `<span style="font-family:Georgia,serif;font-size:32px;font-style:italic;color:#f1f5f9;">${signature.signature_text || signature.signer_name}</span>`;

  const signedBadgeHtml = `
    <div style="background:#064e3b;border:2px solid #059669;border-radius:12px;padding:24px 28px;margin:20px 0;page-break-inside:avoid;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <span style="font-size:18px;font-weight:700;color:#34d399;letter-spacing:0.5px;">ELECTRONICALLY SIGNED</span>
      </div>
      <div style="border-bottom:2px solid #065f46;padding-bottom:16px;margin-bottom:16px;">
        ${signatureDisplay}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div>
          <div style="font-size:10px;font-weight:600;letter-spacing:0.8px;color:#6ee7b7;text-transform:uppercase;margin-bottom:2px;">SIGNER</div>
          <div style="font-size:14px;color:#d1fae5;">${signature.signer_name}</div>
        </div>
        <div>
          <div style="font-size:10px;font-weight:600;letter-spacing:0.8px;color:#6ee7b7;text-transform:uppercase;margin-bottom:2px;">EMAIL</div>
          <div style="font-size:14px;color:#d1fae5;">${signature.signer_email}</div>
        </div>
        <div>
          <div style="font-size:10px;font-weight:600;letter-spacing:0.8px;color:#6ee7b7;text-transform:uppercase;margin-bottom:2px;">SIGNED ON</div>
          <div style="font-size:14px;color:#d1fae5;">${signedDate}</div>
        </div>
        <div>
          <div style="font-size:10px;font-weight:600;letter-spacing:0.8px;color:#6ee7b7;text-transform:uppercase;margin-bottom:2px;">IP ADDRESS</div>
          <div style="font-size:14px;color:#d1fae5;">${signature.ip_address || "N/A"}</div>
        </div>
      </div>
      <div style="margin-top:16px;padding-top:12px;border-top:1px solid #065f46;">
        <div style="font-size:10px;font-weight:600;letter-spacing:0.8px;color:#6ee7b7;text-transform:uppercase;margin-bottom:4px;">DOCUMENT HASH (SHA-256)</div>
        <div style="font-size:11px;color:#a7f3d0;font-family:monospace;word-break:break-all;">${signature.document_hash}</div>
      </div>
      <div style="margin-top:12px;font-size:11px;color:#6ee7b7;font-style:italic;">
        ${signature.consent_text}
      </div>
    </div>
  `;

  const insertPoint = frozenHtml.lastIndexOf("</body>");
  if (insertPoint === -1) {
    return frozenHtml + signedBadgeHtml;
  }

  return (
    frozenHtml.slice(0, insertPoint) +
    `<div class="page" style="padding:40px 50px 60px;page-break-before:always;">${signedBadgeHtml}</div>` +
    frozenHtml.slice(insertPoint)
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = getServiceClient();

    const { proposalId, signatureRequestId } = await req.json();

    if (!proposalId || !signatureRequestId) {
      return errResp(
        "MISSING_PARAMS",
        "proposalId and signatureRequestId are required"
      );
    }

    const { data: proposal, error: proposalError } = await supabase
      .from("proposals")
      .select("id, org_id, title, frozen_html_snapshot, frozen_document_hash, signature_status")
      .eq("id", proposalId)
      .maybeSingle();

    if (proposalError || !proposal) {
      return errResp("PROPOSAL_NOT_FOUND", "Proposal not found", 404);
    }

    if (proposal.signature_status !== "signed") {
      return errResp(
        "NOT_SIGNED",
        "Proposal has not been signed yet"
      );
    }

    if (!proposal.frozen_html_snapshot) {
      return errResp(
        "NO_SNAPSHOT",
        "Proposal does not have a frozen snapshot"
      );
    }

    const { data: signature, error: sigError } = await supabase
      .from("proposal_signatures")
      .select("*")
      .eq("signature_request_id", signatureRequestId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sigError || !signature) {
      return errResp("SIGNATURE_NOT_FOUND", "Signature not found", 404);
    }

    const signedHtml = buildSignedProposalHTML(
      proposal.frozen_html_snapshot,
      {
        signer_name: signature.signer_name,
        signer_email: signature.signer_email,
        signature_type: signature.signature_type,
        signature_text: signature.signature_text,
        signature_image_url: signature.signature_image_url,
        signed_at: signature.created_at,
        ip_address: signature.ip_address,
        consent_text: signature.consent_text,
        document_hash: signature.document_hash,
      }
    );

    const fileName = `${proposal.org_id}/${proposalId}/signed-proposal.html`;

    const htmlBlob = new Blob([signedHtml], { type: "text/html" });
    const { error: uploadError } = await supabase.storage
      .from("proposal-signatures")
      .upload(fileName, htmlBlob, {
        contentType: "text/html",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return errResp("UPLOAD_FAILED", "Failed to upload signed document");
    }

    const { data: urlData } = supabase.storage
      .from("proposal-signatures")
      .getPublicUrl(fileName);

    await supabase
      .from("proposals")
      .update({ final_signed_pdf_url: urlData.publicUrl })
      .eq("id", proposalId);

    await supabase.from("proposal_audit_events").insert({
      org_id: proposal.org_id,
      proposal_id: proposalId,
      event_type: "signed_document_generated",
      actor_type: "system",
      metadata: {
        file_url: urlData.publicUrl,
        document_hash: proposal.frozen_document_hash,
      },
    });

    return jsonResp({
      success: true,
      data: {
        url: urlData.publicUrl,
        documentHash: proposal.frozen_document_hash,
      },
    });
  } catch (err) {
    console.error("proposal-signed-pdf error:", err);
    return errResp(
      "INTERNAL_ERROR",
      err instanceof Error ? err.message : "Internal server error",
      500
    );
  }
});
