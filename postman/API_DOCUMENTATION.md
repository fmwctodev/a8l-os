# Autom8ion Lab API Documentation

> **Version:** 1.0
> **Last Updated:** 2026-03-30
> **Platform:** Autom8ion Lab -- CRM & Business Automation
> **Backend:** Supabase (PostgreSQL + PostgREST + Edge Functions)

---

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [PostgREST Conventions](#postgrest-conventions)
- [Modules](#modules)
  - [01 - Authentication](#01---authentication)
  - [02 - Contacts & CRM](#02---contacts--crm)
  - [03 - Conversations & Messaging](#03---conversations--messaging)
  - [04 - Opportunities & Pipelines](#04---opportunities--pipelines)
  - [05 - Payments & Invoicing](#05---payments--invoicing)
  - [06 - Proposals & Contracts](#06---proposals--contracts)
  - [07 - Calendars & Scheduling](#07---calendars--scheduling)
  - [08 - Projects](#08---projects)
  - [09 - Automation & Workflows](#09---automation--workflows)
  - [10 - AI Agents](#10---ai-agents)
  - [11 - Social Media & Marketing](#11---social-media--marketing)
  - [12 - Reputation & Reviews](#12---reputation--reviews)
  - [13 - Forms, Surveys & Scoring](#13---forms-surveys--scoring)
  - [14 - Reporting & Analytics](#14---reporting--analytics)
  - [15 - File Management & Google Drive](#15---file-management--google-drive)
  - [16 - Communications](#16---communications)
  - [17 - Voice AI (VAPI)](#17---voice-ai-vapi)
  - [18 - Administration](#18---administration)
  - [19 - Integrations & Webhooks](#19---integrations--webhooks)
  - [20 - System & Utilities](#20---system--utilities)
- [Common Headers Reference](#common-headers-reference)
- [Environment Variables Reference](#environment-variables-reference)
- [Error Handling](#error-handling)

---

## Overview

Autom8ion Lab is a full-featured CRM and business automation platform built on Supabase. The API layer consists of two primary interfaces:

| Interface | Base URL Pattern | Description |
|-----------|-----------------|-------------|
| **REST API (PostgREST)** | `{SUPABASE_URL}/rest/v1/{table}` | Direct table CRUD operations with powerful filtering, ordering, and relational queries |
| **Edge Functions** | `{SUPABASE_URL}/functions/v1/{slug}` | Custom serverless functions for business logic, third-party integrations, and AI operations |
| **Auth API** | `{SUPABASE_URL}/auth/v1/{endpoint}` | Supabase GoTrue authentication endpoints |

All data is stored in PostgreSQL with Row Level Security (RLS) policies enforcing tenant isolation and access control. Every table includes `organization_id` for multi-tenant scoping.

---

## Authentication

All API requests require authentication headers. Supabase uses a two-token approach: the **anon key** for API gateway access and a **JWT access token** for user-level authorization.

### Required Headers

```
apikey: {SUPABASE_ANON_KEY}
Authorization: Bearer {access_token}
```

### Sign In

Authenticate a user and receive an access token.

```
POST {SUPABASE_URL}/auth/v1/token?grant_type=password
```

**Headers:**

```
apikey: {SUPABASE_ANON_KEY}
Content-Type: application/json
```

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response (200 OK):**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 3600,
  "expires_at": 1711756800,
  "refresh_token": "v1.MjAyNi0wMy0zMC...",
  "user": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "email": "user@example.com",
    "role": "authenticated",
    "app_metadata": {
      "organization_id": "org-uuid-here"
    }
  }
}
```

### Sign Up

Register a new user account.

```
POST {SUPABASE_URL}/auth/v1/signup
```

**Request Body:**

```json
{
  "email": "newuser@example.com",
  "password": "securepassword123",
  "data": {
    "full_name": "Jane Doe"
  }
}
```

### Refresh Token

Exchange a refresh token for a new access token.

```
POST {SUPABASE_URL}/auth/v1/token?grant_type=refresh_token
```

**Request Body:**

```json
{
  "refresh_token": "v1.MjAyNi0wMy0zMC..."
}
```

### Get Current User

Retrieve the currently authenticated user's profile.

```
GET {SUPABASE_URL}/auth/v1/user
```

### Sign Out

Invalidate the current session.

```
POST {SUPABASE_URL}/auth/v1/logout
```

---

## PostgREST Conventions

The REST API follows PostgREST conventions for all table operations. Understanding these patterns is essential for working with the API effectively.

### Filtering

| Operator | Syntax | Example | Description |
|----------|--------|---------|-------------|
| `eq` | `?column=eq.value` | `?status=eq.active` | Equals |
| `neq` | `?column=neq.value` | `?status=neq.archived` | Not equals |
| `gt` | `?column=gt.value` | `?amount=gt.100` | Greater than |
| `gte` | `?column=gte.value` | `?created_at=gte.2026-01-01` | Greater than or equal |
| `lt` | `?column=lt.value` | `?amount=lt.500` | Less than |
| `lte` | `?column=lte.value` | `?due_date=lte.2026-12-31` | Less than or equal |
| `like` | `?column=like.*pattern*` | `?name=like.*Corp*` | Case-sensitive pattern match |
| `ilike` | `?column=ilike.*pattern*` | `?name=ilike.*corp*` | Case-insensitive pattern match |
| `in` | `?column=in.(v1,v2)` | `?status=in.(active,pending)` | Value in list |
| `is` | `?column=is.value` | `?deleted_at=is.null` | IS comparison (null, true, false) |
| `not` | `?column=not.eq.value` | `?status=not.eq.archived` | Negate any operator |
| `or` | `?or=(filter1,filter2)` | `?or=(status.eq.active,status.eq.pending)` | OR condition |
| `and` | `?and=(filter1,filter2)` | `?and=(amount.gt.100,amount.lt.500)` | AND condition |

### Ordering

```
?order=column.asc          -- Ascending (default)
?order=column.desc         -- Descending
?order=col1.desc,col2.asc  -- Multiple columns
?order=column.desc.nullslast  -- Nulls last
```

### Pagination

```
?limit=50&offset=0
```

To get the total count, include the `Prefer` header:

```
Prefer: count=exact
```

The total count is returned in the `Content-Range` response header:

```
Content-Range: 0-49/237
```

### Selecting Relations (Embedded Resources)

```
?select=*,relation:table(columns)
?select=id,name,owner:users(id,full_name),tags:contact_tags(tag:tags(id,name))
```

### Mutation Headers

When creating or updating records and you need the result returned:

```
Prefer: return=representation
```

For upsert operations:

```
Prefer: resolution=merge-duplicates
```

### Single Row Retrieval

When fetching by ID, use the `Accept` header for a single object (not array):

```
Accept: application/vnd.pgrst.object+json
```

Or in Supabase client code:

```javascript
const { data } = await supabase
  .from('contacts')
  .select('*')
  .eq('id', contactId)
  .maybeSingle();
```

---

## Modules

---

### 01 - Authentication

User authentication, session management, and administrative user creation.

#### Auth API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/v1/token?grant_type=password` | Sign in with email/password |
| `POST` | `/auth/v1/signup` | Register a new user |
| `POST` | `/auth/v1/token?grant_type=refresh_token` | Refresh an expired access token |
| `GET` | `/auth/v1/user` | Get the current authenticated user |
| `POST` | `/auth/v1/logout` | Sign out and invalidate session |

#### Edge Functions

##### `bootstrap-admin`

Initializes the first admin user and organization for a new Autom8ion Lab instance.

```
POST {SUPABASE_URL}/functions/v1/bootstrap-admin
```

**Request Body:**

```json
{
  "email": "admin@company.com",
  "password": "secureAdminPassword123",
  "full_name": "Admin User",
  "organization_name": "My Company"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "user_id": "uuid",
  "organization_id": "uuid",
  "message": "Admin user and organization created successfully"
}
```

##### `create-user`

Creates a new user within an existing organization (admin-only).

```
POST {SUPABASE_URL}/functions/v1/create-user
```

**Request Body:**

```json
{
  "email": "newuser@company.com",
  "password": "tempPassword123",
  "full_name": "New Employee",
  "role_id": "role-uuid",
  "department_id": "dept-uuid"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "newuser@company.com",
    "full_name": "New Employee"
  }
}
```

---

### 02 - Contacts & CRM

Core CRM functionality for managing contacts, their relationships, notes, tasks, and custom fields.

#### Tables

| Table | Description |
|-------|-------------|
| `contacts` | Primary contact records (people and companies) |
| `contact_notes` | Notes attached to contacts |
| `contact_tasks` | Tasks associated with contacts |
| `contact_timeline` | Activity timeline for contacts |
| `tags` | Shared tag definitions |
| `contact_tags` | Junction table linking contacts to tags |
| `custom_fields` | Custom field definitions per organization |
| `custom_field_values` | Custom field values per contact |

#### REST Endpoints -- `contacts`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/contacts?select=*,owner:users(id,full_name),tags:contact_tags(tag:tags(id,name,color))&order=created_at.desc&limit=50` | List contacts with relations |
| `GET` | `/rest/v1/contacts?id=eq.{id}&select=*,owner:users(id,full_name),tags:contact_tags(tag:tags(id,name,color)),notes:contact_notes(*),tasks:contact_tasks(*)` | Get contact by ID with all relations |
| `POST` | `/rest/v1/contacts` | Create a new contact |
| `PATCH` | `/rest/v1/contacts?id=eq.{id}` | Update a contact |
| `DELETE` | `/rest/v1/contacts?id=eq.{id}` | Delete a contact |

**Example: Create Contact**

```
POST {SUPABASE_URL}/rest/v1/contacts
Prefer: return=representation
```

```json
{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john.doe@example.com",
  "phone": "+15551234567",
  "company": "Acme Corp",
  "type": "person",
  "status": "active",
  "source": "website",
  "owner_id": "user-uuid",
  "organization_id": "org-uuid"
}
```

**Example: Search Contacts**

```
GET {SUPABASE_URL}/rest/v1/contacts?or=(first_name.ilike.*john*,last_name.ilike.*john*,email.ilike.*john*,company.ilike.*john*)&order=last_name.asc&limit=25
```

#### REST Endpoints -- `contact_notes`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/contact_notes?contact_id=eq.{id}&order=created_at.desc` | List notes for a contact |
| `POST` | `/rest/v1/contact_notes` | Create a note |
| `PATCH` | `/rest/v1/contact_notes?id=eq.{id}` | Update a note |
| `DELETE` | `/rest/v1/contact_notes?id=eq.{id}` | Delete a note |

#### REST Endpoints -- `contact_tasks`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/contact_tasks?contact_id=eq.{id}&order=due_date.asc` | List tasks for a contact |
| `POST` | `/rest/v1/contact_tasks` | Create a task |
| `PATCH` | `/rest/v1/contact_tasks?id=eq.{id}` | Update a task |
| `DELETE` | `/rest/v1/contact_tasks?id=eq.{id}` | Delete a task |

#### Bulk Operations

**Bulk Assign Owner:**

```
PATCH {SUPABASE_URL}/rest/v1/contacts?id=in.({id1},{id2},{id3})
```

```json
{
  "owner_id": "new-owner-uuid"
}
```

**Bulk Tag Management:**

```
POST {SUPABASE_URL}/rest/v1/contact_tags
Prefer: return=representation
```

```json
[
  { "contact_id": "contact-1-uuid", "tag_id": "tag-uuid" },
  { "contact_id": "contact-2-uuid", "tag_id": "tag-uuid" },
  { "contact_id": "contact-3-uuid", "tag_id": "tag-uuid" }
]
```

#### Custom Fields

**List Custom Fields:**

```
GET {SUPABASE_URL}/rest/v1/custom_fields?entity_type=eq.contact&order=sort_order.asc
```

**Set Custom Field Value:**

```
POST {SUPABASE_URL}/rest/v1/custom_field_values
Prefer: resolution=merge-duplicates
```

```json
{
  "custom_field_id": "field-uuid",
  "entity_id": "contact-uuid",
  "value": "Custom value here"
}
```

---

### 03 - Conversations & Messaging

Multi-channel conversation management including email, SMS, phone, internal messaging, and Google Chat, with AI draft generation.

#### Tables

| Table | Description |
|-------|-------------|
| `conversations` | Conversation threads (multi-channel) |
| `messages` | Individual messages within conversations |
| `ai_drafts` | AI-generated draft responses |
| `conversation_rules` | Automated routing and assignment rules |
| `team_channels` | Internal team messaging channels |
| `team_channel_messages` | Messages within team channels |
| `snippets` | Reusable message templates/snippets |

#### REST Endpoints -- `conversations`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/conversations?select=*,contact:contacts(id,first_name,last_name,email),assigned_to:users(id,full_name)&order=last_message_at.desc.nullslast&limit=50` | List conversations |
| `GET` | `/rest/v1/conversations?id=eq.{id}&select=*,contact:contacts(*),messages(*)` | Get conversation with messages |
| `POST` | `/rest/v1/conversations` | Create a new conversation |
| `PATCH` | `/rest/v1/conversations?id=eq.{id}` | Update conversation (status, assignment) |
| `DELETE` | `/rest/v1/conversations?id=eq.{id}` | Delete a conversation |

**Supported Channels:**

| Channel | Value | Description |
|---------|-------|-------------|
| Email | `email` | Email conversations via Gmail/Mailgun |
| SMS | `sms` | Text messages via Twilio |
| Phone | `phone` | Voice call logs and transcripts |
| Internal | `internal` | Internal team conversations |
| Google Chat | `google_chat` | Google Chat integration |

#### REST Endpoints -- `messages`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/messages?conversation_id=eq.{id}&order=created_at.asc` | List messages in conversation |
| `POST` | `/rest/v1/messages` | Create a message |

**Example: Create Message**

```json
{
  "conversation_id": "conv-uuid",
  "sender_type": "user",
  "sender_id": "user-uuid",
  "body": "Hello, how can I help you today?",
  "channel": "email",
  "direction": "outbound"
}
```

#### REST Endpoints -- `snippets`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/snippets?order=name.asc` | List all snippets |
| `POST` | `/rest/v1/snippets` | Create a snippet |
| `PATCH` | `/rest/v1/snippets?id=eq.{id}` | Update a snippet |
| `DELETE` | `/rest/v1/snippets?id=eq.{id}` | Delete a snippet |

#### Edge Functions

##### `conversation-rule-executor`

Evaluates and executes conversation routing rules when a new message arrives.

```
POST {SUPABASE_URL}/functions/v1/conversation-rule-executor
```

```json
{
  "conversation_id": "conv-uuid",
  "message_id": "msg-uuid"
}
```

##### `ai-draft-updater`

Generates or refreshes an AI-drafted reply for a conversation.

```
POST {SUPABASE_URL}/functions/v1/ai-draft-updater
```

```json
{
  "conversation_id": "conv-uuid",
  "instructions": "Be helpful and professional"
}
```

**Response:**

```json
{
  "success": true,
  "draft": {
    "id": "draft-uuid",
    "conversation_id": "conv-uuid",
    "body": "Thank you for reaching out! I'd be happy to help...",
    "tone": "professional",
    "created_at": "2026-03-30T12:00:00Z"
  }
}
```

---

### 04 - Opportunities & Pipelines

Sales pipeline management with kanban board operations, stage tracking, and deal management.

#### Tables

| Table | Description |
|-------|-------------|
| `pipelines` | Sales pipeline definitions |
| `pipeline_stages` | Stages within each pipeline |
| `opportunities` | Deals/opportunities |
| `opportunity_notes` | Notes on opportunities |
| `lost_reasons` | Predefined reasons for lost deals |

#### REST Endpoints -- `pipelines`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/pipelines?select=*,stages:pipeline_stages(*)&order=sort_order.asc` | List pipelines with stages |
| `POST` | `/rest/v1/pipelines` | Create a pipeline |
| `PATCH` | `/rest/v1/pipelines?id=eq.{id}` | Update a pipeline |
| `DELETE` | `/rest/v1/pipelines?id=eq.{id}` | Delete a pipeline |

#### REST Endpoints -- `pipeline_stages`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/pipeline_stages?pipeline_id=eq.{id}&order=position.asc` | List stages for a pipeline |
| `POST` | `/rest/v1/pipeline_stages` | Create a stage |
| `PATCH` | `/rest/v1/pipeline_stages?id=eq.{id}` | Update a stage |
| `DELETE` | `/rest/v1/pipeline_stages?id=eq.{id}` | Delete a stage |

#### REST Endpoints -- `opportunities`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/opportunities?select=*,contact:contacts(id,first_name,last_name,company),stage:pipeline_stages(id,name,color),owner:users(id,full_name)&pipeline_id=eq.{pid}&order=position.asc` | List opportunities (kanban view) |
| `GET` | `/rest/v1/opportunities?id=eq.{id}&select=*,contact:contacts(*),stage:pipeline_stages(*),owner:users(*),notes:opportunity_notes(*)` | Get opportunity detail |
| `POST` | `/rest/v1/opportunities` | Create an opportunity |
| `PATCH` | `/rest/v1/opportunities?id=eq.{id}` | Update an opportunity |
| `DELETE` | `/rest/v1/opportunities?id=eq.{id}` | Delete an opportunity |

**Example: Create Opportunity**

```json
{
  "title": "Enterprise License Deal",
  "contact_id": "contact-uuid",
  "pipeline_id": "pipeline-uuid",
  "stage_id": "stage-uuid",
  "value": 50000.00,
  "currency": "USD",
  "probability": 60,
  "expected_close_date": "2026-06-30",
  "owner_id": "user-uuid",
  "organization_id": "org-uuid"
}
```

**Stage Move (Kanban Drag):**

```
PATCH {SUPABASE_URL}/rest/v1/opportunities?id=eq.{id}
```

```json
{
  "stage_id": "new-stage-uuid",
  "position": 2
}
```

**Mark as Won:**

```json
{
  "status": "won",
  "closed_at": "2026-03-30T12:00:00Z"
}
```

**Mark as Lost:**

```json
{
  "status": "lost",
  "lost_reason_id": "reason-uuid",
  "closed_at": "2026-03-30T12:00:00Z"
}
```

#### Bulk Actions

**Bulk Update Stage:**

```
PATCH {SUPABASE_URL}/rest/v1/opportunities?id=in.({id1},{id2},{id3})
```

```json
{
  "stage_id": "target-stage-uuid"
}
```

---

### 05 - Payments & Invoicing

Invoice generation, payment tracking, recurring billing profiles, QuickBooks Online integration, and automated payment reminders.

#### Tables

| Table | Description |
|-------|-------------|
| `products` | Product/service catalog |
| `invoices` | Invoice records |
| `invoice_line_items` | Line items on invoices |
| `payments` | Payment records |
| `recurring_profiles` | Recurring invoice profiles |
| `payment_reminders` | Scheduled payment reminders |

#### REST Endpoints -- `products`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/products?order=name.asc` | List products |
| `POST` | `/rest/v1/products` | Create a product |
| `PATCH` | `/rest/v1/products?id=eq.{id}` | Update a product |
| `DELETE` | `/rest/v1/products?id=eq.{id}` | Delete a product |

#### REST Endpoints -- `invoices`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/invoices?select=*,contact:contacts(id,first_name,last_name,company),line_items:invoice_line_items(*)&order=created_at.desc&limit=50` | List invoices |
| `GET` | `/rest/v1/invoices?id=eq.{id}&select=*,contact:contacts(*),line_items:invoice_line_items(*),payments(*)` | Get invoice detail |
| `POST` | `/rest/v1/invoices` | Create an invoice |
| `PATCH` | `/rest/v1/invoices?id=eq.{id}` | Update an invoice |
| `DELETE` | `/rest/v1/invoices?id=eq.{id}` | Delete an invoice |

**Example: Create Invoice**

```json
{
  "contact_id": "contact-uuid",
  "invoice_number": "INV-2026-0042",
  "status": "draft",
  "issue_date": "2026-03-30",
  "due_date": "2026-04-30",
  "subtotal": 5000.00,
  "tax_rate": 8.25,
  "tax_amount": 412.50,
  "total": 5412.50,
  "notes": "Payment terms: Net 30",
  "organization_id": "org-uuid"
}
```

#### REST Endpoints -- `payments`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/payments?invoice_id=eq.{id}&order=payment_date.desc` | List payments for invoice |
| `POST` | `/rest/v1/payments` | Record a payment |
| `PATCH` | `/rest/v1/payments?id=eq.{id}` | Update a payment |
| `DELETE` | `/rest/v1/payments?id=eq.{id}` | Delete a payment |

#### Edge Functions

##### `qbo-oauth-start`

Initiates QuickBooks Online OAuth flow.

```
POST {SUPABASE_URL}/functions/v1/qbo-oauth-start
```

**Response:**

```json
{
  "authorization_url": "https://appcenter.intuit.com/connect/oauth2?..."
}
```

##### `qbo-api`

Proxy for QuickBooks Online API operations.

```
POST {SUPABASE_URL}/functions/v1/qbo-api
```

```json
{
  "action": "syncInvoice",
  "invoice_id": "invoice-uuid"
}
```

**Supported Actions:** `syncInvoice`, `syncPayment`, `syncCustomer`, `getCompanyInfo`, `query`

##### `recurring-invoice-generator`

Processes due recurring invoice profiles and generates new invoices.

```
POST {SUPABASE_URL}/functions/v1/recurring-invoice-generator
```

```json
{
  "profile_id": "profile-uuid"
}
```

##### `payment-reminder-scheduler`

Sends scheduled payment reminders for overdue invoices.

```
POST {SUPABASE_URL}/functions/v1/payment-reminder-scheduler
```

```json
{
  "invoice_id": "invoice-uuid",
  "reminder_type": "overdue"
}
```

---

### 06 - Proposals & Contracts

Proposal creation and management with AI-assisted content generation, contract management, and digital signature workflows.

#### Tables

| Table | Description |
|-------|-------------|
| `proposals` | Proposal documents |
| `proposal_sections` | Content sections within proposals |
| `proposal_line_items` | Pricing line items on proposals |
| `proposal_activities` | Activity log for proposals |
| `contracts` | Contract documents |
| `contract_sections` | Content sections within contracts |
| `signature_requests` | Digital signature tracking |

#### REST Endpoints -- `proposals`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/proposals?select=*,contact:contacts(id,first_name,last_name,company),sections:proposal_sections(*)&order=created_at.desc` | List proposals |
| `GET` | `/rest/v1/proposals?id=eq.{id}&select=*,contact:contacts(*),sections:proposal_sections(*),line_items:proposal_line_items(*),activities:proposal_activities(*)` | Get proposal detail |
| `POST` | `/rest/v1/proposals` | Create a proposal |
| `PATCH` | `/rest/v1/proposals?id=eq.{id}` | Update a proposal |
| `DELETE` | `/rest/v1/proposals?id=eq.{id}` | Delete a proposal |

#### REST Endpoints -- `contracts`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/contracts?select=*,contact:contacts(id,first_name,last_name)&order=created_at.desc` | List contracts |
| `GET` | `/rest/v1/contracts?id=eq.{id}&select=*,sections:contract_sections(*),signatures:signature_requests(*)` | Get contract detail |
| `POST` | `/rest/v1/contracts` | Create a contract |
| `PATCH` | `/rest/v1/contracts?id=eq.{id}` | Update a contract |
| `DELETE` | `/rest/v1/contracts?id=eq.{id}` | Delete a contract |

#### Edge Functions

##### `proposal-ai-generate`

Generates proposal content using AI based on context and instructions.

```
POST {SUPABASE_URL}/functions/v1/proposal-ai-generate
```

```json
{
  "proposal_id": "proposal-uuid",
  "contact_id": "contact-uuid",
  "instructions": "Create a proposal for website redesign project",
  "sections": ["executive_summary", "scope", "timeline", "pricing"]
}
```

**Response:**

```json
{
  "success": true,
  "sections": [
    {
      "title": "Executive Summary",
      "content": "We are pleased to present...",
      "sort_order": 1
    }
  ]
}
```

##### `contract-ai-generate`

Generates contract content using AI based on a proposal or custom instructions.

```
POST {SUPABASE_URL}/functions/v1/contract-ai-generate
```

```json
{
  "contract_id": "contract-uuid",
  "proposal_id": "proposal-uuid",
  "instructions": "Generate standard service agreement"
}
```

##### `proposal-signed-pdf`

Generates a signed PDF version of a completed proposal or contract.

```
POST {SUPABASE_URL}/functions/v1/proposal-signed-pdf
```

```json
{
  "proposal_id": "proposal-uuid",
  "include_signatures": true
}
```

**Response:**

```json
{
  "success": true,
  "pdf_url": "https://storage.supabase.co/.../signed-proposal.pdf"
}
```

---

### 07 - Calendars & Scheduling

Appointment scheduling, availability management, Google Calendar integration, and public booking pages.

#### Tables

| Table | Description |
|-------|-------------|
| `calendars` | Calendar configurations |
| `appointment_types` | Bookable appointment type definitions |
| `appointments` | Scheduled appointments |
| `availability_rules` | Recurring availability rules |
| `availability_date_overrides` | Date-specific availability overrides |
| `blocked_slots` | Manually blocked time slots |
| `google_calendar_events` | Synced Google Calendar events |

#### REST Endpoints -- `appointments`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/appointments?select=*,contact:contacts(id,first_name,last_name,email),appointment_type:appointment_types(id,name,duration,color)&start_time=gte.{start}&start_time=lte.{end}&order=start_time.asc` | List appointments in date range |
| `GET` | `/rest/v1/appointments?id=eq.{id}&select=*,contact:contacts(*),appointment_type:appointment_types(*)` | Get appointment detail |
| `POST` | `/rest/v1/appointments` | Create an appointment |
| `PATCH` | `/rest/v1/appointments?id=eq.{id}` | Update an appointment |
| `DELETE` | `/rest/v1/appointments?id=eq.{id}` | Cancel/delete an appointment |

**Example: Create Appointment**

```json
{
  "appointment_type_id": "type-uuid",
  "contact_id": "contact-uuid",
  "calendar_id": "calendar-uuid",
  "title": "Discovery Call",
  "start_time": "2026-04-01T10:00:00Z",
  "end_time": "2026-04-01T10:30:00Z",
  "status": "confirmed",
  "location": "Zoom",
  "notes": "Initial consultation",
  "organization_id": "org-uuid"
}
```

#### REST Endpoints -- `availability_rules`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/availability_rules?calendar_id=eq.{id}&order=day_of_week.asc` | List availability rules |
| `POST` | `/rest/v1/availability_rules` | Create availability rule |
| `PATCH` | `/rest/v1/availability_rules?id=eq.{id}` | Update availability rule |
| `DELETE` | `/rest/v1/availability_rules?id=eq.{id}` | Delete availability rule |

#### Edge Functions

##### `booking-api`

Public-facing booking endpoint for external clients to schedule appointments.

```
POST {SUPABASE_URL}/functions/v1/booking-api
```

```json
{
  "action": "getAvailability",
  "appointment_type_id": "type-uuid",
  "date": "2026-04-01",
  "timezone": "America/New_York"
}
```

**Response:**

```json
{
  "slots": [
    { "start": "2026-04-01T10:00:00Z", "end": "2026-04-01T10:30:00Z" },
    { "start": "2026-04-01T10:30:00Z", "end": "2026-04-01T11:00:00Z" },
    { "start": "2026-04-01T11:00:00Z", "end": "2026-04-01T11:30:00Z" }
  ]
}
```

**Book Appointment:**

```json
{
  "action": "book",
  "appointment_type_id": "type-uuid",
  "slot": "2026-04-01T10:00:00Z",
  "contact": {
    "first_name": "Jane",
    "last_name": "Smith",
    "email": "jane@example.com",
    "phone": "+15559876543"
  },
  "notes": "Looking forward to discussing the project"
}
```

##### `google-calendar-sync`

Synchronizes appointments with Google Calendar.

```
POST {SUPABASE_URL}/functions/v1/google-calendar-sync
```

```json
{
  "calendar_id": "calendar-uuid",
  "direction": "both"
}
```

##### `google-calendar-oauth`

Initiates Google Calendar OAuth connection flow.

```
POST {SUPABASE_URL}/functions/v1/google-calendar-oauth
```

```json
{
  "action": "start",
  "redirect_uri": "https://app.autom8ionlab.com/settings/calendars/callback"
}
```

---

### 08 - Projects

Full project management with task tracking, cost management, client portals, change requests, and support tickets.

#### Tables

| Table | Description |
|-------|-------------|
| `projects` | Project records |
| `project_tasks` | Tasks within projects |
| `project_notes` | Project notes and documentation |
| `project_costs` | Budget and cost tracking |
| `project_pipelines` | Project-specific pipelines |
| `project_pipeline_stages` | Stages within project pipelines |
| `project_activity_log` | Activity audit trail |
| `project_change_requests` | Client change requests |
| `project_change_request_comments` | Comments on change requests |
| `project_change_orders` | Approved change orders |
| `project_client_portals` | Client portal configurations |
| `support_tickets` | Support tickets linked to projects |

#### REST Endpoints -- `projects`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/projects?select=*,contact:contacts(id,first_name,last_name,company),manager:users(id,full_name)&order=created_at.desc&limit=50` | List projects |
| `GET` | `/rest/v1/projects?id=eq.{id}&select=*,tasks:project_tasks(*),notes:project_notes(*),costs:project_costs(*),change_requests:project_change_requests(*)` | Get project detail |
| `POST` | `/rest/v1/projects` | Create a project |
| `PATCH` | `/rest/v1/projects?id=eq.{id}` | Update a project |
| `DELETE` | `/rest/v1/projects?id=eq.{id}` | Delete a project |

**Example: Create Project**

```json
{
  "name": "Website Redesign",
  "description": "Complete redesign of corporate website",
  "contact_id": "contact-uuid",
  "manager_id": "user-uuid",
  "status": "active",
  "start_date": "2026-04-01",
  "due_date": "2026-07-31",
  "budget": 25000.00,
  "organization_id": "org-uuid"
}
```

#### REST Endpoints -- `project_tasks`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/project_tasks?project_id=eq.{id}&select=*,assignee:users(id,full_name)&order=position.asc` | List tasks for project |
| `POST` | `/rest/v1/project_tasks` | Create a task |
| `PATCH` | `/rest/v1/project_tasks?id=eq.{id}` | Update a task |
| `DELETE` | `/rest/v1/project_tasks?id=eq.{id}` | Delete a task |

#### REST Endpoints -- `project_change_requests`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/project_change_requests?project_id=eq.{id}&order=created_at.desc` | List change requests |
| `POST` | `/rest/v1/project_change_requests` | Submit a change request |
| `PATCH` | `/rest/v1/project_change_requests?id=eq.{id}` | Update (approve/reject) |

#### REST Endpoints -- `support_tickets`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/support_tickets?project_id=eq.{id}&order=created_at.desc` | List support tickets |
| `POST` | `/rest/v1/support_tickets` | Create a support ticket |
| `PATCH` | `/rest/v1/support_tickets?id=eq.{id}` | Update a support ticket |

#### Edge Functions

##### `change-request-notify`

Sends notifications when a change request is created or updated.

```
POST {SUPABASE_URL}/functions/v1/change-request-notify
```

```json
{
  "change_request_id": "cr-uuid",
  "event": "created"
}
```

##### `support-ticket-notify`

Sends notifications for support ticket events.

```
POST {SUPABASE_URL}/functions/v1/support-ticket-notify
```

```json
{
  "ticket_id": "ticket-uuid",
  "event": "created"
}
```

---

### 09 - Automation & Workflows

Visual workflow builder with conditional logic, scheduled triggers, webhook triggers, approval queues, and AI-powered actions.

#### Tables

| Table | Description |
|-------|-------------|
| `workflows` | Workflow definitions |
| `workflow_enrollments` | Active workflow enrollments per entity |
| `workflow_version_snapshots` | Versioned snapshots of workflow configurations |
| `workflow_approval_queue` | Pending approval items |
| `workflow_scheduled_triggers` | Time-based trigger configurations |
| `workflow_webhook_triggers` | Webhook-based trigger configurations |
| `automation_templates` | Pre-built automation templates |

#### REST Endpoints -- `workflows`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/workflows?select=*&order=name.asc` | List workflows |
| `GET` | `/rest/v1/workflows?id=eq.{id}&select=*,enrollments:workflow_enrollments(count),versions:workflow_version_snapshots(id,version,created_at)` | Get workflow detail |
| `POST` | `/rest/v1/workflows` | Create a workflow |
| `PATCH` | `/rest/v1/workflows?id=eq.{id}` | Update a workflow |
| `DELETE` | `/rest/v1/workflows?id=eq.{id}` | Delete a workflow |

**Example: Create Workflow**

```json
{
  "name": "New Lead Follow-up",
  "description": "Automated follow-up sequence for new leads",
  "trigger_type": "record_created",
  "trigger_config": {
    "table": "contacts",
    "filters": { "source": "website" }
  },
  "steps": [
    {
      "type": "delay",
      "config": { "duration": 5, "unit": "minutes" }
    },
    {
      "type": "send_email",
      "config": {
        "template": "welcome-lead",
        "to": "{{contact.email}}"
      }
    },
    {
      "type": "condition",
      "config": {
        "field": "contact.status",
        "operator": "eq",
        "value": "active"
      },
      "branches": {
        "true": [{ "type": "create_task", "config": { "title": "Follow up call" } }],
        "false": [{ "type": "end" }]
      }
    }
  ],
  "is_active": true,
  "organization_id": "org-uuid"
}
```

#### REST Endpoints -- `workflow_enrollments`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/workflow_enrollments?workflow_id=eq.{id}&order=enrolled_at.desc` | List enrollments |
| `POST` | `/rest/v1/workflow_enrollments` | Manually enroll an entity |
| `PATCH` | `/rest/v1/workflow_enrollments?id=eq.{id}` | Update enrollment status |

#### REST Endpoints -- `workflow_approval_queue`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/workflow_approval_queue?approver_id=eq.{user_id}&status=eq.pending&order=created_at.asc` | List pending approvals |
| `PATCH` | `/rest/v1/workflow_approval_queue?id=eq.{id}` | Approve or reject |

#### Edge Functions

##### `workflow-processor`

Main workflow execution engine that processes workflow steps.

```
POST {SUPABASE_URL}/functions/v1/workflow-processor
```

```json
{
  "enrollment_id": "enrollment-uuid",
  "step_index": 0
}
```

##### `evaluate-condition`

Evaluates a workflow condition step against entity data.

```
POST {SUPABASE_URL}/functions/v1/evaluate-condition
```

```json
{
  "condition": {
    "field": "contact.status",
    "operator": "eq",
    "value": "active"
  },
  "context": {
    "contact": { "status": "active", "email": "user@example.com" }
  }
}
```

##### `automation-custom-trigger`

Fires a custom automation trigger for external integrations.

```
POST {SUPABASE_URL}/functions/v1/automation-custom-trigger
```

```json
{
  "trigger_name": "custom_event",
  "payload": {
    "entity_type": "contact",
    "entity_id": "contact-uuid",
    "data": { "key": "value" }
  }
}
```

##### `workflow-webhook-receiver`

Receives incoming webhooks and maps them to workflow triggers.

```
POST {SUPABASE_URL}/functions/v1/workflow-webhook-receiver
```

```json
{
  "webhook_id": "webhook-trigger-uuid",
  "payload": { ... }
}
```

##### `workflow-ai-action-executor`

Executes AI-powered workflow actions (e.g., summarize, classify, generate).

```
POST {SUPABASE_URL}/functions/v1/workflow-ai-action-executor
```

```json
{
  "action": "classify",
  "input": "Customer is asking about refund policy",
  "options": ["billing", "support", "sales", "general"]
}
```

##### `workflow-scheduled-processor`

Processes workflows that are triggered on a schedule (cron-based).

```
POST {SUPABASE_URL}/functions/v1/workflow-scheduled-processor
```

```json
{
  "trigger_id": "scheduled-trigger-uuid"
}
```

---

### 10 - AI Agents

AI agent management with knowledge bases, embeddings, prompt templates, guardrails, and multi-model support.

#### Tables

| Table | Description |
|-------|-------------|
| `ai_agents` | AI agent configurations |
| `knowledge_collections` | Knowledge base collections |
| `knowledge_embeddings` | Vector embeddings for knowledge retrieval |
| `prompt_templates` | Reusable prompt templates |
| `ai_guardrails` | Safety and behavior guardrails |
| `llm_models` | Configured LLM model instances |
| `llm_model_catalog` | Available LLM models catalog |
| `ai_usage_logs` | Token usage and cost tracking |

#### REST Endpoints -- `ai_agents`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/ai_agents?select=*,model:llm_models(id,name,provider)&order=name.asc` | List AI agents |
| `GET` | `/rest/v1/ai_agents?id=eq.{id}&select=*,model:llm_models(*),guardrails:ai_guardrails(*),collections:knowledge_collections(*)` | Get agent detail |
| `POST` | `/rest/v1/ai_agents` | Create an AI agent |
| `PATCH` | `/rest/v1/ai_agents?id=eq.{id}` | Update an AI agent |
| `DELETE` | `/rest/v1/ai_agents?id=eq.{id}` | Delete an AI agent |

**Example: Create AI Agent**

```json
{
  "name": "Customer Support Agent",
  "description": "Handles customer support inquiries",
  "system_prompt": "You are a helpful customer support agent for Acme Corp.",
  "model_id": "model-uuid",
  "temperature": 0.7,
  "max_tokens": 1024,
  "knowledge_collection_ids": ["collection-uuid-1"],
  "guardrail_ids": ["guardrail-uuid-1"],
  "is_active": true,
  "organization_id": "org-uuid"
}
```

#### REST Endpoints -- `knowledge_collections`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/knowledge_collections?order=name.asc` | List knowledge collections |
| `POST` | `/rest/v1/knowledge_collections` | Create a collection |
| `PATCH` | `/rest/v1/knowledge_collections?id=eq.{id}` | Update a collection |
| `DELETE` | `/rest/v1/knowledge_collections?id=eq.{id}` | Delete a collection |

#### Edge Functions

##### `ai-agent-executor`

Executes an AI agent with a given input message and optional conversation context.

```
POST {SUPABASE_URL}/functions/v1/ai-agent-executor
```

```json
{
  "agent_id": "agent-uuid",
  "message": "What is your refund policy?",
  "conversation_history": [
    { "role": "user", "content": "Hello" },
    { "role": "assistant", "content": "Hi! How can I help you today?" }
  ],
  "context": {
    "contact_id": "contact-uuid"
  }
}
```

**Response:**

```json
{
  "success": true,
  "response": "Our refund policy allows returns within 30 days...",
  "sources": [
    { "collection": "FAQ", "document": "refund-policy.md", "relevance": 0.94 }
  ],
  "usage": {
    "prompt_tokens": 450,
    "completion_tokens": 120,
    "total_tokens": 570
  }
}
```

##### `ai-knowledge-embeddings`

Generates and stores vector embeddings for knowledge base documents.

```
POST {SUPABASE_URL}/functions/v1/ai-knowledge-embeddings
```

```json
{
  "action": "embed",
  "collection_id": "collection-uuid",
  "documents": [
    {
      "title": "Refund Policy",
      "content": "Our refund policy allows returns within 30 days of purchase...",
      "metadata": { "category": "policies" }
    }
  ]
}
```

##### `ai-report-generate`

Generates analytical reports using AI based on data queries.

```
POST {SUPABASE_URL}/functions/v1/ai-report-generate
```

```json
{
  "report_type": "sales_summary",
  "date_range": {
    "start": "2026-01-01",
    "end": "2026-03-31"
  },
  "filters": {
    "pipeline_id": "pipeline-uuid"
  }
}
```

##### `ai-report-query`

Executes natural language queries against business data.

```
POST {SUPABASE_URL}/functions/v1/ai-report-query
```

```json
{
  "query": "What were our top 5 deals by value last quarter?"
}
```

##### `ai-report-cleanup`

Cleans up stale or expired AI report cache entries.

```
POST {SUPABASE_URL}/functions/v1/ai-report-cleanup
```

##### `ai-settings-providers`

Manages AI provider configurations (API keys, endpoints).

```
POST {SUPABASE_URL}/functions/v1/ai-settings-providers
```

```json
{
  "action": "list"
}
```

**Supported Actions:** `list`, `get`, `update`, `test`

##### `ai-settings-elevenlabs`

Manages ElevenLabs voice AI configuration.

```
POST {SUPABASE_URL}/functions/v1/ai-settings-elevenlabs
```

```json
{
  "action": "listVoices"
}
```

**Supported Actions:** `listVoices`, `getVoice`, `testVoice`

##### `fetch-provider-models`

Fetches available models from a configured AI provider.

```
POST {SUPABASE_URL}/functions/v1/fetch-provider-models
```

```json
{
  "provider": "openai"
}
```

---

### 11 - Social Media & Marketing

Social media management with multi-platform publishing, AI content generation, campaign management, brand kits, and analytics.

#### Tables

| Table | Description |
|-------|-------------|
| `social_accounts` | Connected social media accounts |
| `social_account_groups` | Groupings of social accounts |
| `social_posts` | Scheduled/published social posts |
| `social_post_content` | Platform-specific content variations |
| `social_campaigns` | Marketing campaigns |
| `social_guidelines` | Content guidelines and policies |
| `social_post_metrics` | Engagement and reach metrics |
| `social_post_comments` | Comments on social posts |
| `brand_kits` | Brand identity configurations |
| `brand_voices` | Brand voice/tone definitions |
| `kie_models` | Knowledge-infused entity models for content |
| `media_assets` | Uploaded media files (images, videos) |

#### REST Endpoints -- `social_posts`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/social_posts?select=*,content:social_post_content(*),metrics:social_post_metrics(*)&order=scheduled_at.desc&limit=50` | List social posts |
| `GET` | `/rest/v1/social_posts?id=eq.{id}&select=*,content:social_post_content(*),metrics:social_post_metrics(*),comments:social_post_comments(*)` | Get post detail |
| `POST` | `/rest/v1/social_posts` | Create a social post |
| `PATCH` | `/rest/v1/social_posts?id=eq.{id}` | Update a social post |
| `DELETE` | `/rest/v1/social_posts?id=eq.{id}` | Delete a social post |

**Example: Create Social Post**

```json
{
  "campaign_id": "campaign-uuid",
  "status": "scheduled",
  "scheduled_at": "2026-04-01T14:00:00Z",
  "account_ids": ["account-uuid-1", "account-uuid-2"],
  "organization_id": "org-uuid"
}
```

#### REST Endpoints -- `social_campaigns`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/social_campaigns?order=start_date.desc` | List campaigns |
| `POST` | `/rest/v1/social_campaigns` | Create a campaign |
| `PATCH` | `/rest/v1/social_campaigns?id=eq.{id}` | Update a campaign |
| `DELETE` | `/rest/v1/social_campaigns?id=eq.{id}` | Delete a campaign |

#### REST Endpoints -- `brand_kits`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/brand_kits?order=name.asc` | List brand kits |
| `POST` | `/rest/v1/brand_kits` | Create a brand kit |
| `PATCH` | `/rest/v1/brand_kits?id=eq.{id}` | Update a brand kit |
| `DELETE` | `/rest/v1/brand_kits?id=eq.{id}` | Delete a brand kit |

#### Edge Functions

##### `late-connect`

Connects a social media account via OAuth (Later/platform-specific).

```
POST {SUPABASE_URL}/functions/v1/late-connect
```

```json
{
  "platform": "instagram",
  "oauth_code": "auth-code-from-redirect"
}
```

##### `social-worker`

Background worker that publishes scheduled social posts to connected platforms.

```
POST {SUPABASE_URL}/functions/v1/social-worker
```

```json
{
  "post_id": "post-uuid"
}
```

##### `late-metrics`

Fetches engagement metrics from social platforms for published posts.

```
POST {SUPABASE_URL}/functions/v1/late-metrics
```

```json
{
  "post_id": "post-uuid"
}
```

##### `ai-social-campaign-generator`

Generates a complete social media campaign plan using AI.

```
POST {SUPABASE_URL}/functions/v1/ai-social-campaign-generator
```

```json
{
  "topic": "Product Launch - Spring Collection",
  "platforms": ["instagram", "facebook", "twitter"],
  "duration_days": 14,
  "brand_kit_id": "brand-kit-uuid",
  "brand_voice_id": "voice-uuid"
}
```

##### `ai-social-content`

Generates individual social media post content using AI.

```
POST {SUPABASE_URL}/functions/v1/ai-social-content
```

```json
{
  "prompt": "Create an engaging post about our spring sale",
  "platform": "instagram",
  "brand_voice_id": "voice-uuid",
  "include_hashtags": true,
  "tone": "excited"
}
```

##### `ai-social-chat`

Interactive AI chat for iterating on social media content.

```
POST {SUPABASE_URL}/functions/v1/ai-social-chat
```

```json
{
  "message": "Make the caption more casual and add emojis",
  "context": {
    "draft": "Check out our amazing spring collection!",
    "platform": "instagram"
  }
}
```

##### `late-inbox-comments-sync`

Syncs comments and messages from social platform inboxes.

```
POST {SUPABASE_URL}/functions/v1/late-inbox-comments-sync
```

```json
{
  "account_id": "account-uuid"
}
```

##### `media-kie-jobs`

Processes media assets through knowledge-infused entity models for auto-tagging and classification.

```
POST {SUPABASE_URL}/functions/v1/media-kie-jobs
```

```json
{
  "asset_id": "asset-uuid",
  "model_id": "kie-model-uuid"
}
```

##### `media-job-status`

Checks the status of a media processing job.

```
POST {SUPABASE_URL}/functions/v1/media-job-status
```

```json
{
  "job_id": "job-uuid"
}
```

##### `ai-caption-generator`

Generates captions for media assets using AI vision capabilities.

```
POST {SUPABASE_URL}/functions/v1/ai-caption-generator
```

```json
{
  "asset_id": "asset-uuid",
  "style": "descriptive",
  "max_length": 150
}
```

---

### 12 - Reputation & Reviews

Review management, reputation monitoring, AI-powered review analysis, and automated response generation across multiple review platforms.

#### Tables

| Table | Description |
|-------|-------------|
| `reviews` | Collected reviews from various sources |
| `review_requests` | Outgoing review request campaigns |
| `review_providers` | Connected review platform providers |
| `reputation_reviews` | Aggregated reputation review data |
| `reputation_settings` | Reputation management settings |
| `reputation_routing_rules` | Rules for routing review responses |
| `review_ai_analysis` | AI-generated review analysis results |

#### REST Endpoints -- `reviews`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/reviews?select=*,analysis:review_ai_analysis(*)&order=review_date.desc&limit=50` | List reviews |
| `GET` | `/rest/v1/reviews?id=eq.{id}&select=*,analysis:review_ai_analysis(*)` | Get review detail |
| `PATCH` | `/rest/v1/reviews?id=eq.{id}` | Update review (e.g., mark as responded) |

#### REST Endpoints -- `review_requests`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/review_requests?order=created_at.desc` | List review requests |
| `POST` | `/rest/v1/review_requests` | Create a review request |
| `PATCH` | `/rest/v1/review_requests?id=eq.{id}` | Update a review request |
| `DELETE` | `/rest/v1/review_requests?id=eq.{id}` | Delete a review request |

#### Edge Functions

##### `review-ai-analyze`

Analyzes a review using AI to extract sentiment, topics, and key phrases.

```
POST {SUPABASE_URL}/functions/v1/review-ai-analyze
```

```json
{
  "review_id": "review-uuid"
}
```

**Response:**

```json
{
  "success": true,
  "analysis": {
    "sentiment": "positive",
    "score": 0.87,
    "topics": ["customer service", "product quality"],
    "key_phrases": ["excellent support", "fast delivery"],
    "suggested_response": "Thank you for your kind words..."
  }
}
```

##### `review-ai-reply`

Generates an AI-drafted reply to a review.

```
POST {SUPABASE_URL}/functions/v1/review-ai-reply
```

```json
{
  "review_id": "review-uuid",
  "tone": "professional",
  "instructions": "Thank the customer and mention our loyalty program"
}
```

##### `review-reply-post`

Posts a reply to a review on the original platform.

```
POST {SUPABASE_URL}/functions/v1/review-reply-post
```

```json
{
  "review_id": "review-uuid",
  "reply": "Thank you for your wonderful feedback! We truly appreciate..."
}
```

##### `review-submit`

Submits a new review (for internal review collection forms).

```
POST {SUPABASE_URL}/functions/v1/review-submit
```

```json
{
  "contact_id": "contact-uuid",
  "rating": 5,
  "review_text": "Great experience working with this team!",
  "platform": "internal"
}
```

##### `review-sync-worker`

Background worker that syncs reviews from connected review platforms.

```
POST {SUPABASE_URL}/functions/v1/review-sync-worker
```

```json
{
  "provider_id": "provider-uuid"
}
```

##### `reputation-review-sync`

Syncs reputation data from monitoring sources.

```
POST {SUPABASE_URL}/functions/v1/reputation-review-sync
```

```json
{
  "source": "google_business"
}
```

##### `reputation-review-reply`

Posts a reply to a reputation review on the monitored platform.

```
POST {SUPABASE_URL}/functions/v1/reputation-review-reply
```

```json
{
  "review_id": "reputation-review-uuid",
  "reply": "We appreciate your feedback..."
}
```

##### `reputation-ai-generate`

Generates AI-powered reputation improvement suggestions.

```
POST {SUPABASE_URL}/functions/v1/reputation-ai-generate
```

```json
{
  "action": "improvement_plan",
  "date_range": {
    "start": "2026-01-01",
    "end": "2026-03-31"
  }
}
```

---

### 13 - Forms, Surveys & Scoring

Form builder, survey management, public submission endpoints, and lead/entity scoring models.

#### Tables

| Table | Description |
|-------|-------------|
| `forms` | Form definitions |
| `form_submissions` | Submitted form data |
| `surveys` | Survey definitions |
| `survey_submissions` | Submitted survey responses |
| `tags` | Shared tags (used for form/survey categorization) |

#### REST Endpoints -- `forms`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/forms?order=name.asc` | List forms |
| `GET` | `/rest/v1/forms?id=eq.{id}&select=*,submissions:form_submissions(count)` | Get form detail with submission count |
| `POST` | `/rest/v1/forms` | Create a form |
| `PATCH` | `/rest/v1/forms?id=eq.{id}` | Update a form |
| `DELETE` | `/rest/v1/forms?id=eq.{id}` | Delete a form |

**Example: Create Form**

```json
{
  "name": "Contact Us",
  "description": "Public contact form",
  "fields": [
    { "name": "full_name", "type": "text", "label": "Full Name", "required": true },
    { "name": "email", "type": "email", "label": "Email Address", "required": true },
    { "name": "phone", "type": "phone", "label": "Phone Number", "required": false },
    { "name": "message", "type": "textarea", "label": "Message", "required": true },
    { "name": "service", "type": "select", "label": "Service Interested In", "options": ["Web Design", "SEO", "Marketing"], "required": false }
  ],
  "settings": {
    "submit_button_text": "Send Message",
    "success_message": "Thank you! We'll be in touch soon.",
    "redirect_url": null,
    "notification_emails": ["team@company.com"]
  },
  "is_active": true,
  "organization_id": "org-uuid"
}
```

#### REST Endpoints -- `form_submissions`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/form_submissions?form_id=eq.{id}&order=created_at.desc&limit=50` | List submissions for a form |
| `GET` | `/rest/v1/form_submissions?id=eq.{id}` | Get submission detail |
| `DELETE` | `/rest/v1/form_submissions?id=eq.{id}` | Delete a submission |

#### REST Endpoints -- `surveys`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/surveys?order=name.asc` | List surveys |
| `POST` | `/rest/v1/surveys` | Create a survey |
| `PATCH` | `/rest/v1/surveys?id=eq.{id}` | Update a survey |
| `DELETE` | `/rest/v1/surveys?id=eq.{id}` | Delete a survey |

#### Edge Functions

##### `form-submit`

Public endpoint for form submissions (no auth required).

```
POST {SUPABASE_URL}/functions/v1/form-submit
```

```json
{
  "form_id": "form-uuid",
  "data": {
    "full_name": "Jane Doe",
    "email": "jane@example.com",
    "phone": "+15551234567",
    "message": "I'd like to learn more about your services",
    "service": "Web Design"
  },
  "metadata": {
    "source_url": "https://www.company.com/contact",
    "user_agent": "Mozilla/5.0...",
    "ip_address": "auto"
  }
}
```

**Response:**

```json
{
  "success": true,
  "submission_id": "submission-uuid",
  "message": "Thank you! We'll be in touch soon."
}
```

##### `survey-submit`

Public endpoint for survey submissions.

```
POST {SUPABASE_URL}/functions/v1/survey-submit
```

```json
{
  "survey_id": "survey-uuid",
  "responses": [
    { "question_id": "q1", "answer": "Very Satisfied" },
    { "question_id": "q2", "answer": 9 },
    { "question_id": "q3", "answer": "Great customer service!" }
  ],
  "respondent": {
    "email": "customer@example.com",
    "name": "Customer Name"
  }
}
```

##### `scoring-api`

Manages lead/entity scoring models and score adjustments.

```
POST {SUPABASE_URL}/functions/v1/scoring-api
```

**Action: `list-models`**

```json
{
  "action": "list-models"
}
```

**Action: `create-model`**

```json
{
  "action": "create-model",
  "model": {
    "name": "Lead Quality Score",
    "entity_type": "contact",
    "rules": [
      { "field": "source", "operator": "eq", "value": "referral", "points": 20 },
      { "field": "company", "operator": "is_not_null", "value": null, "points": 10 },
      { "field": "email", "operator": "contains", "value": "@enterprise.com", "points": 15 }
    ]
  }
}
```

**Action: `list-rules`**

```json
{
  "action": "list-rules",
  "model_id": "model-uuid"
}
```

**Action: `adjust-score`**

```json
{
  "action": "adjust-score",
  "entity_type": "contact",
  "entity_id": "contact-uuid",
  "adjustment": 10,
  "reason": "Attended webinar"
}
```

**Action: `get-entity-scores`**

```json
{
  "action": "get-entity-scores",
  "entity_type": "contact",
  "entity_id": "contact-uuid"
}
```

---

### 14 - Reporting & Analytics

AI-powered reporting, scheduled reports, dashboard analytics, content analytics, and report distribution.

#### Tables

| Table | Description |
|-------|-------------|
| `ai_reports` | AI-generated report definitions and results |
| `ai_report_schedules` | Scheduled report configurations |
| `reports` | Custom report definitions |
| `workflow_analytics_cache` | Cached workflow analytics data |

#### REST Endpoints -- `ai_reports`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/ai_reports?order=created_at.desc&limit=50` | List AI reports |
| `GET` | `/rest/v1/ai_reports?id=eq.{id}` | Get AI report detail |
| `POST` | `/rest/v1/ai_reports` | Create an AI report |
| `DELETE` | `/rest/v1/ai_reports?id=eq.{id}` | Delete an AI report |

#### REST Endpoints -- `reports`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/reports?order=name.asc` | List custom reports |
| `POST` | `/rest/v1/reports` | Create a custom report |
| `PATCH` | `/rest/v1/reports?id=eq.{id}` | Update a report |
| `DELETE` | `/rest/v1/reports?id=eq.{id}` | Delete a report |

#### Edge Functions

##### `ai-report-generate`

Generates an AI-powered analytical report.

```
POST {SUPABASE_URL}/functions/v1/ai-report-generate
```

```json
{
  "report_type": "sales_pipeline",
  "title": "Q1 Pipeline Analysis",
  "date_range": { "start": "2026-01-01", "end": "2026-03-31" },
  "include_charts": true
}
```

##### `ai-report-query`

Natural language query interface for business data.

```
POST {SUPABASE_URL}/functions/v1/ai-report-query
```

```json
{
  "query": "Show me conversion rates by pipeline stage for March 2026"
}
```

##### `ai-report-cleanup`

Removes stale and expired report cache entries.

```
POST {SUPABASE_URL}/functions/v1/ai-report-cleanup
```

##### `ai-report-schedule-runner`

Executes scheduled reports and distributes results.

```
POST {SUPABASE_URL}/functions/v1/ai-report-schedule-runner
```

```json
{
  "schedule_id": "schedule-uuid"
}
```

##### `analytics-dashboard`

Returns aggregated dashboard analytics data.

```
POST {SUPABASE_URL}/functions/v1/analytics-dashboard
```

```json
{
  "widgets": ["revenue_summary", "pipeline_overview", "activity_feed", "contact_growth"],
  "date_range": { "start": "2026-03-01", "end": "2026-03-31" }
}
```

**Response:**

```json
{
  "revenue_summary": {
    "total": 125000,
    "change_pct": 12.5,
    "period": "month"
  },
  "pipeline_overview": {
    "total_opportunities": 47,
    "total_value": 890000,
    "stages": [
      { "name": "Discovery", "count": 15, "value": 300000 },
      { "name": "Proposal", "count": 12, "value": 250000 }
    ]
  },
  "contact_growth": {
    "new_contacts": 85,
    "change_pct": 8.3
  }
}
```

##### `analytics-content-ai`

Provides AI-driven content performance analytics and recommendations.

```
POST {SUPABASE_URL}/functions/v1/analytics-content-ai
```

```json
{
  "content_type": "social_posts",
  "date_range": { "start": "2026-01-01", "end": "2026-03-31" }
}
```

##### `report-export-worker`

Exports a report to PDF, CSV, or Excel format.

```
POST {SUPABASE_URL}/functions/v1/report-export-worker
```

```json
{
  "report_id": "report-uuid",
  "format": "pdf"
}
```

**Response:**

```json
{
  "success": true,
  "download_url": "https://storage.supabase.co/.../report-export.pdf",
  "expires_at": "2026-03-31T12:00:00Z"
}
```

##### `report-email-sender`

Sends a report to specified recipients via email.

```
POST {SUPABASE_URL}/functions/v1/report-email-sender
```

```json
{
  "report_id": "report-uuid",
  "recipients": ["manager@company.com", "ceo@company.com"],
  "format": "pdf",
  "subject": "Monthly Sales Report - March 2026"
}
```

---

### 15 - File Management & Google Drive

File and folder management with Google Drive integration, sharing, and attachment linking.

#### Tables

| Table | Description |
|-------|-------------|
| `drive_files` | Tracked files (local and Drive-synced) |
| `drive_folders` | Folder structure |
| `drive_connections` | Google Drive connection configurations |
| `file_attachments` | Junction table linking files to entities |

#### REST Endpoints -- `drive_files`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/drive_files?folder_id=eq.{id}&order=name.asc` | List files in folder |
| `GET` | `/rest/v1/drive_files?id=eq.{id}` | Get file detail |
| `POST` | `/rest/v1/drive_files` | Create file record |
| `PATCH` | `/rest/v1/drive_files?id=eq.{id}` | Update file metadata |
| `DELETE` | `/rest/v1/drive_files?id=eq.{id}` | Delete file record |

#### REST Endpoints -- `drive_folders`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/drive_folders?parent_id=is.null&order=name.asc` | List root folders |
| `GET` | `/rest/v1/drive_folders?parent_id=eq.{id}&order=name.asc` | List subfolders |
| `POST` | `/rest/v1/drive_folders` | Create a folder |
| `PATCH` | `/rest/v1/drive_folders?id=eq.{id}` | Update a folder |
| `DELETE` | `/rest/v1/drive_folders?id=eq.{id}` | Delete a folder |

#### Edge Functions

##### `drive-api`

Google Drive operations proxy.

```
POST {SUPABASE_URL}/functions/v1/drive-api
```

**Action: `list`** -- List files from Google Drive.

```json
{
  "action": "list",
  "folder_id": "google-folder-id",
  "page_token": null,
  "query": "name contains 'invoice'"
}
```

**Action: `createFolder`** -- Create a folder in Google Drive.

```json
{
  "action": "createFolder",
  "name": "Project Documents",
  "parent_id": "google-parent-folder-id"
}
```

**Action: `get`** -- Get file metadata and download URL.

```json
{
  "action": "get",
  "file_id": "google-file-id"
}
```

**Action: `delete`** -- Delete a file from Google Drive.

```json
{
  "action": "delete",
  "file_id": "google-file-id"
}
```

**Action: `share`** -- Share a file with specified permissions.

```json
{
  "action": "share",
  "file_id": "google-file-id",
  "email": "collaborator@example.com",
  "role": "writer"
}
```

##### `drive-oauth-start`

Initiates the Google Drive OAuth connection flow.

```
POST {SUPABASE_URL}/functions/v1/drive-oauth-start
```

```json
{
  "redirect_uri": "https://app.autom8ionlab.com/settings/drive/callback"
}
```

##### `drive-oauth-callback`

Handles the OAuth callback and stores the connection tokens.

```
POST {SUPABASE_URL}/functions/v1/drive-oauth-callback
```

```json
{
  "code": "oauth-authorization-code",
  "state": "state-token"
}
```

##### `drive-auto-connect`

Automatically connects and configures a Google Drive folder structure for an organization.

```
POST {SUPABASE_URL}/functions/v1/drive-auto-connect
```

```json
{
  "create_default_folders": true
}
```

---

### 16 - Communications

Comprehensive multi-channel communication management including Gmail, Mailgun email, SMS (Twilio), phone/voice (Twilio), and Google Chat.

#### Tables

| Table | Description |
|-------|-------------|
| `email_domains` | Configured email sending domains |
| `email_from_addresses` | Verified sender email addresses |
| `email_providers` | Email provider configurations |
| `email_defaults` | Default email settings per organization |
| `call_logs` | Phone call log records |

#### Edge Functions -- Gmail

##### `gmail-api`

Gmail operations proxy for authenticated Gmail access.

```
POST {SUPABASE_URL}/functions/v1/gmail-api
```

**Action: `list`** -- List emails from Gmail inbox.

```json
{
  "action": "list",
  "query": "is:inbox",
  "max_results": 20,
  "page_token": null
}
```

**Action: `get`** -- Get a specific email message.

```json
{
  "action": "get",
  "message_id": "gmail-message-id"
}
```

**Action: `send`** -- Send a new email.

```json
{
  "action": "send",
  "to": "recipient@example.com",
  "subject": "Meeting Follow-up",
  "body": "<p>Thank you for your time today...</p>",
  "cc": "manager@company.com",
  "bcc": null,
  "attachments": []
}
```

**Action: `reply`** -- Reply to an existing email thread.

```json
{
  "action": "reply",
  "message_id": "gmail-message-id",
  "thread_id": "gmail-thread-id",
  "body": "<p>Thank you for getting back to me...</p>"
}
```

**Action: `getThread`** -- Get all messages in a thread.

```json
{
  "action": "getThread",
  "thread_id": "gmail-thread-id"
}
```

**Action: `trash`** -- Move a message to trash.

```json
{
  "action": "trash",
  "message_id": "gmail-message-id"
}
```

##### `gmail-oauth-start`

Initiates Gmail OAuth connection.

```
POST {SUPABASE_URL}/functions/v1/gmail-oauth-start
```

##### `gmail-sync`

Full synchronization of Gmail inbox with the platform.

```
POST {SUPABASE_URL}/functions/v1/gmail-sync
```

##### `gmail-sync-incremental`

Incremental Gmail sync (processes only new/changed messages).

```
POST {SUPABASE_URL}/functions/v1/gmail-sync-incremental
```

#### Edge Functions -- Mailgun Email

##### `email-send`

Sends an email via Mailgun.

```
POST {SUPABASE_URL}/functions/v1/email-send
```

```json
{
  "to": "recipient@example.com",
  "from": "noreply@company.com",
  "subject": "Your Invoice is Ready",
  "html": "<h1>Invoice #1234</h1><p>Your invoice is attached.</p>",
  "attachments": [
    {
      "filename": "invoice-1234.pdf",
      "content": "base64-encoded-content",
      "type": "application/pdf"
    }
  ]
}
```

##### `email-mailgun-domains`

Manages Mailgun authenticated domains.

```
POST {SUPABASE_URL}/functions/v1/email-mailgun-domains
```

```json
{
  "action": "list"
}
```

##### `email-mailgun-provider`

Manages Mailgun provider configuration.

```
POST {SUPABASE_URL}/functions/v1/email-mailgun-provider
```

##### `email-mailgun-senders`

Manages verified Mailgun sender identities.

```
POST {SUPABASE_URL}/functions/v1/email-mailgun-senders
```

##### `email-mailgun-suppressions`

Manages Mailgun suppressions groups and suppressions.

```
POST {SUPABASE_URL}/functions/v1/email-mailgun-suppressions
```

##### `email-campaign-domains`

Manages email campaign domain configurations.

```
POST {SUPABASE_URL}/functions/v1/email-campaign-domains
```

##### `email-warmup-sync`

Synchronizes email warmup status and progression.

```
POST {SUPABASE_URL}/functions/v1/email-warmup-sync
```

#### Edge Functions -- SMS

##### `send-sms`

Sends an SMS message via Twilio.

```
POST {SUPABASE_URL}/functions/v1/send-sms
```

```json
{
  "to": "+15551234567",
  "body": "Hi John, just a reminder about your appointment tomorrow at 2 PM.",
  "from": "+15559876543",
  "contact_id": "contact-uuid"
}
```

**Response:**

```json
{
  "success": true,
  "message_sid": "SM1234567890abcdef",
  "status": "queued"
}
```

#### Edge Functions -- Phone/Voice (Twilio)

##### `phone-twilio-numbers`

Lists and manages Twilio phone numbers.

```
POST {SUPABASE_URL}/functions/v1/phone-twilio-numbers
```

```json
{
  "action": "list"
}
```

##### `phone-settings`

Manages phone system settings (voicemail, routing, hours).

```
POST {SUPABASE_URL}/functions/v1/phone-settings
```

```json
{
  "action": "get"
}
```

##### `phone-twilio-connection`

Manages Twilio account connection and configuration.

```
POST {SUPABASE_URL}/functions/v1/phone-twilio-connection
```

##### `phone-twilio-messaging`

Manages Twilio messaging configuration (SMS/MMS settings).

```
POST {SUPABASE_URL}/functions/v1/phone-twilio-messaging
```

##### `phone-voice-routing`

Configures voice call routing rules and IVR settings.

```
POST {SUPABASE_URL}/functions/v1/phone-voice-routing
```

```json
{
  "action": "update",
  "rules": [
    {
      "condition": "business_hours",
      "action": "ring_group",
      "target": "sales-team"
    },
    {
      "condition": "after_hours",
      "action": "voicemail"
    }
  ]
}
```

##### `phone-dnc`

Manages the Do Not Call (DNC) list.

```
POST {SUPABASE_URL}/functions/v1/phone-dnc
```

```json
{
  "action": "add",
  "phone_number": "+15551234567",
  "reason": "Customer requested"
}
```

##### `phone-test`

Tests phone connectivity and configuration.

```
POST {SUPABASE_URL}/functions/v1/phone-test
```

```json
{
  "test_type": "outbound",
  "phone_number": "+15551234567"
}
```

##### `twilio-connection-health`

Checks the health and status of the Twilio connection.

```
POST {SUPABASE_URL}/functions/v1/twilio-connection-health
```

#### Edge Functions -- Google Chat

##### `google-chat-api`

Google Chat workspace integration.

```
POST {SUPABASE_URL}/functions/v1/google-chat-api
```

**Action: `listSpaces`**

```json
{
  "action": "listSpaces"
}
```

**Action: `listMessages`**

```json
{
  "action": "listMessages",
  "space_id": "spaces/AAAA1234"
}
```

**Action: `sendMessage`**

```json
{
  "action": "sendMessage",
  "space_id": "spaces/AAAA1234",
  "text": "Project update: Phase 1 is complete!"
}
```

---

### 17 - Voice AI (VAPI)

Voice AI assistant management using VAPI for conversational AI phone agents, with call tracking, tool integrations, and embeddable widgets.

#### Tables

| Table | Description |
|-------|-------------|
| `vapi_assistants` | VAPI voice assistant configurations |
| `vapi_bindings` | Bindings between assistants and phone numbers/widgets |
| `vapi_calls` | Call records and transcripts |
| `vapi_sessions` | Active call sessions |
| `vapi_tool_registry` | Registered tools available to VAPI assistants |
| `vapi_widgets` | Embeddable voice widget configurations |

#### REST Endpoints -- `vapi_assistants`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/vapi_assistants?order=name.asc` | List VAPI assistants |
| `GET` | `/rest/v1/vapi_assistants?id=eq.{id}&select=*,bindings:vapi_bindings(*),calls:vapi_calls(count)` | Get assistant detail |
| `POST` | `/rest/v1/vapi_assistants` | Create assistant record |
| `PATCH` | `/rest/v1/vapi_assistants?id=eq.{id}` | Update assistant record |
| `DELETE` | `/rest/v1/vapi_assistants?id=eq.{id}` | Delete assistant record |

#### REST Endpoints -- `vapi_calls`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/vapi_calls?order=created_at.desc&limit=50` | List calls |
| `GET` | `/rest/v1/vapi_calls?id=eq.{id}` | Get call detail with transcript |

#### Edge Functions

##### `vapi-client`

Primary VAPI API client with 9 actions for managing assistants and calls.

```
POST {SUPABASE_URL}/functions/v1/vapi-client
```

**Action: `listAssistants`**

```json
{ "action": "listAssistants" }
```

**Action: `getAssistant`**

```json
{ "action": "getAssistant", "assistantId": "vapi-assistant-id" }
```

**Action: `createAssistant`**

```json
{
  "action": "createAssistant",
  "assistant": {
    "name": "Receptionist AI",
    "firstMessage": "Hello, thank you for calling Acme Corp. How can I help you today?",
    "model": {
      "provider": "openai",
      "model": "gpt-4",
      "systemPrompt": "You are a friendly receptionist for Acme Corp..."
    },
    "voice": {
      "provider": "elevenlabs",
      "voiceId": "voice-id"
    }
  }
}
```

**Action: `updateAssistant`**

```json
{
  "action": "updateAssistant",
  "assistantId": "vapi-assistant-id",
  "updates": {
    "firstMessage": "Welcome to Acme Corp! How may I assist you?"
  }
}
```

**Action: `deleteAssistant`**

```json
{ "action": "deleteAssistant", "assistantId": "vapi-assistant-id" }
```

**Action: `listPhoneNumbers`**

```json
{ "action": "listPhoneNumbers" }
```

**Action: `listCalls`**

```json
{ "action": "listCalls", "limit": 50 }
```

**Action: `getCall`**

```json
{ "action": "getCall", "callId": "vapi-call-id" }
```

**Action: `createCall`**

```json
{
  "action": "createCall",
  "assistantId": "vapi-assistant-id",
  "phoneNumber": "+15551234567",
  "customer": {
    "name": "John Doe",
    "number": "+15559876543"
  }
}
```

##### `vapi-webhook`

Receives VAPI webhook events (call started, ended, transcript updates).

```
POST {SUPABASE_URL}/functions/v1/vapi-webhook
```

```json
{
  "event": "call.ended",
  "call": {
    "id": "vapi-call-id",
    "status": "completed",
    "duration": 180,
    "transcript": "..."
  }
}
```

##### `vapi-tool-gateway`

Gateway for VAPI assistant tool calls during active conversations.

```
POST {SUPABASE_URL}/functions/v1/vapi-tool-gateway
```

```json
{
  "tool_name": "lookup_customer",
  "parameters": {
    "phone_number": "+15551234567"
  },
  "call_id": "vapi-call-id"
}
```

##### `ai-settings-elevenlabs`

Manages ElevenLabs voice configuration for VAPI assistants.

```
POST {SUPABASE_URL}/functions/v1/ai-settings-elevenlabs
```

**Action: `listVoices`**

```json
{ "action": "listVoices" }
```

**Action: `getVoice`**

```json
{ "action": "getVoice", "voiceId": "voice-id" }
```

**Action: `testVoice`**

```json
{
  "action": "testVoice",
  "voiceId": "voice-id",
  "text": "Hello, this is a test of the voice."
}
```

---

### 18 - Administration

Organization management, user management, role-based access control (RBAC), feature flags, and audit logging.

#### Tables

| Table | Description |
|-------|-------------|
| `users` | User profiles (extends Supabase auth.users) |
| `organizations` | Organization/tenant records |
| `departments` | Department definitions |
| `roles` | Role definitions |
| `permissions` | Permission definitions |
| `role_permissions` | Junction: roles to permissions |
| `user_permission_overrides` | Per-user permission overrides |
| `feature_flags` | Feature flag configurations |
| `audit_logs` | System audit trail |
| `activity_log` | User activity log |

#### REST Endpoints -- `users`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/users?select=*,role:roles(id,name),department:departments(id,name)&order=full_name.asc` | List users |
| `GET` | `/rest/v1/users?id=eq.{id}&select=*,role:roles(*),department:departments(*),overrides:user_permission_overrides(*)` | Get user detail |
| `PATCH` | `/rest/v1/users?id=eq.{id}` | Update user profile |

#### REST Endpoints -- `organizations`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/organizations?id=eq.{id}` | Get organization detail |
| `PATCH` | `/rest/v1/organizations?id=eq.{id}` | Update organization settings |

#### REST Endpoints -- `roles`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/roles?select=*,permissions:role_permissions(permission:permissions(*))&order=name.asc` | List roles with permissions |
| `POST` | `/rest/v1/roles` | Create a role |
| `PATCH` | `/rest/v1/roles?id=eq.{id}` | Update a role |
| `DELETE` | `/rest/v1/roles?id=eq.{id}` | Delete a role |

#### REST Endpoints -- `departments`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/departments?order=name.asc` | List departments |
| `POST` | `/rest/v1/departments` | Create a department |
| `PATCH` | `/rest/v1/departments?id=eq.{id}` | Update a department |
| `DELETE` | `/rest/v1/departments?id=eq.{id}` | Delete a department |

#### REST Endpoints -- `feature_flags`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/feature_flags?order=name.asc` | List feature flags |
| `PATCH` | `/rest/v1/feature_flags?id=eq.{id}` | Toggle a feature flag |

#### REST Endpoints -- `audit_logs`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/audit_logs?order=created_at.desc&limit=100` | List audit log entries |
| `GET` | `/rest/v1/audit_logs?user_id=eq.{id}&order=created_at.desc` | Get audit logs for user |

#### Edge Functions

##### `create-user`

Creates a new user with role and department assignment (admin-only).

```
POST {SUPABASE_URL}/functions/v1/create-user
```

```json
{
  "email": "employee@company.com",
  "password": "temporaryPassword123",
  "full_name": "New Employee",
  "role_id": "role-uuid",
  "department_id": "department-uuid",
  "is_active": true
}
```

**Response:**

```json
{
  "success": true,
  "user": {
    "id": "new-user-uuid",
    "email": "employee@company.com",
    "full_name": "New Employee",
    "role": { "id": "role-uuid", "name": "Sales Rep" },
    "department": { "id": "department-uuid", "name": "Sales" }
  }
}
```

---

### 19 - Integrations & Webhooks

Third-party integration management, outgoing webhook configuration, Google OAuth, client portal authentication, and secrets management.

#### Tables

| Table | Description |
|-------|-------------|
| `integrations` | Available integration definitions |
| `integration_connections` | Active integration connections |
| `outgoing_webhooks` | Outgoing webhook configurations |
| `webhook_deliveries` | Webhook delivery log |
| `google_oauth_master` | Master Google OAuth token storage |

#### REST Endpoints -- `integrations`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/integrations?order=name.asc` | List available integrations |
| `GET` | `/rest/v1/integrations?id=eq.{id}` | Get integration detail |

#### REST Endpoints -- `integration_connections`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/integration_connections?select=*,integration:integrations(id,name,icon)&order=connected_at.desc` | List active connections |
| `POST` | `/rest/v1/integration_connections` | Create a connection |
| `PATCH` | `/rest/v1/integration_connections?id=eq.{id}` | Update a connection |
| `DELETE` | `/rest/v1/integration_connections?id=eq.{id}` | Disconnect an integration |

#### REST Endpoints -- `outgoing_webhooks`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/outgoing_webhooks?order=name.asc` | List outgoing webhooks |
| `POST` | `/rest/v1/outgoing_webhooks` | Create a webhook |
| `PATCH` | `/rest/v1/outgoing_webhooks?id=eq.{id}` | Update a webhook |
| `DELETE` | `/rest/v1/outgoing_webhooks?id=eq.{id}` | Delete a webhook |

**Example: Create Outgoing Webhook**

```json
{
  "name": "New Contact Notification",
  "url": "https://hooks.example.com/new-contact",
  "events": ["contact.created", "contact.updated"],
  "headers": {
    "X-Webhook-Secret": "shared-secret-value"
  },
  "is_active": true,
  "organization_id": "org-uuid"
}
```

#### REST Endpoints -- `webhook_deliveries`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/webhook_deliveries?webhook_id=eq.{id}&order=created_at.desc&limit=50` | List delivery attempts |

#### Edge Functions

##### `integrations-connect`

Initiates an integration connection flow.

```
POST {SUPABASE_URL}/functions/v1/integrations-connect
```

```json
{
  "integration_id": "integration-uuid",
  "config": {
    "api_key": "third-party-api-key"
  }
}
```

##### `integrations-webhooks`

Processes incoming webhook payloads from integrated services.

```
POST {SUPABASE_URL}/functions/v1/integrations-webhooks
```

```json
{
  "source": "stripe",
  "event": "payment_intent.succeeded",
  "data": { ... }
}
```

##### `google-oauth-unified`

Unified Google OAuth flow supporting multiple Google services.

```
POST {SUPABASE_URL}/functions/v1/google-oauth-unified
```

```json
{
  "action": "start",
  "scopes": ["gmail", "calendar", "drive"],
  "redirect_uri": "https://app.autom8ionlab.com/settings/integrations/google/callback"
}
```

##### `google-token-refresh-cron`

Cron job that refreshes expiring Google OAuth tokens.

```
POST {SUPABASE_URL}/functions/v1/google-token-refresh-cron
```

##### `portal-auth`

Client portal authentication (passwordless via verification code).

```
POST {SUPABASE_URL}/functions/v1/portal-auth
```

**Action: `requestCode`**

```json
{
  "action": "requestCode",
  "email": "client@example.com",
  "portal_id": "portal-uuid"
}
```

**Action: `verifyCode`**

```json
{
  "action": "verifyCode",
  "email": "client@example.com",
  "code": "123456"
}
```

**Response:**

```json
{
  "success": true,
  "session_token": "portal-session-token",
  "expires_at": "2026-03-31T12:00:00Z"
}
```

**Action: `validateSession`**

```json
{
  "action": "validateSession",
  "session_token": "portal-session-token"
}
```

##### `secrets-api`

Manages application secrets and API keys.

```
POST {SUPABASE_URL}/functions/v1/secrets-api
```

**Action: `list`**

```json
{
  "action": "list"
}
```

**Response:**

```json
{
  "secrets": [
    { "name": "TWILIO_ACCOUNT_SID", "created_at": "2026-01-15T10:00:00Z" },
    { "name": "SENDGRID_API_KEY", "created_at": "2026-01-15T10:05:00Z" }
  ]
}
```

**Action: `create`**

```json
{
  "action": "create",
  "name": "NEW_API_KEY",
  "value": "sk-abc123..."
}
```

##### `secrets-scanner`

Scans for exposed or misconfigured secrets.

```
POST {SUPABASE_URL}/functions/v1/secrets-scanner
```

---

### 20 - System & Utilities

System-wide utilities including notifications, user preferences, the Clara AI assistant, meeting transcriptions, and connected account management.

#### Tables

| Table | Description |
|-------|-------------|
| `notifications` | In-app notification records |
| `user_preferences` | User preference settings |
| `user_notification_preferences` | Per-user notification channel preferences |
| `user_connected_accounts` | External accounts connected by users |
| `custom_values` | Organization-wide custom value definitions |
| `custom_value_categories` | Categories for custom values |
| `clara_memories` | Clara AI assistant memory store |
| `assistant_threads` | AI assistant conversation threads |
| `assistant_messages` | Messages within assistant threads |
| `meeting_transcriptions` | Meeting transcription records |
| `google_calendar_connections` | Google Calendar connection configurations |

#### REST Endpoints -- `notifications`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/notifications?user_id=eq.{id}&order=created_at.desc&limit=50` | List notifications |
| `PATCH` | `/rest/v1/notifications?id=eq.{id}` | Mark as read |
| `PATCH` | `/rest/v1/notifications?user_id=eq.{id}&is_read=eq.false` | Mark all as read |
| `DELETE` | `/rest/v1/notifications?id=eq.{id}` | Delete a notification |

#### REST Endpoints -- `user_preferences`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/user_preferences?user_id=eq.{id}` | Get user preferences |
| `PATCH` | `/rest/v1/user_preferences?user_id=eq.{id}` | Update preferences |

#### REST Endpoints -- `assistant_threads`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/assistant_threads?user_id=eq.{id}&order=updated_at.desc` | List assistant threads |
| `GET` | `/rest/v1/assistant_threads?id=eq.{id}&select=*,messages:assistant_messages(*)` | Get thread with messages |
| `POST` | `/rest/v1/assistant_threads` | Create a thread |
| `DELETE` | `/rest/v1/assistant_threads?id=eq.{id}` | Delete a thread |

#### REST Endpoints -- `custom_values`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rest/v1/custom_values?select=*,category:custom_value_categories(id,name)&order=sort_order.asc` | List custom values |
| `POST` | `/rest/v1/custom_values` | Create a custom value |
| `PATCH` | `/rest/v1/custom_values?id=eq.{id}` | Update a custom value |
| `DELETE` | `/rest/v1/custom_values?id=eq.{id}` | Delete a custom value |

#### Edge Functions -- Clara AI Assistant

##### `assistant-chat`

Main Clara AI chat endpoint for conversational interaction.

```
POST {SUPABASE_URL}/functions/v1/assistant-chat
```

```json
{
  "thread_id": "thread-uuid",
  "message": "What meetings do I have today?",
  "context": {
    "current_page": "dashboard",
    "timezone": "America/New_York"
  }
}
```

**Response:**

```json
{
  "success": true,
  "response": "You have 3 meetings today:\n1. 10:00 AM - Discovery Call with Jane Smith\n2. 1:00 PM - Team Standup\n3. 3:30 PM - Project Review with Acme Corp",
  "thread_id": "thread-uuid",
  "message_id": "msg-uuid"
}
```

##### `assistant-voice`

Voice interaction endpoint for Clara (speech-to-text input, text response).

```
POST {SUPABASE_URL}/functions/v1/assistant-voice
```

```json
{
  "thread_id": "thread-uuid",
  "audio_base64": "base64-encoded-audio-data",
  "format": "webm"
}
```

##### `assistant-tts`

Text-to-speech conversion for Clara responses.

```
POST {SUPABASE_URL}/functions/v1/assistant-tts
```

```json
{
  "text": "You have 3 meetings today.",
  "voice": "alloy",
  "speed": 1.0
}
```

**Response:** Audio stream (binary).

##### `assistant-tts-stream`

Streaming text-to-speech for real-time voice playback.

```
POST {SUPABASE_URL}/functions/v1/assistant-tts-stream
```

```json
{
  "text": "You have 3 meetings today.",
  "voice": "alloy"
}
```

**Response:** Server-Sent Events (SSE) audio stream.

##### `assistant-stt-wake`

Wake word detection for hands-free voice activation.

```
POST {SUPABASE_URL}/functions/v1/assistant-stt-wake
```

```json
{
  "audio_base64": "base64-encoded-short-audio",
  "format": "webm"
}
```

**Response:**

```json
{
  "wake_word_detected": true,
  "confidence": 0.95
}
```

##### `assistant-stt-final`

Final speech-to-text processing for complete utterances.

```
POST {SUPABASE_URL}/functions/v1/assistant-stt-final
```

```json
{
  "audio_base64": "base64-encoded-audio-data",
  "format": "webm"
}
```

**Response:**

```json
{
  "text": "What meetings do I have today?",
  "confidence": 0.97
}
```

##### `clara-memory-decay`

Scheduled job that decays older Clara memories to manage context relevance.

```
POST {SUPABASE_URL}/functions/v1/clara-memory-decay
```

##### `assistant-meeting-processor`

Processes meeting recordings to generate transcriptions and summaries.

```
POST {SUPABASE_URL}/functions/v1/assistant-meeting-processor
```

```json
{
  "meeting_id": "meeting-uuid",
  "audio_url": "https://storage.supabase.co/.../recording.webm",
  "generate_summary": true,
  "extract_action_items": true
}
```

**Response:**

```json
{
  "success": true,
  "transcription_id": "transcription-uuid",
  "summary": "Discussion covered Q2 targets and marketing strategy...",
  "action_items": [
    { "assignee": "John", "task": "Prepare Q2 forecast by Friday" },
    { "assignee": "Sarah", "task": "Draft new marketing campaign brief" }
  ]
}
```

#### Edge Functions -- Google Calendar Sync

##### `google-calendar-oauth`

Initiates Google Calendar OAuth connection.

```
POST {SUPABASE_URL}/functions/v1/google-calendar-oauth
```

```json
{
  "action": "start",
  "redirect_uri": "https://app.autom8ionlab.com/settings/calendar/callback"
}
```

##### `google-calendar-sync`

Full synchronization of Google Calendar events.

```
POST {SUPABASE_URL}/functions/v1/google-calendar-sync
```

```json
{
  "connection_id": "connection-uuid",
  "direction": "both"
}
```

##### `google-calendar-sync-runner`

Background runner for scheduled Google Calendar sync jobs.

```
POST {SUPABASE_URL}/functions/v1/google-calendar-sync-runner
```

---

## Common Headers Reference

| Header | Value | Required | Description |
|--------|-------|----------|-------------|
| `apikey` | `{SUPABASE_ANON_KEY}` | Always | Supabase project API key for gateway access |
| `Authorization` | `Bearer {access_token}` | Authenticated endpoints | JWT access token from sign-in |
| `Content-Type` | `application/json` | POST/PATCH requests | Request body format |
| `Accept` | `application/json` | Optional | Response format (default) |
| `Accept` | `application/vnd.pgrst.object+json` | Optional | Returns single object instead of array |
| `Prefer` | `return=representation` | Optional | Returns the created/updated record in response |
| `Prefer` | `return=minimal` | Optional | Returns no body (faster mutations) |
| `Prefer` | `count=exact` | Optional | Includes total count in Content-Range header |
| `Prefer` | `resolution=merge-duplicates` | Optional | Upsert behavior for POST with conflicts |
| `Prefer` | `missing=default` | Optional | Uses column defaults for missing fields |
| `Range` | `0-49` | Optional | Alternative pagination via HTTP Range header |
| `X-Client-Info` | `autom8ion-lab/{version}` | Optional | Client identification for logging |

---

## Environment Variables Reference

These variables are used in the Postman environment configuration and throughout the application.

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Supabase project URL | `https://xyzproject.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anonymous/public API key | `eyJhbGciOiJIUzI1NiIs...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (admin, server-side only) | `eyJhbGciOiJIUzI1NiIs...` |
| `ACCESS_TOKEN` | Current user JWT access token | `eyJhbGciOiJIUzI1NiIs...` |
| `REFRESH_TOKEN` | Current user refresh token | `v1.MjAyNi0wMy0zMC...` |
| `USER_ID` | Current authenticated user UUID | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` |
| `ORGANIZATION_ID` | Current organization UUID | `org-uuid-here` |
| `CONTACT_ID` | Test contact UUID (for convenience) | `contact-uuid-here` |
| `PIPELINE_ID` | Test pipeline UUID | `pipeline-uuid-here` |
| `PROJECT_ID` | Test project UUID | `project-uuid-here` |
| `WORKFLOW_ID` | Test workflow UUID | `workflow-uuid-here` |
| `AI_AGENT_ID` | Test AI agent UUID | `agent-uuid-here` |
| `FORM_ID` | Test form UUID | `form-uuid-here` |
| `CALENDAR_ID` | Test calendar UUID | `calendar-uuid-here` |

---

## Error Handling

### HTTP Status Codes

| Status Code | Meaning | Typical Cause |
|-------------|---------|---------------|
| `200` | OK | Successful request |
| `201` | Created | Resource successfully created |
| `204` | No Content | Successful deletion or update with `return=minimal` |
| `400` | Bad Request | Invalid request body, malformed filters, or constraint violation |
| `401` | Unauthorized | Missing or expired access token |
| `403` | Forbidden | RLS policy denied access (insufficient permissions) |
| `404` | Not Found | Resource does not exist or is not accessible |
| `406` | Not Acceptable | Single-row request returned zero or multiple rows |
| `409` | Conflict | Unique constraint violation (duplicate record) |
| `422` | Unprocessable Entity | Valid JSON but fails business logic validation |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Server-side error (database or Edge Function failure) |

### PostgREST Error Format

```json
{
  "code": "PGRST116",
  "details": "The result contains 0 rows",
  "hint": null,
  "message": "JSON object requested, multiple (or no) rows returned"
}
```

### Common PostgREST Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `PGRST000` | Could not connect to database | Check database health and connection |
| `PGRST100` | Parsing error in query parameters | Review filter syntax |
| `PGRST102` | Invalid range for pagination | Adjust limit/offset values |
| `PGRST116` | Single row expected but zero/multiple returned | Verify ID exists; use `.maybeSingle()` |
| `PGRST200` | Table/view not found | Verify table name and schema |
| `PGRST201` | Column not found | Check column name spelling |
| `PGRST204` | Column ambiguous | Qualify with table name in select |
| `PGRST301` | JWT expired | Refresh the access token |
| `PGRST302` | JWT invalid | Re-authenticate the user |

### Supabase Auth Error Format

```json
{
  "error": "invalid_grant",
  "error_description": "Invalid login credentials"
}
```

### Edge Function Error Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The 'email' field is required",
    "details": null
  }
}
```

### Common Error Handling Patterns

**Token Refresh on 401:**

```
1. Receive 401 Unauthorized response
2. POST to /auth/v1/token?grant_type=refresh_token with stored refresh token
3. Update stored access_token and refresh_token
4. Retry the original request with new access_token
```

**RLS Denied (403):**

```
1. Verify the user has the correct role/permissions
2. Check that organization_id matches the user's organization
3. Verify RLS policies on the target table
4. Check user_permission_overrides for explicit denials
```

**Conflict Resolution (409):**

```
1. Check which unique constraint was violated
2. Use Prefer: resolution=merge-duplicates for upsert operations
3. Or fetch the existing record and update instead of insert
```

---

> **Note:** This documentation covers the core API surface of Autom8ion Lab. For real-time subscriptions, use Supabase Realtime channels on any table. For file uploads, use Supabase Storage with the appropriate bucket policies. All UUIDs shown in examples are placeholders -- replace with actual values from your environment.
