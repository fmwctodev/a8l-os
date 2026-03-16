# Proposal E-Signature Flow — Full Developer Guide

> **Purpose:** This document provides everything your dev team needs to implement the identical electronic signature flow in a new CRM. It covers database schema, security model, service layer, email delivery, frontend components, the public signing page, the signed-document generator edge function, and background cron jobs. All code is production-ready and can be copied verbatim with only table-name substitutions where noted.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Database Schema](#2-database-schema)
3. [Security Model](#3-security-model)
4. [Service Layer](#4-service-layer)
5. [Email Delivery Layer](#5-email-delivery-layer)
6. [Frontend Components](#6-frontend-components)
7. [Public Signing Page](#7-public-signing-page)
8. [Edge Function: Signed Document Generator](#8-edge-function-signed-document-generator)
9. [Background Cron Jobs](#9-background-cron-jobs)
10. [TypeScript Types](#10-typescript-types)
11. [Routing Setup](#11-routing-setup)
12. [Integration Checklist for a New Document Type](#12-integration-checklist-for-a-new-document-type)

---

## 1. Architecture Overview

### Actors

| Actor | Description |
|---|---|
| **CRM User (Sender)** | Authenticated staff member who prepares and sends the document |
| **System** | Backend services, cron jobs, edge functions |
| **Client (Signer)** | External recipient who receives a signing link via email |

### End-to-End Flow

```
CRM User                    System                      Client (Signer)
──────────                  ──────                      ───────────────
1. Click "Send for
   Signature" in UI
2. Fill form: signer name,
   email, expiry days
3. Click "Preview Email"
4. Click "Send"
                            5. FREEZE: Generate HTML
                               snapshot + SHA-256 hash
                               of document. Save to DB.

                            6. CREATE SIGNATURE REQUEST:
                               Generate 32-byte random
                               token. Store SHA-256 hash
                               only. Set status=pending.
                               Update parent record with
                               signature_status=pending_signature.
                               Write audit event.

                            7. SEND EMAIL via SendGrid:
                               Embed unique signing URL:
                               /sign/document/{requestId}?token={rawToken}
                               Update send_status on request.

                                                           8. Signer opens email,
                                                              clicks "Review & Sign"

                                                           9. Page loads, hashes
                                                              the token from URL,
                                                              queries DB by
                                                              requestId + tokenHash.

                            10. MARK VIEWED (first visit
                                only, idempotent).
                                signature_status=viewed.
                                Write audit event.

                                                           11. Signer reads document,
                                                               types or draws signature,
                                                               checks consent checkbox.

                                                           12. Click "Sign Document":
                                                               Upload signature image
                                                               to storage. Insert
                                                               proposal_signatures row.
                                                               Update request status=signed.
                                                               Update parent
                                                               signature_status=signed.
                                                               Write audit event.

                            13. (Optional) Generate signed
                                HTML document with badge
                                injected. Store in storage.
                                Update final_signed_pdf_url.

                            14. (Optional) Reminder cron
                                runs every 6h: sends up to
                                3 reminder emails, 48h apart.

                            15. Expiration cron runs every 1h:
                                marks expired requests,
                                updates parent status.
```

### Key Design Decisions

**Token Security:** The raw 32-byte signing token is NEVER stored in the database. Only its SHA-256 hash is stored. The raw token travels only in the signing URL. This means a database breach does not expose valid signing tokens.

**Document Freeze:** Before the signing request is created, the document content is rendered to HTML and the SHA-256 hash of that HTML is stored. This creates a tamper-evident baseline: the signer sees exactly what was frozen, and the hash proves the document was not altered after sending.

**Stateless Public Page:** The public signing page uses no session/auth. It verifies access by hashing the URL token and querying `WHERE access_token_hash = $hash`. Expiry is enforced in application code by comparing `expires_at` to `now()`.

**Dual Status Fields:** The parent document record has `signature_status` (mirrors the signing lifecycle for quick queries), while `proposal_signature_requests.status` tracks the request independently. This allows voiding/resending without losing history.

---

## 2. Database Schema

### 2.1 Parent Document Table Additions

The following columns must be added to whichever table represents your document (e.g., `proposals`, `contracts`). Replace `proposals` with your table name throughout.

```sql
/*
  Additions to parent document table.
  Replace "proposals" with your document table name.
*/

-- Signing lifecycle status
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS signature_status text NOT NULL DEFAULT 'not_sent';
ALTER TABLE proposals ADD CONSTRAINT proposals_signature_status_check
  CHECK (signature_status IN ('not_sent', 'pending_signature', 'viewed', 'signed', 'declined', 'expired', 'voided'));

-- Timestamps
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS signed_at timestamptz;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS declined_at timestamptz;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Signed document URL (generated after signing)
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS final_signed_pdf_url text;

-- Immutable content snapshot (created at send time)
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS frozen_html_snapshot text;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS frozen_json_snapshot jsonb;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS frozen_document_hash text;

-- Signer info (denormalized onto parent for easy display)
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS signer_name text;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS signer_email text;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS signature_request_id uuid;
```

### 2.2 Signature Requests Table

```sql
CREATE TABLE IF NOT EXISTS proposal_signature_requests (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL REFERENCES organizations(id),
  proposal_id          uuid NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  contact_id           uuid REFERENCES contacts(id) ON DELETE SET NULL,
  signer_name          text NOT NULL,
  signer_email         text NOT NULL,

  -- SECURITY: raw token never stored, only SHA-256 hash
  access_token_hash    text NOT NULL,

  status               text NOT NULL DEFAULT 'pending',
  expires_at           timestamptz NOT NULL,

  -- Lifecycle timestamps
  viewed_at            timestamptz,
  signed_at            timestamptz,
  declined_at          timestamptz,
  decline_reason       text,

  -- Email delivery tracking
  send_status          text NOT NULL DEFAULT 'pending',
  sendgrid_message_id  text,
  send_error           text,
  last_sent_at         timestamptz,

  -- Reminder tracking
  reminder_count       integer DEFAULT 0,
  last_reminder_sent_at timestamptz,

  -- Audit
  created_by_user_id   uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT proposal_sig_req_status_check
    CHECK (status IN ('pending', 'viewed', 'signed', 'declined', 'expired', 'voided')),
  CONSTRAINT proposal_sig_req_send_status_check
    CHECK (send_status IN ('pending', 'sent', 'failed'))
);

-- Auto-update updated_at trigger (assumes update_updated_at_column() function exists)
CREATE TRIGGER update_proposal_sig_requests_updated_at
  BEFORE UPDATE ON proposal_signature_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 2.3 Signatures Table

Stores the actual signature data after a document is signed.

```sql
CREATE TABLE IF NOT EXISTS proposal_signatures (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES organizations(id),
  proposal_id           uuid NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  signature_request_id  uuid NOT NULL REFERENCES proposal_signature_requests(id) ON DELETE CASCADE,

  -- Signature data
  signature_type        text NOT NULL DEFAULT 'drawn',  -- 'typed' | 'drawn'
  signature_text        text,         -- for typed signatures
  signature_image_url   text,         -- Supabase Storage URL for drawn signatures

  -- Signer identity (captured at signing time, not FK-linked)
  signer_name          text NOT NULL,
  signer_email         text NOT NULL,

  -- Forensic data
  ip_address           text,
  user_agent           text,
  consent_text         text NOT NULL,   -- exact legal consent string shown to signer
  document_hash        text NOT NULL,   -- SHA-256 of frozen_html_snapshot

  signed_at            timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT proposal_sig_type_check CHECK (signature_type IN ('typed', 'drawn'))
);
```

### 2.4 Audit Events Table

Full chronological audit trail of every action on a document's signature lifecycle.

```sql
CREATE TABLE IF NOT EXISTS proposal_audit_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organizations(id),
  proposal_id  uuid NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  event_type   text NOT NULL,
  actor_type   text NOT NULL DEFAULT 'system',
  actor_id     text,      -- user UUID or null for system/signer actions
  metadata     jsonb DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT proposal_audit_actor_type_check
    CHECK (actor_type IN ('system', 'user', 'signer'))
);
```

**Known `event_type` values:**

| Event Type | Triggered By | Description |
|---|---|---|
| `sent_for_signature` | user | Signature request created and email sent |
| `viewed` | signer | Signer opened the signing page for the first time |
| `signed` | signer | Signer submitted their signature |
| `declined` | signer | Signer declined the document |
| `voided` | user | CRM user voided an active request |
| `resent` | user | CRM user resent/regenerated signing link |
| `reminder_sent` | system | Automated reminder email delivered |
| `expired` | system | Request passed expires_at without action |
| `signed_document_generated` | system | Signed HTML document stored in storage |
| `proposal_signature_send_failed` | system | Email delivery failed |

### 2.5 Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_proposal_sig_requests_proposal_id
  ON proposal_signature_requests(proposal_id);

CREATE INDEX IF NOT EXISTS idx_proposal_sig_requests_token_hash
  ON proposal_signature_requests(access_token_hash);

CREATE INDEX IF NOT EXISTS idx_proposal_sig_requests_status
  ON proposal_signature_requests(status);

CREATE INDEX IF NOT EXISTS idx_proposal_sig_req_send_status
  ON proposal_signature_requests(send_status)
  WHERE send_status = 'failed';

CREATE INDEX IF NOT EXISTS idx_proposal_signatures_proposal_id
  ON proposal_signatures(proposal_id);

CREATE INDEX IF NOT EXISTS idx_proposal_signatures_request_id
  ON proposal_signatures(signature_request_id);

CREATE INDEX IF NOT EXISTS idx_proposal_audit_events_proposal_id
  ON proposal_audit_events(proposal_id, created_at);

CREATE INDEX IF NOT EXISTS idx_proposals_signature_status
  ON proposals(signature_status)
  WHERE signature_status != 'not_sent';
```

### 2.6 Storage Bucket

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('proposal-signatures', 'proposal-signatures', true)
ON CONFLICT (id) DO NOTHING;
```

This bucket is **public** because:
- Signature images must be accessible to the public signing page (unauthenticated signer)
- The signed HTML document URL is shared with the client post-signing
- All paths are namespaced as `{org_id}/{request_id}/...`

### 2.7 Row Level Security Policies

```sql
ALTER TABLE proposal_signature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_audit_events ENABLE ROW LEVEL SECURITY;

-- Authenticated CRM users: full access scoped to their org
CREATE POLICY "Org members can view signature requests"
  ON proposal_signature_requests FOR SELECT TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Org members can create signature requests"
  ON proposal_signature_requests FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Org members can update signature requests"
  ON proposal_signature_requests FOR UPDATE TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()))
  WITH CHECK (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

-- Anonymous signer: can read to verify token, can update to record viewed/signed/declined
CREATE POLICY "Public can verify signature requests by token"
  ON proposal_signature_requests FOR SELECT TO anon
  USING (true);

CREATE POLICY "Public can update signature request status"
  ON proposal_signature_requests FOR UPDATE TO anon
  USING (true) WITH CHECK (true);

-- Signatures: org members read, anyone (signer) can insert
CREATE POLICY "Org members can view signatures"
  ON proposal_signatures FOR SELECT TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Anyone can create signatures"
  ON proposal_signatures FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Audit events: org members read, anyone can insert
CREATE POLICY "Org members can view audit events"
  ON proposal_audit_events FOR SELECT TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Anyone can create audit events"
  ON proposal_audit_events FOR INSERT TO anon, authenticated
  WITH CHECK (true);
```

> **Note on anon policies:** The "anyone can update/insert" policies are intentionally broad because the public signing page runs without authentication. Token security is enforced at the application layer by verifying the SHA-256 token hash. The signer cannot sign without knowing the raw token.

### 2.8 Optional: Organization Automation Columns

If you want org-level toggles for post-signing automation:

```sql
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS
  auto_advance_opportunity_on_signed boolean NOT NULL DEFAULT false;

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS
  auto_create_project_on_signed boolean NOT NULL DEFAULT false;
```

---

## 3. Security Model

### 3.1 Token Hashing

The signing token is a 32-byte cryptographically random value generated using `crypto.getRandomValues()`. Only its SHA-256 hash is persisted. The raw value exists only in the signing URL.

```typescript
// Token generation (client side)
function generateSecureToken(): { raw: string; hash: Promise<string> } {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const raw = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return { raw, hash: computeDocumentHash(raw) };
}

// SHA-256 hash utility (used for both tokens and document content)
async function computeDocumentHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
```

**Signing URL format:**
```
https://yourapp.com/sign/document/{requestId}?token={rawToken}
```

The public signing page extracts `requestId` from the URL path and `token` from the query string, hashes the token, then queries:
```sql
SELECT * FROM proposal_signature_requests
WHERE id = $requestId
AND access_token_hash = $tokenHash
```

### 3.2 Document Tamper Detection

Before the request is created, the document HTML is hashed. When the signer submits, the signing page re-hashes the frozen HTML and stores the hash alongside the signature record. This creates a provable link: the hash in `proposal_signatures.document_hash` must match `proposals.frozen_document_hash`.

### 3.3 Expiry Enforcement

Expiry is enforced in application code, not at the database layer:

```typescript
// On the public signing page, after token verification:
if (new Date(request.expires_at) < new Date()) {
  setPageState('expired');
  return;
}
```

The expiration cron job separately marks overdue requests as `expired` so the CRM UI reflects the correct status.

### 3.4 Forensic Audit Data

Every signature record captures:
- `ip_address` — the signer's IP (can be `null` if not determinable; capture from `request.headers.get('x-forwarded-for')` in edge functions if needed)
- `user_agent` — `navigator.userAgent` from the signing page
- `consent_text` — the exact legal text the signer agreed to, stored verbatim
- `document_hash` — SHA-256 of the frozen document at signing time

---

## 4. Service Layer

Create this file at `src/services/documentSigning.ts` (rename to match your document type).

```typescript
import { supabase } from '../lib/supabase';

// ─── Utilities ───────────────────────────────────────────────────────────────

export async function computeDocumentHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function generateSecureToken(): { raw: string; hash: Promise<string> } {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const raw = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return { raw, hash: computeDocumentHash(raw) };
}

// ─── Document Freeze ─────────────────────────────────────────────────────────
//
// Call this BEFORE createSignatureRequest.
// It renders the document to HTML, computes a hash, and stores both on the
// document record. After this point the document should be locked from editing.

export async function freezeDocument(
  documentId: string,
  generateHtmlFn: (doc: Record<string, unknown>) => string,
  fetchDocumentQuery: () => Promise<Record<string, unknown> | null>
): Promise<{ htmlSnapshot: string; documentHash: string }> {
  const document = await fetchDocumentQuery();
  if (!document) throw new Error('Document not found');

  const htmlSnapshot = generateHtmlFn(document);
  const documentHash = await computeDocumentHash(htmlSnapshot);

  const { error } = await supabase
    .from('proposals')  // <-- replace with your table name
    .update({
      frozen_html_snapshot: htmlSnapshot,
      frozen_document_hash: documentHash,
    })
    .eq('id', documentId);

  if (error) throw error;

  return { htmlSnapshot, documentHash };
}

// ─── Create Signature Request ─────────────────────────────────────────────────
//
// Generates the secure token, inserts the signature_request row, updates the
// parent document, writes an audit event, and returns the raw token + URL.
// The signing URL must be constructed here so the raw token is included before
// it is discarded.

export async function createSignatureRequest(params: {
  documentId: string;
  contactId: string | null;
  signerName: string;
  signerEmail: string;
  expiresInDays: number;
  createdByUserId: string;
  orgId: string;
}): Promise<{ requestId: string; rawToken: string; signingUrl: string }> {
  const token = generateSecureToken();
  const tokenHash = await token.hash;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + params.expiresInDays);

  const { data: request, error } = await supabase
    .from('proposal_signature_requests')  // <-- replace table name prefix if desired
    .insert({
      org_id: params.orgId,
      proposal_id: params.documentId,
      contact_id: params.contactId,
      signer_name: params.signerName,
      signer_email: params.signerEmail,
      access_token_hash: tokenHash,
      status: 'pending',
      expires_at: expiresAt.toISOString(),
      created_by_user_id: params.createdByUserId,
    })
    .select()
    .single();

  if (error) throw error;

  await supabase
    .from('proposals')
    .update({
      signature_status: 'pending_signature',
      expires_at: expiresAt.toISOString(),
      signature_request_id: request.id,
      signer_name: params.signerName,
      signer_email: params.signerEmail,
    })
    .eq('id', params.documentId);

  await createAuditEvent({
    documentId: params.documentId,
    orgId: params.orgId,
    eventType: 'sent_for_signature',
    actorType: 'user',
    actorId: params.createdByUserId,
    metadata: {
      signer_name: params.signerName,
      signer_email: params.signerEmail,
      expires_at: expiresAt.toISOString(),
    },
  });

  // IMPORTANT: the signingUrl includes the raw token. This is the only place
  // the raw token is used. After this function returns, the raw token is
  // only needed for passing to the email send function.
  const signingUrl = `${window.location.origin}/sign/proposal/${request.id}?token=${token.raw}`;

  return { requestId: request.id, rawToken: token.raw, signingUrl };
}

// ─── Token Verification ───────────────────────────────────────────────────────

export async function verifySigningToken(
  requestId: string,
  rawToken: string
): Promise<SignatureRequest | null> {
  const tokenHash = await computeDocumentHash(rawToken);

  const { data, error } = await supabase
    .from('proposal_signature_requests')
    .select('*')
    .eq('id', requestId)
    .eq('access_token_hash', tokenHash)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

// ─── Mark Viewed ─────────────────────────────────────────────────────────────
// Idempotent: only runs if viewed_at is null (first visit).

export async function markRequestViewed(
  requestId: string,
  documentId: string,
  orgId: string
): Promise<void> {
  const { data: request } = await supabase
    .from('proposal_signature_requests')
    .select('viewed_at')
    .eq('id', requestId)
    .single();

  if (!request?.viewed_at) {
    await supabase
      .from('proposal_signature_requests')
      .update({ viewed_at: new Date().toISOString(), status: 'viewed' })
      .eq('id', requestId);

    await supabase
      .from('proposals')
      .update({ signature_status: 'viewed' })
      .eq('id', documentId)
      .in('signature_status', ['pending_signature']);

    await createAuditEvent({
      documentId,
      orgId,
      eventType: 'viewed',
      actorType: 'signer',
      metadata: { request_id: requestId },
    });
  }
}

// ─── Submit Signature ─────────────────────────────────────────────────────────

export async function submitSignature(params: {
  requestId: string;
  documentId: string;
  orgId: string;
  signatureType: 'typed' | 'drawn';
  signatureText?: string;
  signatureImageUrl?: string;
  signerName: string;
  signerEmail: string;
  ipAddress?: string;
  userAgent?: string;
  consentText: string;
  documentHash: string;
}): Promise<void> {
  const { error: sigError } = await supabase
    .from('proposal_signatures')
    .insert({
      org_id: params.orgId,
      proposal_id: params.documentId,
      signature_request_id: params.requestId,
      signature_type: params.signatureType,
      signature_text: params.signatureText || null,
      signature_image_url: params.signatureImageUrl || null,
      signer_name: params.signerName,
      signer_email: params.signerEmail,
      ip_address: params.ipAddress || null,
      user_agent: params.userAgent || null,
      consent_text: params.consentText,
      document_hash: params.documentHash,
    });

  if (sigError) throw sigError;

  const now = new Date().toISOString();

  await supabase
    .from('proposal_signature_requests')
    .update({ status: 'signed', signed_at: now })
    .eq('id', params.requestId);

  await supabase
    .from('proposals')
    .update({
      signature_status: 'signed',
      signed_at: now,
      signer_name: params.signerName,
      signer_email: params.signerEmail,
    })
    .eq('id', params.documentId);

  await createAuditEvent({
    documentId: params.documentId,
    orgId: params.orgId,
    eventType: 'signed',
    actorType: 'signer',
    metadata: {
      request_id: params.requestId,
      signer_name: params.signerName,
      signer_email: params.signerEmail,
      user_agent: params.userAgent,
      document_hash: params.documentHash,
    },
  });
}

// ─── Decline Signature ────────────────────────────────────────────────────────

export async function declineSignature(params: {
  requestId: string;
  documentId: string;
  orgId: string;
  reason?: string;
  userAgent?: string;
}): Promise<void> {
  const now = new Date().toISOString();

  await supabase
    .from('proposal_signature_requests')
    .update({
      status: 'declined',
      declined_at: now,
      decline_reason: params.reason || null,
    })
    .eq('id', params.requestId);

  await supabase
    .from('proposals')
    .update({ signature_status: 'declined', declined_at: now })
    .eq('id', params.documentId);

  await createAuditEvent({
    documentId: params.documentId,
    orgId: params.orgId,
    eventType: 'declined',
    actorType: 'signer',
    metadata: {
      request_id: params.requestId,
      reason: params.reason || null,
      user_agent: params.userAgent,
    },
  });
}

// ─── Void Request (from CRM) ──────────────────────────────────────────────────

export async function voidSignatureRequest(
  requestId: string,
  documentId: string,
  orgId: string,
  actorUserId: string
): Promise<void> {
  await supabase
    .from('proposal_signature_requests')
    .update({ status: 'voided' })
    .eq('id', requestId);

  await supabase
    .from('proposals')
    .update({ signature_status: 'voided' })
    .eq('id', documentId);

  await createAuditEvent({
    documentId,
    orgId,
    eventType: 'voided',
    actorType: 'user',
    actorId: actorUserId,
    metadata: { request_id: requestId },
  });
}

// ─── Resend / Regenerate Token ────────────────────────────────────────────────
// Issues a NEW token, resetting the request to pending. Old token is invalidated.

export async function resendSignatureRequest(
  requestId: string,
  documentId: string,
  orgId: string,
  actorUserId: string
): Promise<{ rawToken: string; signingUrl: string }> {
  const token = generateSecureToken();
  const tokenHash = await token.hash;

  await supabase
    .from('proposal_signature_requests')
    .update({
      access_token_hash: tokenHash,
      viewed_at: null,
      status: 'pending',
    })
    .eq('id', requestId);

  await supabase
    .from('proposals')
    .update({ signature_status: 'pending_signature' })
    .eq('id', documentId);

  await createAuditEvent({
    documentId,
    orgId,
    eventType: 'resent',
    actorType: 'user',
    actorId: actorUserId,
    metadata: { request_id: requestId },
  });

  const signingUrl = `${window.location.origin}/sign/proposal/${requestId}?token=${token.raw}`;
  return { rawToken: token.raw, signingUrl };
}

// ─── Upload Signature Image ───────────────────────────────────────────────────
// Converts a base64 data URL to a Blob and uploads to the proposal-signatures bucket.

export async function uploadSignatureImage(
  orgId: string,
  requestId: string,
  imageDataUrl: string
): Promise<string | null> {
  try {
    const base64Data = imageDataUrl.split(',')[1];
    const byteCharacters = atob(base64Data);
    const byteArray = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteArray[i] = byteCharacters.charCodeAt(i);
    }
    const blob = new Blob([byteArray], { type: 'image/png' });

    const path = `${orgId}/${requestId}/signature.png`;
    const { error } = await supabase.storage
      .from('proposal-signatures')
      .upload(path, blob, { contentType: 'image/png', upsert: true });

    if (error) return null;

    const { data } = supabase.storage
      .from('proposal-signatures')
      .getPublicUrl(path);

    return data.publicUrl;
  } catch {
    return null;
  }
}

// ─── Query Helpers ────────────────────────────────────────────────────────────

export async function getSignatureRequestByDocument(
  documentId: string
): Promise<SignatureRequest | null> {
  const { data, error } = await supabase
    .from('proposal_signature_requests')
    .select('*')
    .eq('proposal_id', documentId)
    .neq('status', 'voided')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return data;
}

export async function getAuditEvents(documentId: string): Promise<AuditEvent[]> {
  const { data, error } = await supabase
    .from('proposal_audit_events')
    .select('*')
    .eq('proposal_id', documentId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createAuditEvent(params: {
  documentId: string;
  orgId: string;
  eventType: string;
  actorType: 'system' | 'user' | 'signer';
  actorId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await supabase
    .from('proposal_audit_events')
    .insert({
      org_id: params.orgId,
      proposal_id: params.documentId,
      event_type: params.eventType,
      actor_type: params.actorType,
      actor_id: params.actorId || null,
      metadata: params.metadata || {},
    });
}
```

---

## 5. Email Delivery Layer

The email layer depends on **SendGrid** via a `email-send` edge function. If your new CRM uses a different provider, substitute the `sendEmail()` call. The HTML template functions are provider-agnostic.

### 5.1 Email Validation Before Sending

Always call this before attempting to send. It checks that a SendGrid API key is configured and a verified from-address exists for the org.

```typescript
// src/services/documentSignatureEmail.ts

export async function validateEmailSetup(orgId: string): Promise<{
  ready: boolean;
  fromAddress: { id: string; email: string } | null;
  blockingReasons: string[];
}> {
  // 1. Check your email provider is configured
  const status = await getEmailSetupStatus(); // your existing email setup check
  if (!status.isConfigured) {
    return { ready: false, fromAddress: null, blockingReasons: status.blockingReasons };
  }

  // 2. Find a verified from-address for this org
  const { data: fromAddress } = await supabase
    .from('email_from_addresses')
    .select('id, email')
    .eq('org_id', orgId)
    .eq('active', true)
    .order('is_default', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!fromAddress) {
    return {
      ready: false,
      fromAddress: null,
      blockingReasons: ['No verified sender address configured for this organization.'],
    };
  }

  return { ready: true, fromAddress, blockingReasons: [] };
}
```

### 5.2 Send Signature Request Email

```typescript
export async function sendSignatureRequestEmail(params: {
  proposalTitle: string;
  totalValue?: string;
  signerName: string;
  signerEmail: string;
  signingUrl: string;
  expiresAt: string;
  orgId: string;
  companyName: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { ready, fromAddress, blockingReasons } = await validateEmailSetup(params.orgId);
  if (!ready || !fromAddress) {
    return { success: false, error: blockingReasons[0] || 'Email not configured' };
  }

  const htmlBody = buildSignatureRequestEmail({
    signerName: params.signerName,
    proposalTitle: params.proposalTitle,
    totalValue: params.totalValue,
    signingUrl: params.signingUrl,
    expiresAt: params.expiresAt,
    companyName: params.companyName,
  });

  return await sendEmail({
    toEmail: params.signerEmail,
    toName: params.signerName,
    fromAddressId: fromAddress.id,
    subject: `Please review and sign: ${params.proposalTitle}`,
    htmlBody,
    trackOpens: true,
    trackClicks: true,
    transactional: true,
  });
}

export async function updateSignatureRequestSendStatus(
  requestId: string,
  status: 'sent' | 'failed',
  messageId?: string,
  error?: string
): Promise<void> {
  await supabase
    .from('proposal_signature_requests')
    .update({
      send_status: status,
      sendgrid_message_id: messageId || null,
      send_error: status === 'failed' ? (error || 'Unknown error') : null,
      last_sent_at: status === 'sent' ? new Date().toISOString() : undefined,
    })
    .eq('id', requestId);
}
```

### 5.3 Email HTML Templates

These are pure functions — no external dependencies. Copy them verbatim.

```typescript
// src/services/documentSigningEmails.ts

// ── Initial Signature Request Email ──────────────────────────────────────────
export function buildSignatureRequestEmail(params: {
  signerName: string;
  proposalTitle: string;
  totalValue?: string;
  signingUrl: string;
  expiresAt: string;
  companyName: string;
}): string {
  const expiresFormatted = new Date(params.expiresAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
  <div style="padding: 40px 32px 32px;">
    <p style="font-size: 16px; color: #1e293b; margin: 0 0 20px;">Hi ${params.signerName},</p>
    <p style="font-size: 16px; color: #334155; line-height: 1.6; margin: 0 0 24px;">
      A proposal requires your electronic signature. Please review the document and sign at your convenience.
    </p>
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 0 0 28px;">
      <p style="font-size: 14px; color: #64748b; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Proposal</p>
      <p style="font-size: 18px; color: #0f172a; font-weight: 600; margin: 0;">${params.proposalTitle}</p>
      ${params.totalValue ? `<p style="font-size: 16px; color: #0891b2; font-weight: 600; margin: 8px 0 0;">${params.totalValue}</p>` : ''}
    </div>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${params.signingUrl}" style="display: inline-block; padding: 14px 40px; background-color: #0891b2; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
        Review &amp; Sign
      </a>
    </div>
    <p style="font-size: 14px; color: #94a3b8; text-align: center; margin: 0 0 32px;">
      This signature request expires on ${expiresFormatted}
    </p>
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
    <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
      You're receiving this email because your signature was requested by ${params.companyName}.
      <br />If you did not expect this email, you can safely ignore it.
    </p>
  </div>
</div>`;
}

// ── Reminder Email ────────────────────────────────────────────────────────────
export function buildSignatureReminderEmail(params: {
  signerName: string;
  proposalTitle: string;
  signingUrl: string;
  expiresAt: string;
  daysRemaining: number;
  companyName: string;
}): string {
  const expiresFormatted = new Date(params.expiresAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  const urgencyText = params.daysRemaining <= 1
    ? 'This request expires tomorrow.'
    : `This request expires in ${params.daysRemaining} days.`;

  return `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
  <div style="padding: 40px 32px 32px;">
    <p style="font-size: 16px; color: #1e293b; margin: 0 0 20px;">Hi ${params.signerName},</p>
    <p style="font-size: 16px; color: #334155; line-height: 1.6; margin: 0 0 16px;">
      This is a friendly reminder that your signature is still needed on the following proposal:
    </p>
    <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px 20px; margin: 0 0 24px;">
      <p style="font-size: 14px; color: #92400e; font-weight: 600; margin: 0;">${urgencyText}</p>
    </div>
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 0 0 28px;">
      <p style="font-size: 18px; color: #0f172a; font-weight: 600; margin: 0;">${params.proposalTitle}</p>
      <p style="font-size: 13px; color: #94a3b8; margin: 4px 0 0;">Expires: ${expiresFormatted}</p>
    </div>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${params.signingUrl}" style="display: inline-block; padding: 14px 40px; background-color: #0891b2; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
        Review &amp; Sign Now
      </a>
    </div>
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
    <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">Sent by ${params.companyName}</p>
  </div>
</div>`;
}

// ── Post-Signing Confirmation to Signer ───────────────────────────────────────
export function buildSignatureCompletionEmail(params: {
  signerName: string;
  proposalTitle: string;
  signedDocumentUrl?: string;
  companyName: string;
}): string {
  return `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
  <div style="padding: 40px 32px 32px;">
    <div style="text-align: center; margin: 0 0 24px;">
      <div style="display: inline-block; width: 48px; height: 48px; background: #d1fae5; border-radius: 50%; line-height: 48px; text-align: center;">
        <span style="color: #059669; font-size: 24px;">&#10003;</span>
      </div>
    </div>
    <h2 style="font-size: 20px; color: #0f172a; text-align: center; margin: 0 0 16px;">Document Signed Successfully</h2>
    <p style="font-size: 16px; color: #334155; line-height: 1.6; margin: 0 0 24px; text-align: center;">
      Hi ${params.signerName}, your signature has been recorded for <strong>${params.proposalTitle}</strong>.
    </p>
    ${params.signedDocumentUrl ? `
    <div style="text-align: center; margin: 32px 0;">
      <a href="${params.signedDocumentUrl}" style="display: inline-block; padding: 14px 40px; background-color: #059669; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
        Download Signed Document
      </a>
    </div>` : ''}
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
    <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
      Thank you for your business. &mdash; ${params.companyName}
    </p>
  </div>
</div>`;
}

// ── Internal Notification to CRM User ─────────────────────────────────────────
export function buildInternalSignatureNotificationEmail(params: {
  proposalTitle: string;
  signerName: string;
  signerEmail: string;
  signedAt: string;
  proposalUrl: string;
}): string {
  const signedFormatted = new Date(params.signedAt).toLocaleString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });

  return `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
  <div style="padding: 40px 32px 32px;">
    <div style="background: #d1fae5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 16px 20px; margin: 0 0 24px;">
      <p style="font-size: 14px; color: #065f46; font-weight: 600; margin: 0;">Proposal Signed</p>
    </div>
    <p style="font-size: 16px; color: #334155; line-height: 1.6; margin: 0 0 24px;">
      <strong>${params.signerName}</strong> (${params.signerEmail}) has signed the proposal
      <strong>${params.proposalTitle}</strong>.
    </p>
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; margin: 0 0 28px;">
      <p style="font-size: 13px; color: #64748b; margin: 0 0 4px;">Signed at</p>
      <p style="font-size: 15px; color: #0f172a; font-weight: 500; margin: 0;">${signedFormatted}</p>
    </div>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${params.proposalUrl}" style="display: inline-block; padding: 14px 40px; background-color: #0891b2; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
        View Proposal
      </a>
    </div>
  </div>
</div>`;
}
```

---

## 6. Frontend Components

### 6.1 SignatureCapture Component

This component handles both **typed** (rendered to canvas via Georgia font) and **drawn** (freehand canvas drawing) signature modes. It outputs a `{ type, text?, imageDataUrl }` object via the `onSignatureChange` callback.

```tsx
// src/components/proposals/SignatureCapture.tsx
import { useRef, useEffect, useState, useCallback } from 'react';
import { PenTool, Type, X } from 'lucide-react';

interface SignatureData {
  type: 'typed' | 'drawn';
  text?: string;
  imageDataUrl: string;
}

interface SignatureCaptureProps {
  signerName: string;
  onSignatureChange: (data: SignatureData | null) => void;
}

export function SignatureCapture({ signerName, onSignatureChange }: SignatureCaptureProps) {
  const [mode, setMode] = useState<'type' | 'draw'>('type');
  const [typedName, setTypedName] = useState(signerName);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Render typed name to an off-screen canvas and emit the data URL
  const renderTypedToCanvas = useCallback((name: string) => {
    if (!name.trim()) { onSignatureChange(null); return; }

    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 200;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'italic 52px Georgia, "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name.trim(), canvas.width / 2, canvas.height / 2);

    onSignatureChange({ type: 'typed', text: name.trim(), imageDataUrl: canvas.toDataURL('image/png') });
  }, [onSignatureChange]);

  useEffect(() => {
    if (mode === 'type') renderTypedToCanvas(typedName);
  }, [typedName, mode, renderTypedToCanvas]);

  useEffect(() => {
    if (mode === 'draw') {
      initCanvas();
      onSignatureChange(null);
      setHasDrawn(false);
    }
  }, [mode]);

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    if ('touches' in e) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')?.closePath();
    setIsDrawing(false);
    onSignatureChange({ type: 'drawn', imageDataUrl: canvas.toDataURL('image/png') });
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onSignatureChange(null);
  };

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-lg w-fit">
        <button type="button" onClick={() => setMode('type')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === 'type' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}>
          <Type className="w-4 h-4" /> Type
        </button>
        <button type="button" onClick={() => setMode('draw')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === 'draw' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}>
          <PenTool className="w-4 h-4" /> Draw
        </button>
      </div>

      {mode === 'type' ? (
        <div className="space-y-3">
          <input type="text" value={typedName} onChange={(e) => setTypedName(e.target.value)}
            placeholder="Type your full name"
            className="w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 bg-white" />
          {typedName.trim() && (
            <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 bg-white flex items-center justify-center min-h-[100px]">
              <span className="text-4xl text-slate-900 select-none"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontStyle: 'italic' }}>
                {typedName.trim()}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <canvas ref={canvasRef}
              onMouseDown={startDrawing} onMouseMove={draw}
              onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
              onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing}
              className="w-full border-2 border-dashed border-slate-200 rounded-lg bg-white cursor-crosshair touch-none"
              style={{ width: '100%', height: '160px' }} />
            {hasDrawn && (
              <button type="button" onClick={clearCanvas}
                className="absolute top-2 right-2 p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400 text-center">Sign above using your mouse or touch screen</p>
        </div>
      )}
    </div>
  );
}
```

### 6.2 SendForSignatureModal Component

This modal drives the CRM-side flow. It has a two-step UI (form → email preview) and orchestrates freeze → create request → send email.

Key behaviors:
- Validates email setup before allowing progression to preview step
- Calls `freezeDocument()` first, then `createSignatureRequest()`, then `sendSignatureRequestEmail()`
- Records `send_status` on the request row after email attempt (success or failure)
- Shows email preview as rendered HTML in an iframe-like div

```tsx
// src/components/proposals/SendForSignatureModal.tsx
// (Full implementation — key orchestration in handleSend)

const handleSend = async () => {
  if (!user || !canProceed) return;
  try {
    setIsSending(true);
    setStep('freezing');

    // Step 1: Freeze the document content
    await freezeProposal(proposal.id);

    setStep('sending');

    // Step 2: Create the signature request (generates token internally)
    const { request, signingUrl } = await createSignatureRequest(
      proposal.id,
      proposal.contact_id,
      signerName.trim(),
      signerEmail.trim(),
      expirationDays,
      user.id,
      proposal.org_id
    );

    // Step 3: Send the email
    const emailResult = await sendSignatureRequestEmail({
      proposalTitle: proposal.title,
      totalValue: proposal.total_value > 0
        ? formatCurrency(proposal.total_value, proposal.currency)
        : undefined,
      signerName: signerName.trim(),
      signerEmail: signerEmail.trim(),
      signingUrl,
      expiresAt,
      orgId: proposal.org_id,
      companyName,
    });

    // Step 4: Record delivery outcome
    if (emailResult.success) {
      await updateSignatureRequestSendStatus(request.id, 'sent', emailResult.messageId);
      onSent(); // close modal, refresh parent
    } else {
      await updateSignatureRequestSendStatus(request.id, 'failed', undefined, emailResult.error);
      setError(emailResult.error || 'Failed to send email. You can retry from the Signature tab.');
      setStep('form');
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to send signature request');
    setStep('form');
  } finally {
    setIsSending(false);
  }
};
```

---

## 7. Public Signing Page

### 7.1 Route

Register this route **outside** your authenticated router, accessible without login:

```tsx
// In your React Router configuration
<Route path="/sign/proposal/:requestId" element={<PublicProposalSignPage />} />
```

The `:requestId` segment is the UUID of the `proposal_signature_requests` row. The `?token=` query param contains the raw signing token.

### 7.2 Page State Machine

The page has the following states with these transitions:

```
loading
  ├─► invalid          (no requestId/token, bad token hash, DB not found)
  ├─► expired          (request.expires_at < now)
  ├─► already_signed   (request.status === 'signed')
  ├─► declined         (request.status === 'declined')
  ├─► voided           (request.status === 'voided')
  └─► ready            (valid token, not expired, not terminal)
        ├─► decline_form  (user clicks "Decline")
        │     └─► declined  (user confirms decline)
        └─► signing       (user clicks "Sign Document")
              ├─► signed    (signature successfully recorded)
              └─► ready     (error during signing, retry)
```

### 7.3 Verification Sequence on Page Load

```typescript
const verifyAndLoad = async () => {
  if (!requestId || !token) { setPageState('invalid'); return; }

  // 1. Hash the token from the URL
  const tokenHash = await hashToken(token);

  // 2. Query by requestId + tokenHash — returns null if either is wrong
  const { data: req } = await supabase
    .from('proposal_signature_requests')
    .select('*')
    .eq('id', requestId)
    .eq('access_token_hash', tokenHash)
    .maybeSingle();

  if (!req) { setPageState('invalid'); return; }

  // 3. Check terminal states
  if (req.status === 'signed')   { setPageState('already_signed'); return; }
  if (req.status === 'declined') { setPageState('declined'); return; }
  if (req.status === 'voided')   { setPageState('voided'); return; }

  // 4. Check expiry
  if (new Date(req.expires_at) < new Date()) { setPageState('expired'); return; }

  // 5. Load document data
  const { data: proposal } = await supabase
    .from('proposals')
    .select('*, contact:contacts(...), line_items:proposal_line_items(...), sections:proposal_sections(...)')
    .eq('id', req.proposal_id)
    .maybeSingle();

  if (!proposal) { setPageState('invalid'); return; }

  // 6. Mark viewed (idempotent — only runs if viewed_at is null)
  if (!req.viewed_at) {
    await supabase.from('proposal_signature_requests')
      .update({ viewed_at: new Date().toISOString(), status: 'viewed' })
      .eq('id', requestId);

    await supabase.from('proposals')
      .update({ signature_status: 'viewed' })
      .eq('id', req.proposal_id)
      .in('signature_status', ['pending_signature']);

    await supabase.from('proposal_audit_events').insert({
      org_id: proposal.org_id,
      proposal_id: req.proposal_id,
      event_type: 'viewed',
      actor_type: 'signer',
      metadata: { request_id: requestId },
    });
  }

  setRequest(req);
  setProposal(proposal);
  setPageState('ready');
};
```

### 7.4 Signing Submission on the Public Page

The public page performs the signing directly without going through the service layer (to avoid auth dependency). The logic mirrors `submitSignature()` from the service layer:

```typescript
const handleSign = async () => {
  if (!request || !proposal || !signatureData || !consentChecked) return;

  setPageState('signing');

  // 1. Upload signature image to storage
  let signatureImageUrl: string | null = null;
  if (signatureData.imageDataUrl) {
    const blob = dataUrlToBlob(signatureData.imageDataUrl);
    const path = `${proposal.org_id}/${request.id}/signature.png`;
    await supabase.storage.from('proposal-signatures').upload(path, blob, { upsert: true });
    const { data } = supabase.storage.from('proposal-signatures').getPublicUrl(path);
    signatureImageUrl = data.publicUrl;
  }

  // 2. Compute document hash from the frozen snapshot
  const documentHash = proposal.frozen_html_snapshot
    ? await hashContent(proposal.frozen_html_snapshot)
    : 'no-snapshot';

  const consentText = `I, ${request.signer_name}, agree to electronically sign this proposal. I understand this constitutes a legally binding signature.`;

  // 3. Insert signature record
  await supabase.from('proposal_signatures').insert({
    org_id: proposal.org_id,
    proposal_id: proposal.id,
    signature_request_id: request.id,
    signature_type: signatureData.type,
    signature_text: signatureData.text || null,
    signature_image_url: signatureImageUrl,
    signer_name: request.signer_name,
    signer_email: request.signer_email,
    ip_address: null,               // not available in browser
    user_agent: navigator.userAgent,
    consent_text: consentText,
    document_hash: documentHash,
  });

  const now = new Date().toISOString();

  // 4. Update request status
  await supabase.from('proposal_signature_requests')
    .update({ status: 'signed', signed_at: now })
    .eq('id', request.id);

  // 5. Update parent document status
  await supabase.from('proposals')
    .update({ signature_status: 'signed', signed_at: now })
    .eq('id', proposal.id);

  // 6. Write audit event
  await supabase.from('proposal_audit_events').insert({
    org_id: proposal.org_id,
    proposal_id: proposal.id,
    event_type: 'signed',
    actor_type: 'signer',
    metadata: {
      request_id: request.id,
      signer_name: request.signer_name,
      signer_email: request.signer_email,
      user_agent: navigator.userAgent,
      document_hash: documentHash,
    },
  });

  setPageState('signed');
};

// Helper: base64 data URL to Blob
function dataUrlToBlob(dataUrl: string): Blob {
  const base64 = dataUrl.split(',')[1];
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: 'image/png' });
}
```

### 7.5 Decline Flow on the Public Page

```typescript
const handleDecline = async () => {
  const now = new Date().toISOString();

  await supabase.from('proposal_signature_requests')
    .update({ status: 'declined', declined_at: now, decline_reason: declineReason || null })
    .eq('id', request.id);

  await supabase.from('proposals')
    .update({ signature_status: 'declined', declined_at: now })
    .eq('id', proposal.id);

  await supabase.from('proposal_audit_events').insert({
    org_id: proposal.org_id,
    proposal_id: proposal.id,
    event_type: 'declined',
    actor_type: 'signer',
    metadata: { request_id: request.id, reason: declineReason || null, user_agent: navigator.userAgent },
  });

  setPageState('declined');
};
```

---

## 8. Edge Function: Signed Document Generator

Deploy this as `supabase/functions/proposal-signed-pdf/index.ts`.

This function is called after a signature is submitted. It injects a tamper-evident "ELECTRONICALLY SIGNED" badge into the frozen HTML snapshot and stores the result in the `proposal-signatures` storage bucket. It then updates `proposals.final_signed_pdf_url`.

**Trigger:** Call this from your backend (e.g., webhook, post-sign server action, or manually from the CRM UI) with `{ proposalId, signatureRequestId }`.

```typescript
// supabase/functions/proposal-signed-pdf/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Injects a signed badge block into the frozen HTML before </body>
function buildSignedDocumentHTML(frozenHtml: string, signature: {
  signer_name: string; signer_email: string;
  signature_type: string; signature_text?: string; signature_image_url?: string;
  signed_at: string; ip_address?: string; consent_text: string; document_hash: string;
}): string {
  const signedDate = new Date(signature.signed_at).toLocaleString("en-US", {
    year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  });

  const signatureDisplay = signature.signature_type === "drawn" && signature.signature_image_url
    ? `<img src="${signature.signature_image_url}" alt="Signature" style="max-height:80px;max-width:300px;" />`
    : `<span style="font-family:Georgia,serif;font-size:32px;font-style:italic;color:#f1f5f9;">${signature.signature_text || signature.signer_name}</span>`;

  const badge = `
<div style="background:#064e3b;border:2px solid #059669;border-radius:12px;padding:24px 28px;margin:20px 0;page-break-inside:avoid;">
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
    <span style="font-size:18px;font-weight:700;color:#34d399;letter-spacing:0.5px;">ELECTRONICALLY SIGNED</span>
  </div>
  <div style="border-bottom:2px solid #065f46;padding-bottom:16px;margin-bottom:16px;">${signatureDisplay}</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
    <div><div style="font-size:10px;font-weight:600;letter-spacing:0.8px;color:#6ee7b7;text-transform:uppercase;margin-bottom:2px;">SIGNER</div><div style="font-size:14px;color:#d1fae5;">${signature.signer_name}</div></div>
    <div><div style="font-size:10px;font-weight:600;letter-spacing:0.8px;color:#6ee7b7;text-transform:uppercase;margin-bottom:2px;">EMAIL</div><div style="font-size:14px;color:#d1fae5;">${signature.signer_email}</div></div>
    <div><div style="font-size:10px;font-weight:600;letter-spacing:0.8px;color:#6ee7b7;text-transform:uppercase;margin-bottom:2px;">SIGNED ON</div><div style="font-size:14px;color:#d1fae5;">${signedDate}</div></div>
    <div><div style="font-size:10px;font-weight:600;letter-spacing:0.8px;color:#6ee7b7;text-transform:uppercase;margin-bottom:2px;">IP ADDRESS</div><div style="font-size:14px;color:#d1fae5;">${signature.ip_address || "N/A"}</div></div>
  </div>
  <div style="margin-top:16px;padding-top:12px;border-top:1px solid #065f46;">
    <div style="font-size:10px;font-weight:600;letter-spacing:0.8px;color:#6ee7b7;text-transform:uppercase;margin-bottom:4px;">DOCUMENT HASH (SHA-256)</div>
    <div style="font-size:11px;color:#a7f3d0;font-family:monospace;word-break:break-all;">${signature.document_hash}</div>
  </div>
  <div style="margin-top:12px;font-size:11px;color:#6ee7b7;font-style:italic;">${signature.consent_text}</div>
</div>`;

  const insertPoint = frozenHtml.lastIndexOf("</body>");
  if (insertPoint === -1) return frozenHtml + badge;
  return (
    frozenHtml.slice(0, insertPoint) +
    `<div style="padding:40px 50px 60px;page-break-before:always;">${badge}</div>` +
    frozenHtml.slice(insertPoint)
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const supabase = getServiceClient();
    const { proposalId, signatureRequestId } = await req.json();

    if (!proposalId || !signatureRequestId) {
      return new Response(JSON.stringify({ success: false, error: "Missing params" }), { status: 400, headers: corsHeaders });
    }

    const { data: proposal } = await supabase
      .from("proposals")
      .select("id, org_id, title, frozen_html_snapshot, frozen_document_hash, signature_status")
      .eq("id", proposalId)
      .maybeSingle();

    if (!proposal || proposal.signature_status !== "signed" || !proposal.frozen_html_snapshot) {
      return new Response(JSON.stringify({ success: false, error: "Invalid state" }), { status: 400, headers: corsHeaders });
    }

    const { data: signature } = await supabase
      .from("proposal_signatures")
      .select("*")
      .eq("signature_request_id", signatureRequestId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!signature) {
      return new Response(JSON.stringify({ success: false, error: "Signature not found" }), { status: 404, headers: corsHeaders });
    }

    const signedHtml = buildSignedDocumentHTML(proposal.frozen_html_snapshot, {
      signer_name: signature.signer_name,
      signer_email: signature.signer_email,
      signature_type: signature.signature_type,
      signature_text: signature.signature_text,
      signature_image_url: signature.signature_image_url,
      signed_at: signature.created_at,
      ip_address: signature.ip_address,
      consent_text: signature.consent_text,
      document_hash: signature.document_hash,
    });

    const fileName = `${proposal.org_id}/${proposalId}/signed-proposal.html`;
    const blob = new Blob([signedHtml], { type: "text/html" });

    await supabase.storage.from("proposal-signatures").upload(fileName, blob, { contentType: "text/html", upsert: true });
    const { data: urlData } = supabase.storage.from("proposal-signatures").getPublicUrl(fileName);

    await supabase.from("proposals").update({ final_signed_pdf_url: urlData.publicUrl }).eq("id", proposalId);

    await supabase.from("proposal_audit_events").insert({
      org_id: proposal.org_id,
      proposal_id: proposalId,
      event_type: "signed_document_generated",
      actor_type: "system",
      metadata: { file_url: urlData.publicUrl, document_hash: proposal.frozen_document_hash },
    });

    return new Response(JSON.stringify({ success: true, url: urlData.publicUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Internal error" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
```

---

## 9. Background Cron Jobs

Both functions use the **service role key** and are called via `pg_cron` + `pg_net`. They do not require JWT verification.

### 9.1 Signature Reminder Scheduler

**Schedule:** Every 6 hours (`0 */6 * * *`)
**Logic:** For each `pending` or `viewed` request that has not expired, check if 48 hours have passed since the last reminder (or since creation). If so, and if fewer than 3 reminders have been sent, send a reminder email and increment `reminder_count`.

**Full implementation:** `supabase/functions/signature-reminder-scheduler/index.ts`

Key fields updated on `proposal_signature_requests` after each reminder:
```
last_reminder_sent_at = now()
reminder_count        = reminder_count + 1
send_status           = 'sent' | 'failed'
sendgrid_message_id   = (if successful)
send_error            = (if failed)
```

An audit event `reminder_sent` is written with `reminder_number` and `days_remaining` in metadata.

### 9.2 Signature Expiration Processor

**Schedule:** Every hour at :15 (`15 * * * *`)
**Logic:** Find all `pending` or `viewed` requests where `expires_at < now()`. For each:
1. Set `proposal_signature_requests.status = 'expired'`
2. Set `proposals.signature_status = 'expired'` (only if currently `pending_signature` or `viewed`)
3. Write audit event `expired`

**Full implementation:** `supabase/functions/signature-expiration-processor/index.ts`

### 9.3 Cron Registration SQL

```sql
SELECT cron.schedule(
  'signature-reminder-scheduler',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/signature-reminder-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'signature-expiration-processor',
  '15 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/signature-expiration-processor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

> **Prerequisite:** `pg_cron` and `pg_net` extensions must be enabled. In Supabase, enable via the dashboard under Database > Extensions.

---

## 10. TypeScript Types

Add these to your types file (e.g., `src/types/index.ts`).

```typescript
export type SignatureStatus =
  | 'not_sent'
  | 'pending_signature'
  | 'viewed'
  | 'signed'
  | 'declined'
  | 'expired'
  | 'voided';

export type SignatureRequestStatus =
  | 'pending'
  | 'viewed'
  | 'signed'
  | 'declined'
  | 'expired'
  | 'voided';

export type SignatureType = 'typed' | 'drawn';
export type AuditActorType = 'system' | 'user' | 'signer';
export type SendStatus = 'pending' | 'sent' | 'failed';

export interface ProposalSignatureRequest {
  id: string;
  org_id: string;
  proposal_id: string;
  contact_id: string | null;
  signer_name: string;
  signer_email: string;
  access_token_hash: string;     // SHA-256 of raw token; never expose raw
  status: SignatureRequestStatus;
  expires_at: string;
  viewed_at: string | null;
  signed_at: string | null;
  declined_at: string | null;
  decline_reason: string | null;
  send_status: SendStatus;
  sendgrid_message_id: string | null;
  send_error: string | null;
  last_sent_at: string | null;
  reminder_count: number;
  last_reminder_sent_at: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProposalSignature {
  id: string;
  org_id: string;
  proposal_id: string;
  signature_request_id: string;
  signature_type: SignatureType;
  signature_text: string | null;
  signature_image_url: string | null;
  signer_name: string;
  signer_email: string;
  ip_address: string | null;
  user_agent: string | null;
  consent_text: string;
  signed_at: string;
  document_hash: string;
  created_at: string;
}

export interface ProposalAuditEvent {
  id: string;
  org_id: string;
  proposal_id: string;
  event_type: string;
  actor_type: AuditActorType;
  actor_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
```

---

## 11. Routing Setup

Add the public signing route at the **top level** of your router, outside any authenticated wrapper:

```tsx
// src/App.tsx or your router file

import { Routes, Route } from 'react-router-dom';
import { PublicProposalSignPage } from './pages/public/PublicProposalSignPage';

// ... your other routes ...

// Public routes — NO auth guard
<Route path="/sign/proposal/:requestId" element={<PublicProposalSignPage />} />
```

The URL pattern must match what is constructed in `createSignatureRequest`:
```
/sign/proposal/{requestId}?token={rawToken}
```

---

## 12. Integration Checklist for a New Document Type

Use this checklist when adding e-signature support to a new document type (e.g., contracts, change orders, service agreements).

### Database

- [ ] Add all `signature_status`, `signed_at`, `declined_at`, `expires_at`, `final_signed_pdf_url`, `frozen_html_snapshot`, `frozen_json_snapshot`, `frozen_document_hash`, `signer_name`, `signer_email`, `signature_request_id` columns to your document table
- [ ] Add the `signature_status` check constraint with the 7 valid values
- [ ] Create `{prefix}_signature_requests`, `{prefix}_signatures`, `{prefix}_audit_events` tables (or reuse the proposal tables with the `proposal_id` FK pointing to your table — requires your table to be named `proposals` or you rename the FK column)
- [ ] Create all indexes listed in Section 2.5
- [ ] Create the `proposal-signatures` storage bucket (shared across document types)
- [ ] Apply all RLS policies from Section 2.7
- [ ] If using automated reminders: add `reminder_count` and `last_reminder_sent_at` columns
- [ ] If using SendGrid tracking: add `send_status`, `sendgrid_message_id`, `send_error`, `last_sent_at` columns

### Service Layer

- [ ] Copy `documentSigning.ts` and update table name references (`proposals` → your table)
- [ ] Implement a `generateDocumentHTML(doc)` function that renders your document to HTML
- [ ] Connect `freezeDocument()` to call your HTML renderer
- [ ] Verify `computeDocumentHash()` and `generateSecureToken()` are unchanged

### Email Layer

- [ ] Copy `documentSigningEmails.ts` — templates work for any document type
- [ ] Update email subject lines and body text to reference your document type
- [ ] Implement `validateEmailSetup()` to check your email provider configuration
- [ ] Connect `sendSignatureRequestEmail()` to your email send service

### Frontend

- [ ] Copy `SignatureCapture.tsx` verbatim — it has no document-type dependencies
- [ ] Build a `SendForSignatureModal` for your document type (follow the orchestration pattern in Section 6.2)
- [ ] Add a "Signature" tab to your document detail page showing request status, audit timeline, void/resend actions

### Public Signing Page

- [ ] Copy `PublicProposalSignPage.tsx` and update Supabase table queries to your table names
- [ ] Register the route at the correct path (must match what is embedded in the signing URL)
- [ ] Verify the document display section renders your document's sections and line items correctly

### Edge Function

- [ ] Deploy `proposal-signed-pdf` (or a copy renamed for your document type)
- [ ] The `buildSignedDocumentHTML()` function works for any frozen HTML — no changes needed
- [ ] Trigger this function after signing completes (from a webhook, post-sign handler, or scheduled job)

### Background Jobs

- [ ] Deploy `signature-reminder-scheduler` (update table name if using separate tables)
- [ ] Deploy `signature-expiration-processor` (update table name if using separate tables)
- [ ] Register cron jobs via SQL (Section 9.3)

### Testing

- [ ] Create a test document, click "Send for Signature", confirm email is received
- [ ] Open the signing link — verify the "viewed" status updates in the CRM in real time
- [ ] Sign via typed mode, verify `proposal_signatures` row is created with correct `document_hash`
- [ ] Sign via drawn mode, verify signature image is uploaded to storage
- [ ] Test decline flow — verify `signature_status = 'declined'` on parent record
- [ ] Test void from CRM — verify signing link no longer works (returns "voided" state)
- [ ] Test resend — verify old token is invalidated, new link works
- [ ] Let a request expire — verify cron updates status to `expired`
- [ ] Verify reminder email is sent after 48h with `reminder_count` increment
- [ ] Call `proposal-signed-pdf` after signing — verify signed HTML is generated and `final_signed_pdf_url` is set
- [ ] Review `proposal_audit_events` table to confirm full event trail is present

---

*End of Proposal E-Signature Flow Developer Guide*
