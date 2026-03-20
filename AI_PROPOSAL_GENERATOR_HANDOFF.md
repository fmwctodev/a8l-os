# AI Proposal Generator -- Developer Handoff Document

> **Purpose:** This document describes the complete functional specification of the AI Proposal Generator feature so that another development team can rebuild it in a different CRM. It covers database schema, backend logic, AI generation, digital signatures, PDF export, email notifications, cron jobs, and frontend behavior.
>
> **Styling note:** This document intentionally omits all color values, CSS, and visual design details. The target team should apply their own CRM's existing design system, color scheme, and component library.

---

## Table of Contents

1. [Database Schema](#1-database-schema)
2. [Row-Level Security & Permissions](#2-row-level-security--permissions)
3. [Proposal CRUD Service Layer](#3-proposal-crud-service-layer)
4. [AI Generation Edge Function](#4-ai-generation-edge-function)
5. [Digital Signature System](#5-digital-signature-system)
6. [Cron Jobs](#6-cron-jobs)
7. [Signed PDF Generation](#7-signed-pdf-generation)
8. [Email Notifications](#8-email-notifications)
9. [PDF Export (Print)](#9-pdf-export-print)
10. [Frontend Pages & Component Behaviors](#10-frontend-pages--component-behaviors)
11. [TypeScript Type Definitions](#11-typescript-type-definitions)
12. [Environment Variables & External Dependencies](#12-environment-variables--external-dependencies)
13. [Adaptation Notes](#13-adaptation-notes)

---

## 1. Database Schema

### 1.1 `proposal_templates`

Stores reusable proposal templates per organization. A default template ("Professional Services Proposal") is seeded per org on first setup.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK, default `gen_random_uuid()` | |
| `org_id` | uuid | NOT NULL, FK -> organizations | |
| `name` | text | NOT NULL, UNIQUE(org_id, name) | |
| `description` | text | nullable | |
| `content` | text | NOT NULL, default `''` | Template content with `{{variable}}` placeholders |
| `category` | text | nullable | e.g. `'services'` |
| `is_default` | boolean | NOT NULL, default `false` | |
| `variables` | jsonb | NOT NULL, default `'[]'` | Array of `{key, label, type}` objects |
| `created_by` | uuid | NOT NULL, FK -> users | |
| `created_at` | timestamptz | NOT NULL, default `now()` | |
| `updated_at` | timestamptz | NOT NULL, default `now()` (trigger) | |

### 1.2 `proposals`

The core proposals table. Each proposal has a unique `public_token` (32 random hex bytes) for unauthenticated client access.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK, default `gen_random_uuid()` | |
| `org_id` | uuid | NOT NULL, FK -> organizations | |
| `contact_id` | uuid | NOT NULL, FK -> contacts ON DELETE CASCADE | |
| `opportunity_id` | uuid | nullable, FK -> opportunities ON DELETE SET NULL | |
| `title` | text | NOT NULL | |
| `status` | text | NOT NULL, default `'draft'`, CHECK IN (`draft`, `sent`, `viewed`, `accepted`, `rejected`, `expired`) | Proposal lifecycle status |
| `content` | text | NOT NULL, default `''` | Full proposal body (legacy, sections preferred) |
| `summary` | text | nullable | AI-generated executive summary |
| `total_value` | numeric(15,2) | NOT NULL, default `0` | Computed from line items |
| `currency` | text | NOT NULL, default `'USD'` | |
| `valid_until` | date | nullable | |
| `sent_at` | timestamptz | nullable | |
| `viewed_at` | timestamptz | nullable | First view timestamp |
| `responded_at` | timestamptz | nullable | When client accepted/rejected |
| `created_by` | uuid | NOT NULL, FK -> users | |
| `assigned_user_id` | uuid | nullable, FK -> users | |
| `template_id` | uuid | nullable, FK -> proposal_templates | |
| `ai_context` | jsonb | NOT NULL, default `'{}'` | Metadata about AI generation (see Section 4) |
| `public_token` | text | NOT NULL, UNIQUE, default `encode(gen_random_bytes(32), 'hex')` | For public/client viewing |
| `archived_at` | timestamptz | nullable | Soft-archive timestamp |
| `signature_status` | text | NOT NULL, default `'not_sent'`, CHECK IN (`not_sent`, `pending_signature`, `viewed`, `signed`, `declined`, `expired`, `voided`) | |
| `signed_at` | timestamptz | nullable | |
| `declined_at` | timestamptz | nullable | |
| `expires_at` | timestamptz | nullable | Signature expiration |
| `final_signed_pdf_url` | text | nullable | |
| `frozen_html_snapshot` | text | nullable | Immutable HTML at signature-send time |
| `frozen_json_snapshot` | jsonb | nullable | Immutable structured data at freeze time |
| `frozen_document_hash` | text | nullable | SHA-256 hash for tamper detection |
| `signer_name` | text | nullable | |
| `signer_email` | text | nullable | |
| `signature_request_id` | uuid | nullable | Currently active signature request |
| `created_at` | timestamptz | NOT NULL, default `now()` | |
| `updated_at` | timestamptz | NOT NULL, default `now()` (trigger) | |

### 1.3 `proposal_line_items`

Individual pricing line items attached to a proposal.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | |
| `org_id` | uuid | NOT NULL, FK -> organizations | |
| `proposal_id` | uuid | NOT NULL, FK -> proposals ON DELETE CASCADE | |
| `product_id` | uuid | nullable, FK -> products | Can link to product catalog |
| `name` | text | NOT NULL | |
| `description` | text | nullable | |
| `quantity` | numeric(15,4) | NOT NULL, default `1` | |
| `unit_price` | numeric(15,2) | NOT NULL, default `0` | |
| `discount_percent` | numeric(5,2) | NOT NULL, default `0` | Per-item discount |
| `sort_order` | integer | NOT NULL, default `0` | |
| `created_at` | timestamptz | NOT NULL, default `now()` | |

**Total calculation:** `SUM( quantity * unit_price * (1 - discount_percent/100) )`

### 1.4 `proposal_sections`

AI-generated or manually created content sections.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | |
| `org_id` | uuid | NOT NULL, FK -> organizations | |
| `proposal_id` | uuid | NOT NULL, FK -> proposals ON DELETE CASCADE | |
| `title` | text | NOT NULL | |
| `content` | text | NOT NULL, default `''` | HTML content |
| `section_type` | text | NOT NULL, default `'custom'`, CHECK IN (`intro`, `scope`, `deliverables`, `timeline`, `pricing`, `terms`, `custom`) | |
| `sort_order` | integer | NOT NULL, default `0` | |
| `ai_generated` | boolean | NOT NULL, default `false` | Whether AI created this section |
| `created_at` | timestamptz | NOT NULL, default `now()` | |
| `updated_at` | timestamptz | NOT NULL, default `now()` (trigger) | |

### 1.5 `proposal_comments`

Internal team comments and optional client comments on proposals.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | |
| `org_id` | uuid | NOT NULL, FK -> organizations | |
| `proposal_id` | uuid | NOT NULL, FK -> proposals ON DELETE CASCADE | |
| `user_id` | uuid | nullable, FK -> users | Internal commenter |
| `is_client_comment` | boolean | NOT NULL, default `false` | |
| `client_name` | text | nullable | |
| `content` | text | NOT NULL | |
| `created_at` | timestamptz | NOT NULL, default `now()` | |

### 1.6 `proposal_activities`

Audit trail of every action on a proposal.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | |
| `org_id` | uuid | NOT NULL, FK -> organizations | |
| `proposal_id` | uuid | NOT NULL, FK -> proposals ON DELETE CASCADE | |
| `activity_type` | text | NOT NULL, CHECK IN (`created`, `updated`, `sent`, `viewed`, `commented`, `status_changed`, `ai_generated`, `signature_sent`, `signature_viewed`, `signature_signed`, `signature_declined`, `signature_expired`, `signature_voided`) | |
| `description` | text | NOT NULL | Human-readable description |
| `metadata` | jsonb | NOT NULL, default `'{}'` | |
| `actor_user_id` | uuid | nullable, FK -> users | |
| `created_at` | timestamptz | NOT NULL, default `now()` | |

### 1.7 `proposal_signature_requests`

Tracks each signature request sent to a signer.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | |
| `org_id` | uuid | NOT NULL, FK -> organizations | |
| `proposal_id` | uuid | NOT NULL, FK -> proposals ON DELETE CASCADE | |
| `contact_id` | uuid | nullable, FK -> contacts | |
| `signer_name` | text | NOT NULL | |
| `signer_email` | text | NOT NULL | |
| `access_token_hash` | text | NOT NULL | SHA-256 hash of the raw access token |
| `status` | text | NOT NULL, default `'pending'`, CHECK IN (`pending`, `viewed`, `signed`, `declined`, `expired`, `voided`) | |
| `expires_at` | timestamptz | NOT NULL | |
| `viewed_at` | timestamptz | nullable | |
| `signed_at` | timestamptz | nullable | |
| `declined_at` | timestamptz | nullable | |
| `decline_reason` | text | nullable | |
| `created_by_user_id` | uuid | nullable, FK -> users | |
| `reminder_count` | integer | default `0` | Number of reminders sent |
| `last_reminder_sent_at` | timestamptz | nullable | |
| `send_status` | text | NOT NULL, default `'pending'`, CHECK IN (`pending`, `sent`, `failed`) | |
| `sendgrid_message_id` | text | nullable | For delivery tracking |
| `send_error` | text | nullable | |
| `last_sent_at` | timestamptz | nullable | |
| `created_at` | timestamptz | NOT NULL, default `now()` | |
| `updated_at` | timestamptz | NOT NULL, default `now()` (trigger) | |

### 1.8 `proposal_signatures`

Stores the actual captured signature data.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | |
| `org_id` | uuid | NOT NULL, FK -> organizations | |
| `proposal_id` | uuid | NOT NULL, FK -> proposals ON DELETE CASCADE | |
| `signature_request_id` | uuid | NOT NULL, FK -> proposal_signature_requests | |
| `signature_type` | text | NOT NULL, default `'drawn'`, CHECK IN (`typed`, `drawn`) | |
| `signature_text` | text | nullable | For typed signatures |
| `signature_image_url` | text | nullable | URL in object storage |
| `signer_name` | text | NOT NULL | |
| `signer_email` | text | NOT NULL | |
| `ip_address` | text | nullable | Captured for audit |
| `user_agent` | text | nullable | Captured for audit |
| `consent_text` | text | NOT NULL | The legal consent the signer agreed to |
| `signed_at` | timestamptz | NOT NULL, default `now()` | |
| `document_hash` | text | NOT NULL | SHA-256 of frozen HTML at sign time |
| `created_at` | timestamptz | NOT NULL, default `now()` | |

### 1.9 `proposal_audit_events`

Complete tamper-evident audit trail for signatures.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | |
| `org_id` | uuid | NOT NULL, FK -> organizations | |
| `proposal_id` | uuid | NOT NULL, FK -> proposals ON DELETE CASCADE | |
| `event_type` | text | NOT NULL | e.g. `sent_for_signature`, `viewed`, `signed`, `declined`, `voided`, `resent`, `proposal_signature_send_failed` |
| `actor_type` | text | NOT NULL, default `'system'`, CHECK IN (`system`, `user`, `signer`) | |
| `actor_id` | text | nullable | User ID or signer identifier |
| `metadata` | jsonb | default `'{}'` | |
| `created_at` | timestamptz | NOT NULL, default `now()` | |

### 1.10 `proposal_meeting_contexts` (junction table)

Links meeting transcriptions to proposals for AI context.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | PK |
| `org_id` | uuid | NOT NULL |
| `proposal_id` | uuid | FK -> proposals |
| `meeting_transcription_id` | uuid | FK -> meeting_transcriptions |
| `included_in_generation` | boolean | Whether it was used in AI generation |
| `created_at` | timestamptz | |

### 1.11 Storage Bucket

- **Bucket name:** `proposal-signatures`
- **Public:** Yes (signature images need to be accessible in signed PDFs)
- **File path pattern:** `{org_id}/{request_id}/signature.png`

### 1.12 Organization-Level Settings

Two columns added to the `organizations` table:

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `auto_advance_opportunity_on_signed` | boolean | `false` | Auto-advance linked opportunity when proposal is signed |
| `auto_create_project_on_signed` | boolean | `false` | Auto-create project from opportunity when proposal is signed |

### 1.13 Key Indexes

```
proposals: org_id, contact_id, opportunity_id, status, assigned_user_id, created_by, public_token, valid_until, signature_status
proposal_line_items: proposal_id, product_id, (proposal_id, sort_order)
proposal_sections: proposal_id, (proposal_id, sort_order), (proposal_id, section_type)
proposal_comments: proposal_id, created_at
proposal_activities: proposal_id, activity_type, created_at
proposal_signature_requests: proposal_id, access_token_hash, status, send_status (WHERE failed)
proposal_signatures: proposal_id, signature_request_id
proposal_audit_events: (proposal_id, created_at)
```

---

## 2. Row-Level Security & Permissions

### 2.1 RLS Helper Functions

Three helper functions drive proposal access control:

1. **`can_access_proposal(user_id, proposal_row)`**: Returns `true` if user's org matches proposal org AND (user hierarchy_level <= 2 OR user is creator/assignee).

2. **`can_access_proposal_by_id(user_id, proposal_id)`**: Looks up proposal by ID, then calls `can_access_proposal`.

3. **`is_proposal_admin(user_id)`**: Returns `true` if user's role has `hierarchy_level <= 2` (SuperAdmin or Admin).

### 2.2 Table Policies Summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `proposal_templates` | Org members | Admins only | Admins only | Admins only |
| `proposals` | Admins see all org; others see own/assigned | Creator must be auth.uid() | Same as SELECT | Admins only |
| `proposal_line_items` | Via `can_access_proposal_by_id` | Via `can_access_proposal_by_id` | Via `can_access_proposal_by_id` | Via `can_access_proposal_by_id` |
| `proposal_sections` | Via `can_access_proposal_by_id` | Via `can_access_proposal_by_id` | Via `can_access_proposal_by_id` | Via `can_access_proposal_by_id` |
| `proposal_comments` | Via `can_access_proposal_by_id` | Via access + user_id = auth.uid() | Own comments only | Own comments only |
| `proposal_activities` | Via `can_access_proposal_by_id` | Via `can_access_proposal_by_id` | N/A | N/A |
| `proposal_signature_requests` | Org members (authenticated); **Anon can also SELECT** (for public signing page) | Org members | Org members; **Anon can also UPDATE** (for signing/declining) | N/A |
| `proposal_signatures` | Org members | **Anon + Authenticated** (anyone can create, for public signing) | N/A | N/A |
| `proposal_audit_events` | Org members | **Anon + Authenticated** (anyone can create) | N/A | N/A |

### 2.3 Feature Flag

- Key: `proposals`
- Default: `true`

### 2.4 Permissions

| Permission Key | Description | SuperAdmin | Admin | Manager | Sales | Support |
|---------------|-------------|:---:|:---:|:---:|:---:|:---:|
| `proposals.view` | View proposals | Y | Y | Y | Y | Y |
| `proposals.create` | Create proposals | Y | Y | Y | Y | - |
| `proposals.edit` | Edit proposal content | Y | Y | Y | Y | - |
| `proposals.send` | Send proposals to clients | Y | Y | Y | Y | - |
| `proposals.delete` | Delete proposals | Y | Y | - | - | - |
| `proposals.ai_generate` | Use AI generation | Y | Y | Y | Y | - |
| `proposal_templates.manage` | Manage templates | Y | Y | Y | - | - |
| `meetings.view` | View meeting transcriptions | Y | Y | Y | Y | Y |
| `meetings.import` | Import from Google Meet | Y | Y | Y | Y | - |
| `meetings.edit` | Edit meeting notes | Y | Y | Y | Y | - |
| `meetings.delete` | Delete meetings | Y | Y | - | - | - |

---

## 3. Proposal CRUD Service Layer

### 3.1 Freeze Guard

Before every write operation (update, add/update/delete line items, add/update/delete/reorder sections), the service calls `assertNotFrozen(proposalId)`:

```
FROZEN_STATUSES = ['pending_signature', 'viewed', 'signed']

If proposal.signature_status is in FROZEN_STATUSES:
  throw Error("This proposal is locked for signing and cannot be edited.
  Void the signature request first to make changes.")
```

This is critical -- it prevents any data changes after a proposal has been sent for signature.

### 3.2 Data Query Pattern

All proposal queries use a standard "select with joins" pattern:

```
proposals.*
  + contact:contacts(*)
  + opportunity:opportunities(*)
  + created_by_user:users(*)
  + assigned_user:users(*)
  + template:proposal_templates(*)
  + line_items:proposal_line_items(*, product:products(*))
  + sections:proposal_sections(*)
  + meeting_contexts:proposal_meeting_contexts(*, meeting_transcription:meeting_transcriptions(*))
```

### 3.3 Operations

| Operation | Behavior |
|-----------|----------|
| **getProposals** | Paginated list (default 25/page). Filters: status array, contactId, opportunityId, assignedUserId, createdAfter/Before, search (title ILIKE), includeArchived. Default: excludes archived. Ordered by `updated_at` DESC. |
| **getProposalById** | Single proposal with all joins. Uses `maybeSingle()`. |
| **getProposalByToken** | Lookup by `public_token` for public/client access. |
| **getProposalsByContact** | All proposals for a contact, ordered by `created_at` DESC. |
| **getProposalsByOpportunity** | All proposals for an opportunity. |
| **createProposal** | Inserts with defaults (status: `'draft'`, total_value: `0`, currency: `'USD'`). Logs `'created'` activity. |
| **updateProposal** | Calls `assertNotFrozen` first. Updates allowed fields. Logs `'updated'` activity. |
| **updateProposalStatus** | Sets status + relevant timestamp (sent_at, viewed_at, responded_at). Logs `'status_changed'` activity. Emits events: `proposal.sent`, `proposal.viewed`, `proposal.accepted`, `proposal.declined`. |
| **sendProposal** | Shorthand for `updateProposalStatus(id, 'sent', userId)`. |
| **deleteProposal** | Hard delete. Cascades to line items, sections, etc. |
| **duplicateProposal** | Creates copy with `"Copy of {title}"`, status `'draft'`, null valid_until. Duplicates all sections, line items, and meeting contexts. |
| **archiveProposal** | Sets `archived_at = now()`. |
| **unarchiveProposal** | Sets `archived_at = null`. |
| **getProposalStats** | Returns aggregate counts by status, total/accepted/signed value, conversion rate. |

### 3.4 Line Item Operations

All call `assertNotFrozen` first.

| Operation | Notes |
|-----------|-------|
| **addProposalLineItem** | Can link to product catalog via `product_id` |
| **updateProposalLineItem** | Looks up proposal_id from item first to check freeze |
| **deleteProposalLineItem** | Same freeze check pattern |
| **calculateProposalTotal** | `SUM(qty * price * (1 - discount/100))` |
| **recalculateAndUpdateProposalTotal** | Calculates + updates `proposals.total_value` |

### 3.5 Section Operations

All call `assertNotFrozen` first.

| Operation | Notes |
|-----------|-------|
| **addProposalSection** | section_type defaults to `'custom'`, ai_generated defaults to `false` |
| **updateProposalSection** | Looks up proposal_id from section first to check freeze |
| **deleteProposalSection** | Same freeze check pattern |
| **reorderProposalSections** | Takes array of section IDs, sets sort_order = array index |

### 3.6 Comments & Activities

| Operation | Notes |
|-----------|-------|
| **getProposalComments** | Ordered by `created_at` ASC (chronological). Joins user. |
| **addProposalComment** | Can be internal (user_id) or client (is_client_comment + client_name) |
| **deleteProposalComment** | RLS ensures only own comments |
| **getProposalActivities** | Ordered by `created_at` DESC (newest first). Joins actor user. |
| **createProposalActivity** | Used internally by all operations for audit trail |

### 3.7 Meeting Context

| Operation | Notes |
|-----------|-------|
| **linkMeetingToProposal** | Creates junction record in `proposal_meeting_contexts` |
| **unlinkMeetingFromProposal** | Deletes junction record |

### 3.8 Event Emission

On status changes, the service emits events via an event dispatcher:

```
status 'sent'     -> event 'proposal.sent'
status 'viewed'   -> event 'proposal.viewed'
status 'accepted' -> event 'proposal.accepted'
status 'rejected' -> event 'proposal.declined'
status 'signed'   -> event 'proposal.accepted'
```

Payload: `{ entityType: 'proposal', entityId, orgId, data: { contact_id, opportunity_id, total_value, status } }`

These events can trigger workflows/automations.

---

## 4. AI Generation Edge Function

### 4.1 Endpoint

- **Path:** `/functions/v1/proposal-ai-generate`
- **Method:** POST
- **Auth:** Bearer token (user JWT or service role key)

### 4.2 Request Payload

```typescript
{
  proposal_id: string;        // Required
  contact_id: string;         // Required
  user_id: string;            // Required
  opportunity_id?: string;
  meeting_ids?: string[];     // Meeting transcription IDs to use as context
  template_id?: string;       // Proposal template to follow
  custom_instructions?: string;
  sections_to_generate: ('intro' | 'scope' | 'deliverables' | 'timeline' | 'pricing' | 'terms')[];
  include_contact_history?: boolean;
  include_opportunity_data?: boolean;
  uploaded_documents?: { name: string; text: string }[];
}
```

### 4.3 Data Gathering

The edge function gathers extensive context before calling the LLM:

1. **Proposal + Contact**: Fetches from DB with all relations
2. **Opportunity** (if `include_opportunity_data` + `opportunity_id`): Fetches with pipeline name and stage name
3. **Meetings** (if `meeting_ids` provided): Fetches meeting_title, meeting_date, summary, key_points, action_items, recording_url, transcript_text. **Transcript is truncated to 4000 characters** if longer.
4. **Contact History** (if `include_contact_history`): Last 5 contact notes + last 10 timeline events
5. **Template** (if `template_id`): Template content for structural guidance
6. **Organization name**
7. **Active Brand Kit**: Fetches active, non-archived brand kit with its latest version (colors)
8. **Active Brand Voice**: Fetches active, non-archived brand voice with its latest version (tone_settings, dos/donts, vocabulary)
9. **LLM Providers**: Fetches all enabled providers for the org, ordered by creation date

### 4.4 System Prompt Construction

The system prompt is built dynamically:

```
Base persona: "You are a professional proposal writer for {companyName}..."

+ Brand Voice (if available):
  - Tone Settings (formality, friendliness, energy, confidence thresholds at 0.5)
  - Do's list
  - Don'ts list
  - Preferred vocabulary
  - Prohibited vocabulary

+ Brand Colors (if available):
  - Primary hex
  - Secondary hex

+ Template Structure (if available):
  - Full template content as reference

+ Output Format instruction:
  "Return a JSON array of sections, each with:
    - section_type: one of (intro, scope, deliverables, timeline, pricing, terms)
    - title: section heading
    - content: the section content in HTML format (use <p>, <h3>, <ul>, <li> tags)"

+ "You MUST respond with valid JSON only."
```

### 4.5 User Prompt Construction

```
"Generate proposal content for the following sections: {types}"

Client Information:
  - Name, Company, Title, Email

Deal Information (if included):
  - Value, Currency, Pipeline, Stage, Source

Meeting Context (for each meeting):
  - Title, Date, Summary, Key Points, Action Items
  - Transcript (truncated to 4000 chars)

Uploaded Document Context (for each doc):
  - Document name + full text content

Contact History (if included):
  - Recent Notes (up to 5)
  - Recent Activity (up to 10 timeline events)

Additional Instructions (if provided):
  - Custom user instructions verbatim
```

### 4.6 LLM Call

- **API:** Anthropic Claude (`https://api.anthropic.com/v1/messages`)
- **Model:** Configured via `CLARA_MODEL_HEAVY` constant (your team should use your preferred model)
- **Temperature:** `0.7`
- **Max tokens:** `8192`
- **Provider fallback:** Iterates through all enabled LLM providers for the org. If one fails, tries the next. Uses each provider's default model (or first available model).

### 4.7 Response Parsing

1. **Primary:** Parse response as JSON -> extract `parsed.sections || parsed` (handles both `{sections: [...]}` and `[...]`)
2. **Fallback (if JSON parse fails):** Parse as markdown using `## heading` regex matches -> each match becomes a section with type `'custom'`
3. **Final fallback:** If no sections found, wraps entire response as a single `'custom'` section titled "Generated Content"

### 4.8 Post-Generation

After successful generation:

1. Insert each generated section into `proposal_sections` with `ai_generated: true`, incrementing `sort_order` from the current max
2. Update `proposals.ai_context` with metadata:
   ```json
   {
     "meetings_used": ["id1", "id2"],
     "uploaded_documents": ["doc1.pdf"],
     "contact_history_included": true,
     "opportunity_data_included": true,
     "custom_instructions": "...",
     "generated_at": "2024-01-15T..."
   }
   ```
3. Log activity: type `'ai_generated'`, metadata includes `sections_generated` types and `meetings_used` count

### 4.9 Response

```json
{
  "success": true,
  "sections_generated": 4,
  "sections": [
    { "section_type": "intro", "title": "Introduction", "content": "<p>...</p>" }
  ]
}
```

---

## 5. Digital Signature System

### 5.1 Overview

The signature system follows this flow:

```
1. Freeze proposal (create immutable snapshot)
2. Create signature request (generate secure token)
3. Send email with signing link
4. Signer opens link -> verify token -> mark as viewed
5. Signer signs or declines
6. On sign: upload signature image, record signature, update statuses
```

### 5.2 Cryptographic Operations

**Document Hash:**
```
SHA-256 via crypto.subtle.digest()
Input: string (e.g., frozen HTML)
Output: hex-encoded hash string
```

**Secure Token Generation:**
```
1. Generate 32 random bytes via crypto.getRandomValues()
2. Convert to hex string (64 characters) = raw token
3. Compute SHA-256 hash of raw token = token hash
4. Store ONLY the hash in the database
5. Send raw token in the signing URL
```

### 5.3 Freeze Proposal

When a proposal is sent for signature, it is "frozen":

1. Fetch proposal with contact, opportunity, line_items, sections
2. Fetch active brand kit for the org
3. Generate full HTML document from proposal data (via `generateProposalHTML`)
4. Create JSON snapshot:
   ```json
   {
     "title": "...",
     "total_value": 5000,
     "currency": "USD",
     "summary": "...",
     "contact": { "first_name", "last_name", "email", "company" },
     "sections": [{ "title", "content", "section_type", "sort_order" }],
     "line_items": [{ "name", "description", "quantity", "unit_price", "discount_percent" }]
   }
   ```
5. Compute SHA-256 hash of the HTML snapshot
6. Store `frozen_html_snapshot`, `frozen_json_snapshot`, `frozen_document_hash` on the proposal

### 5.4 Create Signature Request

1. Generate secure token (raw + hash)
2. Calculate expiration date (`now + expiresInDays`)
3. Insert `proposal_signature_requests` record with token hash
4. Update proposal: `signature_status = 'pending_signature'`, `expires_at`, `signature_request_id`, `signer_name`, `signer_email`
5. Create audit event: `sent_for_signature`
6. Build signing URL: `{origin}/sign/proposal/{request.id}?token={rawToken}`
7. Return: `{ request, rawToken, signingUrl }`

### 5.5 Token Verification

To verify a signing link:
1. Hash the raw token from the URL query parameter
2. Look up `proposal_signature_requests` where `id = requestId AND access_token_hash = computedHash`
3. If found, token is valid

### 5.6 Mark as Viewed

On first access to the signing page:
1. Check if `viewed_at` is null (only mark first view)
2. Update request: `viewed_at = now(), status = 'viewed'`
3. Update proposal: `signature_status = 'viewed'` (only if currently `'pending_signature'`)
4. Create audit event: `viewed`

### 5.7 Submit Signature

1. Insert `proposal_signatures` record with all captured data:
   - `signature_type` (`'typed'` or `'drawn'`)
   - `signature_text` (for typed)
   - `signature_image_url` (uploaded PNG)
   - `signer_name`, `signer_email`
   - `ip_address`, `user_agent`
   - `consent_text` (the legal agreement text)
   - `document_hash` (SHA-256 of frozen HTML, verified at sign time)
2. Update request: `status = 'signed'`, `signed_at = now()`
3. Update proposal: `signature_status = 'signed'`, `signed_at = now()`
4. Create audit event: `signed` (includes IP, user agent, document hash)

### 5.8 Decline Signature

1. Update request: `status = 'declined'`, `declined_at = now()`, `decline_reason`
2. Update proposal: `signature_status = 'declined'`, `declined_at = now()`
3. Create audit event: `declined`

### 5.9 Void Signature Request

An internal user can void an active signature request to unlock the proposal for editing:

1. Update request: `status = 'voided'`
2. Update proposal: `signature_status = 'voided'`
3. Create audit event: `voided`

After voiding, `assertNotFrozen` will no longer block edits.

### 5.10 Resend Signature Request

1. Generate a new secure token (raw + hash)
2. Update existing request: `access_token_hash = newHash`, `viewed_at = null`, `status = 'pending'`
3. Update proposal: `signature_status = 'pending_signature'`
4. Create audit event: `resent`
5. Return new signing URL

### 5.11 Signature Image Upload

- Converts base64 data URL to Blob
- Uploads to `proposal-signatures` bucket at path `{orgId}/{requestId}/signature.png`
- Returns public URL

---

## 6. Cron Jobs

### 6.1 Signature Reminder Scheduler

- **Schedule:** Every 6 hours (`0 */6 * * *`)
- **Edge function:** `signature-reminder-scheduler`
- **Auth:** Service role key (no JWT verification)
- **Logic:**
  - Find all signature requests where:
    - `status` IN (`pending`, `viewed`)
    - `expires_at > now()` (not yet expired)
    - `reminder_count < 3`
    - `last_reminder_sent_at` is null OR > 48 hours ago
  - For each eligible request:
    - Generate new signing URL (resend creates new token)
    - Send reminder email via `buildSignatureReminderEmail`
    - Increment `reminder_count`
    - Set `last_reminder_sent_at = now()`

### 6.2 Signature Expiration Processor

- **Schedule:** Every hour at minute 15 (`15 * * * *`)
- **Edge function:** `signature-expiration-processor`
- **Auth:** Service role key (no JWT verification)
- **Logic:**
  - Find all signature requests where:
    - `status` IN (`pending`, `viewed`)
    - `expires_at <= now()`
  - For each expired request:
    - Update request: `status = 'expired'`
    - Update proposal: `signature_status = 'expired'`
    - Create audit event: `expired`
    - Log activity: `signature_expired`

---

## 7. Signed PDF Generation

### 7.1 Edge Function: `proposal-signed-pdf`

After a proposal is signed, a signed PDF can be generated:

1. Fetch the frozen HTML snapshot from the proposal
2. Inject the signature image, signer name, signed date, and document hash into the acceptance section of the frozen HTML
3. Generate PDF from the modified HTML
4. Upload to `proposal-signatures` storage bucket
5. Update `proposals.final_signed_pdf_url`

---

## 8. Email Notifications

### 8.1 Email Setup Validation

Before sending any signature email, the system validates:

1. **SendGrid configured:** Checks email provider setup status
2. **From address resolved:** Tries org's default from address, falls back to first active `email_from_addresses`
3. Returns `{ ready: boolean, fromAddress, blockingReasons[] }`

If email is not configured, the UI disables the "Preview Email" button and shows a warning.

### 8.2 Email Templates

Four email template builders (all return HTML strings):

#### Signature Request Email
- **Subject:** `"Please review and sign: {proposalTitle}"`
- **Content:** Greeting -> explanation -> proposal info card (title + optional total value) -> "Review & Sign" CTA button -> expiration notice -> footer

#### Signature Reminder Email
- **Content:** Greeting -> reminder text -> urgency warning card (days remaining, "expires tomorrow" if <= 1 day) -> proposal card -> "Review & Sign Now" CTA -> footer

#### Signature Completion Email (to signer)
- **Content:** Success checkmark -> "Document Signed Successfully" heading -> confirmation text -> optional "Download Signed PDF" button -> footer

#### Internal Notification Email (to team)
- **Content:** "Proposal Signed" success banner -> "{signerName} has signed {proposalTitle}" -> signed-at timestamp -> "View Proposal" CTA

### 8.3 Send Flow

```
1. validateEmailSetup(orgId)
2. If not ready -> return { success: false, error, blockingReasons }
3. Build HTML via buildSignatureRequestEmail()
4. Send via SendGrid (trackOpens: true, trackClicks: true, transactional: true)
5. Return { success: true, messageId } or { success: false, error }
```

### 8.4 Send Status Tracking

After send attempt:
- Update `proposal_signature_requests`:
  - `send_status` = `'sent'` or `'failed'`
  - `sendgrid_message_id` (for delivery correlation)
  - `send_error` (on failure)
  - `last_sent_at` (on success)

---

## 9. PDF Export (Print)

### 9.1 HTML Generation

The `generateProposalHTML` function creates a complete A4-formatted HTML document for printing:

**Structure:**
1. **Cover Page** (page break after)
   - Company logo + name
   - Status badge
   - Proposal title + subtitle
   - 2x2 metadata grid: proposal number, date prepared, valid until, prepared by
   - "Prepared For" card: contact name, company, email, phone
   - "Prepared By" card: your company info

2. **Sections Flow** (continuous, auto page breaks)
   - Each section gets a numbered header (01, 02, etc.) with icon and title
   - Section content in a card container
   - List items get checkmark icons prepended
   - Pricing section (if line items exist) rendered as a table with per-item totals, subtotal, and total investment

3. **Acceptance Page** (page break before)
   - Intro text about signing agreement
   - Client signature block (dashed line, name, title, date fields)
   - Company signature block
   - Contact footer
   - Confidentiality notice

**Key behaviors:**
- Uses brand kit accent color (falls back to a default)
- Uses brand kit logo URL if available
- Generates a proposal number from the proposal ID: `PROP-{year}-{numericPart}`
- All user-provided text is HTML-escaped

### 9.2 Export Function

```
exportProposalToPDF(proposal, brandKit):
  1. Generate HTML via generateProposalHTML()
  2. Open new browser window
  3. Write HTML to window
  4. On load, trigger window.print() after 300ms delay
```

This uses the browser's native print-to-PDF capability.

### 9.3 Section Icons

Each section type has a corresponding SVG icon (intro, scope, deliverables, timeline, pricing, terms, custom). These are inline SVGs.

### 9.4 Hardcoded Company Info (MUST REPLACE)

The PDF export currently contains a hardcoded `COMPANY` object:

```javascript
const COMPANY = {
  name: 'Autom8ion Lab',
  email: 'info@autom8ionlab.com',
  phone: '(855) 508-6062',
  website: 'autom8ionlab.com',
};
```

**You MUST replace this with your organization's info**, ideally loaded dynamically from the organization record. The acceptance page signature label also references "AUTOM8TION LAB" and must be replaced.

---

## 10. Frontend Pages & Component Behaviors

### 10.1 Page: Proposals List (`/proposals`)

- **Stats bar** at top: total proposals, draft/sent/viewed/accepted/rejected counts, total value, accepted value, conversion rate
- **Signature status badges** shown alongside proposal status (e.g., "Awaiting Signature", "Signed")
- **Filters:** status dropdown (multi-select), search by title, tab for "Active" vs "Archived"
- **Actions per row:** View, Send, Export PDF, Duplicate, Copy Public Link, Delete
- **Create button** opens CreateProposalModal

### 10.2 Page: Create Proposal Modal

Two-step wizard:

**Step 1 - Select Contact:**
- Search field with typeahead
- Contact list with avatars (initials), name, company/email
- "New Contact" button with inline create form
- Click contact to proceed

**Step 2 - Configure Details:**
- Selected contact shown with "Change" option
- Title field (auto-populated: `"Proposal for {company or name}"`)
- Opportunity dropdown (only open opportunities for this contact)
- Template grid (2-column, selectable cards)
- Valid Until date picker
- Submit navigates to `/proposals/{id}/build`

### 10.3 Page: Proposal Builder (`/proposals/:id/build`)

Four-step wizard:

**Step 1 - Context ("meetings"):**
- **Document upload zone:** Drag & drop or click, accepts PDF/DOCX/TXT, max 10MB per file. Extracts text using file parser. Shows file list with remove buttons.
- **Contact meetings list:** Meetings linked to the contact, with title, date, summary, key points. Selectable with checkboxes.
- **Google Meet recordings:** Shows Drive connection status. Sync button to fetch recordings. Search recordings. Click to enrich (AI summarize). Shows processing state with spinner.

**Step 2 - Sections ("sections"):**
- 6 section type checkboxes:
  - Introduction (default ON)
  - Scope of Work (default ON)
  - Deliverables (default ON)
  - Timeline
  - Pricing (default ON)
  - Terms & Conditions
- Each has label + short description

**Step 3 - Generate ("generate"):**
- Summary of selected context sources (document count, meeting count)
- Selected sections list
- Checkbox: "Include contact history (notes and timeline)"
- Checkbox: "Include opportunity data (pipeline, stage, value)"
- Textarea: "Custom instructions for the AI"
- "Generate Proposal" button
- Loading state: spinner + "Generating your proposal with AI..."

**Step 4 - Review ("review"):**
- Success message with section count
- "Generate More Sections" button (returns to step 1)
- "View Proposal" button (navigates to `/proposals/{id}`)

### 10.4 Page: Proposal Detail (`/proposals/:id`)

Full proposal view with multiple tabs:

**Header:**
- Back button, title, status badge, signature status badge
- Actions: Export PDF, Send, Send for Signature, Convert to Invoice, Duplicate, Archive/Unarchive, Delete
- "More" dropdown for secondary actions

**Tabs:**

1. **Content tab:**
   - Editable sections (drag to reorder, inline edit title/content, delete)
   - "Add Section" button
   - Each section shows type badge and AI-generated badge if applicable

2. **Line Items tab:**
   - Table: name, description, quantity, unit price, discount %, total
   - Add/edit/delete items
   - Auto-recalculate total

3. **Signature tab** (visible when signature_status != 'not_sent'):
   - Current signature status with timeline
   - Signer info (name, email)
   - Actions: Void, Resend
   - Audit event log

4. **Comments tab:**
   - Chronological thread
   - Add comment form

5. **Activity tab:**
   - Activity feed (newest first)
   - Shows actor, type, description, timestamp

### 10.5 Page: Public Proposal View (`/p/:token`)

Unauthenticated page for clients to view their proposal:
- Fetches proposal by `public_token`
- Shows proposal title, sections, line items
- Read-only view

### 10.6 Page: Public Signing Page (`/sign/proposal/:requestId?token=`)

Unauthenticated page where signers review and sign:

**Page States:**
- `loading`: Token verification in progress
- `invalid`: Token hash doesn't match
- `expired`: Request past expiration date
- `already_signed`: Request already signed
- `declined`: Already declined
- `voided`: Request was voided
- `ready`: Ready for review/signing
- `signing`: Signature submission in progress
- `signed`: Successfully signed (confirmation view)
- `decline_form`: Showing decline reason form

**Ready state display:**
- Company branding header
- Proposal title + total value
- Expandable section accordion (click section header to expand/collapse)
- Line items with pricing table
- Signature capture component (see below)
- Consent checkbox: `"I, {name}, agree to electronically sign this document..."`
- "Sign Document" button
- "Decline to Sign" link

**Signature capture** (dual mode):
- **Type mode:** Text input -> Preview rendered in serif italic font -> Rendered to offscreen canvas -> PNG data URL
  - Font: Georgia, "Times New Roman", serif, italic, 52px
  - Canvas: 600x200, white background, dark text, centered
- **Draw mode:** HTML5 canvas with mouse + touch support
  - Stroke: 2.5px, round line caps/joins
  - Clear button (X icon, top-right)
  - Touch events with `touch-none` CSS for proper mobile handling
- Both modes output: `{ type: 'typed' | 'drawn', text?: string, imageDataUrl: string }`

**On sign:**
1. Upload signature PNG to storage -> get public URL
2. Compute document hash from `frozen_html_snapshot`
3. Call `submitSignature` with all data (type, text, image URL, name, email, IP, user agent, consent text, hash)
4. Show confirmation screen

**On decline:**
1. Show textarea for optional decline reason
2. Call `declineSignature`
3. Show confirmation

### 10.7 Component: SendForSignatureModal

Four-step modal flow:

**Step 1 - Form:**
- Proposal info summary (title, value)
- Signer name (pre-filled from contact)
- Signer email (pre-filled from contact email)
- Expiration dropdown: 7, 14, 30, 60, 90 days (default: 14)
- Email readiness check (validates SendGrid config on mount)
- "What happens next" info card
- "Preview Email" button (disabled if email not configured)

**Step 2 - Preview:**
- From/To/Subject display
- Rendered HTML email preview (in white container with `dangerouslySetInnerHTML`)
- Note: "The signing link in the preview is a placeholder"
- Back button + "Send for Signature" button

**Step 3 - Freezing:**
- Spinner + "Freezing proposal content..."
- "Creating an immutable snapshot for signing"

**Step 4 - Sending:**
- Spinner + "Sending signature request via SendGrid..."

**On success:** calls `onSent` callback
**On failure:** shows error, returns to form step

### 10.8 Component: ConvertToInvoiceModal

Converts a proposal to an invoice:

- Shows proposal details (title, contact, opportunity)
- Line items table with discount calculations
- Due date input (default: 30 days from today)
- Auto-send checkbox
- "What happens next" info
- Maps proposal line items to invoice format:
  - `product_id`, `description` (falls back to `name`), `quantity`, `unit_price`
  - Sets `discount_amount: 0`, `discount_type: 'flat'`
  - Adds memo: `"Converted from proposal: {title}"`
  - Adds internal note: `"Source proposal ID: {id}"`
- On success: navigates to `/payments/invoices/{invoiceId}`

---

## 11. TypeScript Type Definitions

```typescript
type ProposalStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected'
  | 'expired' | 'signed' | 'declined' | 'voided';

type ProposalSignatureStatus = 'not_sent' | 'pending_signature' | 'viewed'
  | 'signed' | 'declined' | 'expired' | 'voided';

type ProposalSectionType = 'intro' | 'scope' | 'deliverables' | 'timeline'
  | 'pricing' | 'terms' | 'custom';

type ProposalActivityType = 'created' | 'updated' | 'sent' | 'viewed'
  | 'commented' | 'status_changed' | 'ai_generated'
  | 'signature_sent' | 'signature_viewed' | 'signature_signed'
  | 'signature_declined' | 'signature_expired' | 'signature_voided';

interface ProposalTemplate {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  content: string;
  category: string | null;
  is_default: boolean;
  variables: { key: string; label: string; type: 'text'|'textarea'|'number'|'date'|'select'; options?: string[] }[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface Proposal {
  id: string;
  org_id: string;
  contact_id: string;
  opportunity_id: string | null;
  title: string;
  status: ProposalStatus;
  content: string;
  summary: string | null;
  total_value: number;
  currency: string;
  valid_until: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  responded_at: string | null;
  archived_at: string | null;
  created_by: string;
  assigned_user_id: string | null;
  template_id: string | null;
  ai_context: {
    meetings_used?: string[];
    contact_history_included?: boolean;
    opportunity_data_included?: boolean;
    custom_instructions?: string;
    generated_at?: string;
  };
  public_token: string;
  signature_status: ProposalSignatureStatus;
  signed_at: string | null;
  declined_at: string | null;
  expires_at: string | null;
  final_signed_pdf_url: string | null;
  frozen_html_snapshot: string | null;
  frozen_json_snapshot: Record<string, unknown> | null;
  frozen_document_hash: string | null;
  signer_name: string | null;
  signer_email: string | null;
  signature_request_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined relations
  contact?: Contact;
  opportunity?: Opportunity | null;
  template?: ProposalTemplate | null;
  line_items?: ProposalLineItem[];
  sections?: ProposalSection[];
  meeting_contexts?: ProposalMeetingContext[];
}

interface ProposalLineItem {
  id: string;
  org_id: string;
  proposal_id: string;
  product_id: string | null;
  name: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  sort_order: number;
  created_at: string;
  product?: Product | null;
}

interface ProposalSection {
  id: string;
  org_id: string;
  proposal_id: string;
  title: string;
  content: string;
  section_type: ProposalSectionType;
  sort_order: number;
  ai_generated: boolean;
  created_at: string;
  updated_at: string;
}

interface ProposalComment {
  id: string;
  org_id: string;
  proposal_id: string;
  user_id: string | null;
  is_client_comment: boolean;
  client_name: string | null;
  content: string;
  created_at: string;
}

interface ProposalActivity {
  id: string;
  org_id: string;
  proposal_id: string;
  activity_type: ProposalActivityType;
  description: string;
  metadata: Record<string, unknown>;
  actor_user_id: string | null;
  created_at: string;
}

interface ProposalFilters {
  status?: ProposalStatus[];
  contactId?: string;
  opportunityId?: string;
  assignedUserId?: string;
  createdAfter?: string;
  createdBefore?: string;
  search?: string;
  includeArchived?: boolean;
}

interface ProposalStats {
  totalProposals: number;
  draftCount: number;
  sentCount: number;
  viewedCount: number;
  acceptedCount: number;
  rejectedCount: number;
  signedCount: number;
  signedValue: number;
  totalValue: number;
  acceptedValue: number;
  conversionRate: number;
}

interface ProposalSignatureRequest {
  id: string;
  org_id: string;
  proposal_id: string;
  contact_id: string | null;
  signer_name: string;
  signer_email: string;
  access_token_hash: string;
  status: 'pending' | 'viewed' | 'signed' | 'declined' | 'expired' | 'voided';
  expires_at: string;
  viewed_at: string | null;
  signed_at: string | null;
  declined_at: string | null;
  decline_reason: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  send_status: 'pending' | 'sent' | 'failed';
  sendgrid_message_id: string | null;
  send_error: string | null;
  last_sent_at: string | null;
  reminder_count: number;
  last_reminder_sent_at: string | null;
}

interface ProposalSignature {
  id: string;
  org_id: string;
  proposal_id: string;
  signature_request_id: string;
  signature_type: 'typed' | 'drawn';
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

interface ProposalAuditEvent {
  id: string;
  org_id: string;
  proposal_id: string;
  event_type: string;
  actor_type: 'system' | 'user' | 'signer';
  actor_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface ProposalMeetingContext {
  id: string;
  org_id: string;
  proposal_id: string;
  meeting_transcription_id: string;
  included_in_generation: boolean;
  created_at: string;
  meeting_transcription?: MeetingTranscription;
}
```

---

## 12. Environment Variables & External Dependencies

### 12.1 Required Environment Variables (Edge Functions)

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (for cron jobs and server-side operations) |

### 12.2 External Services

| Service | Purpose | Required |
|---------|---------|----------|
| **Anthropic Claude API** | AI proposal content generation | Yes (or substitute another LLM) |
| **SendGrid** | Transactional email delivery | Yes (for signature emails) |
| **Supabase Storage** | Signature image storage | Yes |
| **Supabase pg_cron** | Scheduled reminder/expiration jobs | Yes |

### 12.3 LLM Configuration

The system supports **multiple LLM providers** per organization:
- Stored in `llm_providers` table (with `api_key_encrypted`, `provider` type, `enabled` flag)
- Each provider has `llm_models` (with `model_key`, `is_default`)
- The AI generation function iterates providers in creation order, using the default model for each
- On failure, falls back to the next provider

The current implementation always calls Anthropic's API endpoint regardless of the provider field. Your team should adapt the `callLLM` function to properly route to different providers based on the `provider` field.

### 12.4 Brand Integration Dependencies

The AI generation optionally uses:
- `brand_kits` + `brand_kit_versions` (for colors referenced in prompts)
- `brand_voices` + `brand_voice_versions` (for tone, dos/donts, vocabulary)

If your CRM doesn't have a brand management system, you can skip this or hardcode defaults.

### 12.5 Meeting Transcription Dependencies

The builder optionally uses:
- `meeting_transcriptions` table (meeting title, date, summary, key points, action items, transcript text)
- Google Drive integration for Meet recording sync/enrichment

If your CRM doesn't have meeting transcription features, the AI builder's "Context" step can be simplified to just document upload.

---

## 13. Adaptation Notes

### 13.1 What to Replace

| Current Implementation | What to Change |
|-----------------------|----------------|
| Hardcoded `COMPANY` object in PDF export | Load dynamically from organization record |
| "AUTOM8TION LAB" label in acceptance page | Use organization name |
| "Secured by Autom8ion Lab" footer on signing page | Replace with your branding |
| Dark theme CSS in PDF export | Use your own print styles |
| Anthropic-only API call in `callLLM` | Implement proper multi-provider routing |
| `CLARA_MODEL_HEAVY` constant | Use your preferred model configuration |
| All Tailwind CSS classes and color values | Use your CRM's design system |
| Icon imports from `lucide-react` | Use your CRM's icon library |

### 13.2 Core Behaviors to Preserve

These are the critical functional behaviors that must be maintained:

1. **Freeze guard:** NEVER allow edits when `signature_status` is `pending_signature`, `viewed`, or `signed`. Only `voidSignatureRequest` unlocks editing.

2. **Token security:** Raw tokens are NEVER stored in the database. Only SHA-256 hashes are stored. The raw token exists only in the signing URL.

3. **Document integrity:** The frozen HTML snapshot is hashed. The hash is verified at sign time to prove the document wasn't tampered with.

4. **Audit trail:** Every signature-related action must be logged in `proposal_audit_events` with accurate `actor_type` (system/user/signer), IP address, and user agent where applicable.

5. **Consent capture:** The signer must explicitly check a consent checkbox. The consent text is stored in the signature record.

6. **Public page authentication:** The signing page (`/sign/proposal/:requestId?token=`) must work without any user authentication. Token verification is the sole access control.

7. **First-view tracking:** `markRequestViewed` should only fire once (checks `viewed_at` is null). Subsequent visits should not re-trigger.

8. **Reminder rate limiting:** Max 3 reminders per request, minimum 48 hours between each.

9. **Expiration processing:** Expired requests must be caught by the cron job and have their statuses updated.

10. **Total recalculation:** After any line item change, the proposal's `total_value` should be recalculated.

### 13.3 Suggested Improvements (Optional)

These are not in the current implementation but may be worth adding:

- Server-side PDF generation (e.g., Puppeteer/Playwright) instead of browser print
- Multi-signer support (current: single signer per proposal)
- Countersignature (company side signs after client)
- Webhook notifications for signature events
- Version history for proposal content changes
- PDF watermark for draft/unsigned copies
- Batch proposal operations

### 13.4 Route Map

| Route | Auth | Component | Purpose |
|-------|------|-----------|---------|
| `/proposals` | Authenticated | Proposals | List all proposals |
| `/proposals/:id` | Authenticated | ProposalDetail | View/edit single proposal |
| `/proposals/:id/build` | Authenticated | ProposalBuilder | 4-step AI generation wizard |
| `/p/:token` | Public | PublicProposalPage | Client views proposal |
| `/sign/proposal/:requestId` | Public | PublicProposalSignPage | Client signs/declines |

### 13.5 File Organization Reference

```
services/
  proposals.ts             -- CRUD, line items, sections, comments, activities
  proposalSigning.ts       -- Freeze, tokens, signature submit/decline/void
  proposalPdfExport.ts     -- HTML generation, print export
  proposalSignatureEmail.ts -- Email validation, send, status tracking
  proposalSigningEmails.ts  -- 4 HTML email template builders

edge-functions/
  proposal-ai-generate/    -- AI content generation
  proposal-signed-pdf/     -- Signed PDF generation
  signature-reminder-scheduler/   -- Cron: send reminders
  signature-expiration-processor/ -- Cron: expire requests

pages/
  Proposals.tsx            -- List page
  ProposalDetail.tsx       -- Detail/edit page
  ProposalBuilder.tsx      -- AI generation wizard
  PublicProposalSignPage.tsx -- Public signing page

components/proposals/
  CreateProposalModal.tsx  -- 2-step creation flow
  SendForSignatureModal.tsx -- 4-step signature send flow
  ConvertToInvoiceModal.tsx -- Proposal-to-invoice conversion
  SignatureCapture.tsx     -- Typed/drawn signature input
  SendProposalModal.tsx    -- Simple send modal
  SignatureCanvas.tsx      -- Canvas drawing component
```
