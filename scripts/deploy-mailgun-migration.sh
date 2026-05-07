#!/usr/bin/env bash
# Deploy the remaining Mailgun-migration Edge Functions to production.
#
# Prerequisites:
#   - supabase CLI: https://supabase.com/docs/guides/cli
#   - Supabase access token: export SUPABASE_ACCESS_TOKEN=<token from
#     https://supabase.com/dashboard/account/tokens>
#
# Usage:
#   export SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxxxx
#   bash scripts/deploy-mailgun-migration.sh

set -euo pipefail

PROJECT_REF="uscpncgnkmjirbrpidgu"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Already deployed by Claude via Supabase MCP:
#   email-send (v84), email-mailgun-provider (v1)
#
# To redeploy these, append them to the appropriate array below.

# Functions that should NOT verify JWT (public/service-role/webhook):
NO_JWT=(
  mailgun-webhook
  booking-email
  vapi-webhook
  client-portal-auth
  portal-auth
  approval-reminder-cron
  signature-reminder-scheduler
  workflow-processor
  report-email-sender
)

# Functions that SHOULD verify JWT (admin/user-facing):
WITH_JWT=(
  email-mailgun-domains
  email-mailgun-senders
  email-mailgun-suppressions
  email-warmup-sync
  email-campaign-domains
  review-negative-alert
  change-request-notify
  support-ticket-notify
  social-approval-notify
  integrations-connect
)

echo "==> Deploying ${#NO_JWT[@]} no-jwt functions..."
for fn in "${NO_JWT[@]}"; do
  echo "  - $fn"
  npx --yes supabase@latest functions deploy "$fn" \
    --project-ref "$PROJECT_REF" \
    --no-verify-jwt
done

echo ""
echo "==> Deploying ${#WITH_JWT[@]} with-jwt functions..."
for fn in "${WITH_JWT[@]}"; do
  echo "  - $fn"
  npx --yes supabase@latest functions deploy "$fn" \
    --project-ref "$PROJECT_REF"
done

echo ""
echo "==> Done. Verify with:"
echo "    npx supabase functions list --project-ref $PROJECT_REF"

echo ""
echo "==> Next steps:"
echo "  1. Connect Mailgun in the UI: /settings/email-services"
echo "  2. Register Mailgun webhook at:"
echo "     https://${PROJECT_REF}.supabase.co/functions/v1/mailgun-webhook"
echo "  3. Delete legacy SendGrid functions:"
echo "     for fn in email-sendgrid-provider email-sendgrid-domains email-sendgrid-senders email-sendgrid-unsubscribe; do"
echo "       npx supabase functions delete \$fn --project-ref $PROJECT_REF"
echo "     done"
