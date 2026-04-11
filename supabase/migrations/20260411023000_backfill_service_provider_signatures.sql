/*
  # Backfill service provider signature on existing contracts

  Rewrites every `contract_sections` row with `section_type = 'signatures'`
  to the deterministic pre-signed-by-service-provider template. This matches
  the new HTML produced by the `contract-ai-generate` edge function so all
  contracts — new and existing — show the same signature block.

  Safety:
  - Only touches rows with `section_type = 'signatures'`. All other sections
    are untouched.
  - Skips contracts already in `signature_status = 'signed'` so legally
    executed contracts keep their exact-at-signing content.
  - Uses a TEMPORARY SQL helper function that is dropped at the end, so the
    schema is unchanged after this migration runs.

  The HTML template mirrors `buildServiceProviderSignaturesHtml()` in
  `supabase/functions/contract-ai-generate/index.ts` so both code paths
  render the same output.

  Note: we use string concatenation (`||`) instead of `format()` because
  the HTML contains literal `%` characters (e.g. `width:100%`) that would
  otherwise be interpreted as format specifiers.
*/

CREATE OR REPLACE FUNCTION _tmp_service_provider_sig_html(
  p_client_name text,
  p_created_at timestamptz
) RETURNS text AS $func$
  SELECT
    $html$<p><strong>IN WITNESS WHEREOF,</strong> the parties have executed this Agreement as of the Effective Date written below.</p><table style="width:100%;border-collapse:collapse;margin-top:24px;"><thead><tr><th style="text-align:left;padding:12px;border-bottom:1px solid #334155;text-transform:uppercase;font-size:11px;letter-spacing:0.5px;color:#94a3b8;">Service Provider</th><th style="text-align:left;padding:12px;border-bottom:1px solid #334155;text-transform:uppercase;font-size:11px;letter-spacing:0.5px;color:#94a3b8;">Client</th></tr></thead><tbody><tr><td style="vertical-align:top;padding:16px 12px;width:50%;"><strong>Sitehues Media Inc. DBA: Autom8ion Lab</strong></td><td style="vertical-align:top;padding:16px 12px;width:50%;"><strong>$html$
    || COALESCE(p_client_name, '')
    || $html$</strong></td></tr><tr><td style="vertical-align:top;padding:16px 12px;width:50%;"><p style="font-family:'Brush Script MT','Lucida Handwriting','Segoe Script',cursive;font-size:32px;margin:0 0 4px 0;color:#22d3ee;">Sean Scott Richard</p><p style="border-top:1px solid #475569;margin:0;padding-top:4px;font-size:11px;color:#64748b;">Signature</p></td><td style="vertical-align:top;padding:16px 12px;width:50%;"><p style="margin:0 0 4px 0;height:40px;">&nbsp;</p><p style="border-top:1px solid #475569;margin:0;padding-top:4px;font-size:11px;color:#64748b;">Signature</p></td></tr><tr><td style="vertical-align:top;padding:16px 12px;width:50%;"><p style="margin:0 0 4px 0;">Sean Scott Richard</p><p style="border-top:1px solid #475569;margin:0;padding-top:4px;font-size:11px;color:#64748b;">Print Name</p></td><td style="vertical-align:top;padding:16px 12px;width:50%;"><p style="margin:0 0 4px 0;height:20px;">&nbsp;</p><p style="border-top:1px solid #475569;margin:0;padding-top:4px;font-size:11px;color:#64748b;">Print Name</p></td></tr><tr><td style="vertical-align:top;padding:16px 12px;width:50%;"><p style="margin:0 0 4px 0;">$html$
    || to_char(p_created_at, 'FMMonth FMDD, YYYY')
    || $html$</p><p style="border-top:1px solid #475569;margin:0;padding-top:4px;font-size:11px;color:#64748b;">Date</p></td><td style="vertical-align:top;padding:16px 12px;width:50%;"><p style="margin:0 0 4px 0;height:20px;">&nbsp;</p><p style="border-top:1px solid #475569;margin:0;padding-top:4px;font-size:11px;color:#64748b;">Date</p></td></tr></tbody></table><p style="margin-top:24px;font-style:italic;color:#64748b;font-size:13px;">This agreement becomes effective on the date last signed by both parties.</p>$html$;
$func$ LANGUAGE sql IMMUTABLE;

UPDATE contract_sections cs
SET
  content = _tmp_service_provider_sig_html(c.party_b_name, c.created_at),
  ai_generated = false,
  annotation = 'The Service Provider has pre-signed. The contract becomes binding once the Client signs and dates it.'
FROM contracts c
WHERE cs.contract_id = c.id
  AND cs.section_type = 'signatures'
  AND (c.signature_status IS NULL OR c.signature_status <> 'signed');

DROP FUNCTION IF EXISTS _tmp_service_provider_sig_html(text, timestamptz);
