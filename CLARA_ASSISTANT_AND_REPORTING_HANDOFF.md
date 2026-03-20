# Clara AI Assistant & Reporting System -- Developer Handoff

This document provides complete technical specifications for replicating the Clara AI text-chat assistant and AI reporting system in a separate CRM platform. It covers database schemas, backend edge functions, the ITS (Intent-to-System) action schema, frontend component behavior, the memory system, and the full AI reporting pipeline. Visual styling is intentionally excluded so the target team can apply their own design system.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Database Schema](#2-database-schema)
3. [ITS System Prompt & Schema](#3-its-system-prompt--schema)
4. [Backend Edge Functions -- Assistant Chat](#4-backend-edge-functions--assistant-chat)
5. [Backend Edge Functions -- AI Reporting](#5-backend-edge-functions--ai-reporting)
6. [Memory System](#6-memory-system)
7. [Frontend -- Assistant Chat Components](#7-frontend--assistant-chat-components)
8. [Frontend -- AI Reporting Components](#8-frontend--ai-reporting-components)
9. [LLM Configuration](#9-llm-configuration)
10. [Security & Permissions](#10-security--permissions)
11. [Adaptation Notes](#11-adaptation-notes)

---

## 1. Architecture Overview

### High-Level Flow -- Assistant Chat

```
User Input (text)
    |
    v
Frontend (React) -- inserts user message into assistant_messages
    |
    v
Edge Function: assistant-chat
    |
    +--> Load user profile, short-term memories, conversation history (last 40 messages)
    +--> Retrieve semantic long-term memories via vector search (OpenAI embeddings)
    +--> Build ITS system prompt (persona + schema + rules + memories + page context)
    +--> Call Anthropic Claude API (Sonnet for chat, streaming or non-streaming)
    +--> Parse JSON ITS response from LLM output
    +--> Validate ITS structure (its-validator)
    +--> Check permissions per action (its-permissions)
    +--> Check integration connectivity (its-integration-check)
    +--> Apply confirmation overrides (its-confirmation-rules)
    +--> If requires_confirmation: store in assistant_execution_requests, return plan to frontend
    +--> If no confirmation needed: execute actions via topological sort, return results
    +--> For query actions: call a second LLM pass to summarize results in natural language
    |
    v
Frontend receives response, inserts assistant message, renders by message_type
```

### High-Level Flow -- AI Reporting

```
User Prompt ("Sales performance last 30 days")
    |
    v
Frontend calls edge function: ai-report-generate
    |
    +--> Create ai_reports row (status: "running")
    +--> PLAN STAGE: Claude Opus analyzes prompt + data source schemas
    |       Output: report_plan JSON (SQL queries, chart definitions, table definitions, KPI queries)
    +--> EXECUTE: Run each SQL query via exec_report_query RPC (SELECT-only, sanitized)
    +--> COMPOSE STAGE: Claude Opus analyzes query results
    |       Output: report_compose JSON (KPIs, charts, tables, insights, recommendations)
    +--> Generate rendered HTML and CSV data
    +--> Update ai_reports row (status: "complete", result_json, rendered_html, csv_data)
    |
    v
Frontend polls report status every 3 seconds, renders complete report
```

### Technology Stack

| Layer | Technology |
|-------|-----------|
| LLM (chat) | Anthropic Claude Sonnet (`claude-sonnet-4-20250514`) |
| LLM (reports) | Anthropic Claude Opus (`claude-opus-4-20250514`) |
| Embeddings | OpenAI `text-embedding-3-small` (1536 dimensions) |
| Database | PostgreSQL via Supabase (with pgvector extension) |
| Backend | Supabase Edge Functions (Deno runtime) |
| Frontend | React 18 + TypeScript + Tailwind CSS |
| Charts | Recharts |
| Real-time | Supabase Realtime (postgres_changes) |

---

## 2. Database Schema

### 2.1 Assistant Tables

#### `assistant_profiles`

One row per user. Controls assistant behavior.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | uuid | gen_random_uuid() | Primary key |
| user_id | uuid | NOT NULL, FK to users | Owner |
| org_id | uuid | NOT NULL, FK to organizations | Organization |
| enabled | boolean | true | Is assistant enabled |
| voice_enabled | boolean | false | Voice features (not relevant for text-only) |
| elevenlabs_voice_id | text | NULL | Voice ID (not relevant for text-only) |
| elevenlabs_voice_name | text | NULL | Voice name (not relevant for text-only) |
| speech_rate | numeric | 1.0 | Speech rate (not relevant for text-only) |
| output_volume | numeric | 1.0 | Volume (not relevant for text-only) |
| auto_speak_chat | boolean | false | Auto-speak (not relevant for text-only) |
| confirm_all_writes | boolean | true | Require confirmation for all write actions |
| system_prompt_override | text | NULL | Custom system prompt appended to base prompt |
| wake_word_enabled | boolean | false | (not relevant for text-only) |
| wake_word | text | 'Hey Clara' | (not relevant for text-only) |
| barge_in_enabled | boolean | false | (not relevant for text-only) |
| created_at | timestamptz | now() | |
| updated_at | timestamptz | now() | |

**Unique constraint**: `(user_id)`

#### `assistant_threads`

Conversation threads.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | uuid | gen_random_uuid() | Primary key |
| user_id | uuid | NOT NULL | Owner |
| org_id | uuid | NOT NULL | Organization |
| title | text | NULL | Auto or user-set title |
| context_module | text | NULL | Module the thread was opened from (e.g., "contacts") |
| context_record_id | uuid | NULL | Record ID for context (e.g., a contact ID) |
| status | text | 'active' | 'active' or 'archived' |
| created_at | timestamptz | now() | |
| updated_at | timestamptz | now() | |

#### `assistant_messages`

Individual messages in threads.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | uuid | gen_random_uuid() | Primary key |
| thread_id | uuid | NOT NULL, FK to assistant_threads | Thread |
| role | text | NOT NULL | 'user', 'assistant', or 'system' |
| content | text | NOT NULL | Message text content |
| message_type | text | 'text' | See message types below |
| tool_calls | jsonb | NULL | Array of tool call objects |
| metadata | jsonb | NULL | Arbitrary metadata (confirmations, drafts, ITS request, execution results) |
| created_at | timestamptz | now() | |

**CHECK constraint on `message_type`**: `text`, `tool_result`, `action_confirmation`, `draft_preview`, `meeting_summary`, `error`, `voice_transcript`, `execution_plan`, `execution_result`

#### `assistant_user_memory` (Short-Term Key-Value Memory)

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | uuid | gen_random_uuid() | Primary key |
| user_id | uuid | NOT NULL | Owner |
| org_id | uuid | NOT NULL | Organization |
| memory_key | text | NOT NULL | Key identifier |
| memory_value | jsonb | NOT NULL | Value (any JSON) |
| category | text | 'general' | One of: scheduling, communication, preferences, contacts, rules, general |
| created_at | timestamptz | now() | |
| updated_at | timestamptz | now() | |

**Unique constraint**: `(user_id, memory_key)` -- enables upsert behavior

#### `clara_memories` (Long-Term Semantic Memory)

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | uuid | gen_random_uuid() | Primary key |
| organization_id | uuid | NOT NULL | Organization |
| user_id | uuid | NOT NULL | Owner |
| memory_type | text | NOT NULL | One of: preference, communication_style, decision, contact_context, recurring_pattern, strategic_context, behavior_pattern |
| title | text | NULL | Optional short title |
| content | text | NOT NULL | Memory content |
| embedding | vector(1536) | NULL | OpenAI embedding vector |
| importance_score | integer | 5 | 1-10 scale, decays daily |
| last_accessed_at | timestamptz | NULL | Last retrieval time |
| created_at | timestamptz | now() | |
| updated_at | timestamptz | now() | |

**Index**: IVFFlat index on `embedding` column using cosine distance: `CREATE INDEX idx_clara_memories_embedding ON clara_memories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);`

**RPC function `search_clara_memories`**:
```sql
CREATE OR REPLACE FUNCTION search_clara_memories(
  p_user_id uuid,
  p_query_embedding vector(1536),
  p_memory_types text[] DEFAULT NULL,
  p_limit integer DEFAULT 5
)
RETURNS TABLE (
  id uuid, memory_type text, title text, content text,
  importance_score integer, similarity float
)
AS $$
  SELECT m.id, m.memory_type, m.title, m.content, m.importance_score,
         1 - (m.embedding <=> p_query_embedding) AS similarity
  FROM clara_memories m
  WHERE m.user_id = p_user_id
    AND m.embedding IS NOT NULL
    AND m.importance_score > 0
    AND (p_memory_types IS NULL OR m.memory_type = ANY(p_memory_types))
  ORDER BY m.embedding <=> p_query_embedding
  LIMIT p_limit;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

**Memory decay function** (runs daily via pg_cron):
```sql
CREATE OR REPLACE FUNCTION decrement_clara_memory_score()
RETURNS void AS $$
  UPDATE clara_memories
  SET importance_score = GREATEST(importance_score - 1, 0),
      updated_at = now()
  WHERE importance_score > 0;
$$ LANGUAGE sql VOLATILE SECURITY DEFINER;
```

**Cron schedule**: `SELECT cron.schedule('clara-memory-decay', '0 4 * * *', 'SELECT decrement_clara_memory_score()');`

#### `assistant_execution_requests`

Stores pending and completed action execution plans.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | uuid | PK | Execution request ID |
| user_id | uuid | NOT NULL | Owner |
| org_id | uuid | NOT NULL | Organization |
| thread_id | uuid | NULL | Associated thread |
| intent | text | NOT NULL | Short intent description |
| confidence | numeric | NOT NULL | 0.0 - 1.0 |
| requires_confirmation | boolean | NOT NULL | Whether user confirmation is needed |
| confirmation_reason | text | NULL | Why confirmation is required |
| actions | jsonb | NOT NULL | Array of ITS action objects |
| response_to_user | text | NOT NULL | Human-readable response |
| execution_status | text | NOT NULL | pending, executing, success, partial, failed, awaiting_confirmation |
| results | jsonb | '[]' | Array of action results |
| model_used | text | NULL | LLM model identifier |
| raw_llm_output | jsonb | NULL | Raw LLM response for debugging |
| created_at | timestamptz | now() | |
| completed_at | timestamptz | NULL | |

#### `assistant_action_logs`

Individual action execution audit trail.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | uuid | gen_random_uuid() | Primary key |
| user_id | uuid | NOT NULL | Owner |
| org_id | uuid | NOT NULL | Organization |
| thread_id | uuid | NULL | Thread |
| request_id | uuid | NULL | Execution request ID |
| execution_request_id | uuid | NULL | Same as request_id (linked) |
| action_id | text | NULL | ITS action_id (e.g., "a-1") |
| action_type | text | NOT NULL | ITS action type |
| target_module | text | NULL | Module name |
| target_id | uuid | NULL | Created/affected resource ID |
| input_summary | text | NULL | Human-readable action description |
| output_summary | text | NULL | Human-readable result |
| execution_status | text | NOT NULL | success, failed, running, queued, canceled |
| execution_time_ms | integer | NULL | Duration in milliseconds |
| error_message | text | NULL | Error detail |
| tool_calls | jsonb | NULL | Raw action + output data |
| depends_on | text | NULL | action_id this depends on |
| confirmed_by_user | boolean | NULL | True if user confirmed |
| created_at | timestamptz | now() | |

### 2.2 AI Reporting Tables

#### `ai_reports`

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | uuid | gen_random_uuid() | Primary key |
| organization_id | uuid | NOT NULL | Organization |
| created_by_user_id | uuid | NOT NULL | Creator |
| scope | text | NOT NULL | 'my', 'team', or 'org' |
| report_category | text | 'custom' | sales, marketing, ops, reputation, finance, projects, custom |
| report_name | text | NOT NULL | Report title |
| timeframe_start | timestamptz | NULL | Period start |
| timeframe_end | timestamptz | NULL | Period end |
| status | text | 'running' | running, complete, failed |
| plan_json | jsonb | NULL | Report plan from Stage 1 |
| result_json | jsonb | NULL | Final compose from Stage 2 |
| rendered_html | text | NULL | Standalone HTML export |
| csv_data | text | NULL | CSV export data |
| prompt | text | NOT NULL | Original user prompt |
| parent_report_id | uuid | NULL | FK to ai_reports for follow-ups/versions |
| data_sources_used | text[] | '{}' | Array of table names queried |
| filters_applied | jsonb | '{}' | Applied filters |
| error_message | text | NULL | Error detail if failed |
| delete_at | timestamptz | now() + 90 days | Auto-expiry TTL |
| created_at | timestamptz | now() | |
| updated_at | timestamptz | now() | |

#### `ai_report_schedules`

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | uuid | gen_random_uuid() | Primary key |
| organization_id | uuid | NOT NULL | Organization |
| user_id | uuid | NOT NULL | Owner |
| report_plan_template_json | jsonb | NOT NULL | Template plan used for regeneration |
| original_report_id | uuid | NULL | FK to ai_reports |
| cadence_days | integer | NOT NULL | Days between runs |
| next_run_at | timestamptz | NOT NULL | When to next generate |
| last_run_at | timestamptz | NULL | Last generation time |
| is_active | boolean | true | Whether schedule is active |
| report_name_template | text | NOT NULL | Template for report name |
| scope | text | NOT NULL | my, team, or org |
| prompt_template | text | NOT NULL | Original prompt for regeneration |
| created_at | timestamptz | now() | |
| updated_at | timestamptz | now() | |

#### `ai_report_queries`

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | uuid | gen_random_uuid() | Primary key |
| organization_id | uuid | NOT NULL | Organization |
| report_id | uuid | NULL | Associated report |
| user_id | uuid | NOT NULL | Requester |
| natural_query | text | NOT NULL | Natural language question |
| generated_sql | text | NULL | AI-generated SQL |
| result_json | jsonb | NULL | Query results |
| answer_text | text | NULL | Natural language answer |
| chart_recommendation | jsonb | NULL | Suggested chart config |
| tokens_used | integer | 0 | LLM tokens consumed |
| status | text | 'pending' | pending, running, complete, failed |
| error_message | text | NULL | |
| model_used | text | NULL | |
| execution_time_ms | integer | NULL | |
| created_at | timestamptz | now() | |

### 2.3 Key RPC Functions

#### `exec_report_query(query_text text)`
Executes a SELECT-only SQL query. Used by the report generation pipeline. Must be `SECURITY DEFINER` to bypass RLS for aggregate reporting.

#### `cleanup_expired_ai_reports()`
Deletes ai_reports where `delete_at <= now()`. Called by a daily cron job.

#### `user_can_access_report(p_user_id uuid, p_report_id uuid)`
Returns boolean. Checks if the user created the report or has org-level access.

---

## 3. ITS System Prompt & Schema

### 3.1 Root JSON Schema

The LLM is instructed to always output a single JSON object:

```json
{
  "intent": "short_description_of_what_user_wants",
  "confidence": 0.0 to 1.0,
  "requires_confirmation": true/false,
  "confirmation_reason": "string or null",
  "actions": [ ...action objects... ],
  "response_to_user": "Natural language summary"
}
```

For conversational replies (no actions needed):
```json
{
  "intent": "clarification",
  "confidence": 1.0,
  "requires_confirmation": false,
  "confirmation_reason": null,
  "actions": [],
  "response_to_user": "The assistant's conversational response"
}
```

### 3.2 Action Object Schema

```json
{
  "action_id": "a-1",
  "type": "ACTION_TYPE",
  "module": "MODULE_NAME",
  "payload": { /* fields specific to action type */ },
  "depends_on": "action_id of prerequisite or null"
}
```

### 3.3 Complete Action Type Registry

#### Read/Query Actions (never require confirmation)

| Type | Module | Required Payload | Optional Payload |
|------|--------|-----------------|------------------|
| `query_schedule` | calendar | `date_from` (YYYY-MM-DD), `date_to` (YYYY-MM-DD) | |
| `query_contacts` | contacts | `search` (string) | `limit` (number, default 10) |
| `query_opportunities` | opportunities | | `status` (open/won/lost/all), `pipeline_id`, `search`, `date_from`, `date_to`, `limit` |
| `query_tasks` | tasks | | `status` (pending/in_progress/completed/all), `date_from`, `date_to`, `priority`, `limit` |
| `query_projects` | projects | | `status` (active/completed/on_hold/cancelled/all), `search`, `limit` |
| `query_proposals` | proposals | | `status` (draft/sent/viewed/accepted/declined/all), `search`, `limit` |
| `query_analytics` | reporting | `metric` (string) | `filters` (object), `date_range` ({ from, to }) |

#### Write/Mutate Actions

| Type | Module | Required Payload | Optional Payload |
|------|--------|-----------------|------------------|
| `create_contact` | contacts | `first_name` | `last_name`, `email`, `phone`, `company`, `tags` (string[]), `custom_fields` (object) |
| `update_contact` | contacts | `contact_id` (uuid), `updates` (object) | |
| `create_opportunity` | opportunities | `contact_id`, `pipeline_id`, `stage_id` | `value_amount`, `close_date`, `source` |
| `move_opportunity` | opportunities | `opportunity_id`, `new_stage_id` | |
| `create_project` | projects | `name` | `opportunity_id`, `description`, `budget_amount`, `start_date`, `target_end_date` |
| `create_task` | tasks | `title` | `description`, `due_date`, `priority`, `related_to_type`, `related_to_id` |
| `draft_email` | email | `to` (email[]), `subject`, `body` | `cc` (email[]), `thread_id` |
| `send_email` | email | | `draft_id`, `to` (email[]), `cc`, `subject`, `body`, `reply_to_message_id` |
| `send_sms` | sms | `contact_id`, `message` | |
| `create_event` | calendar | `title`, `start_time` (ISO), `end_time` (ISO) | `description`, `attendees` (email[]), `location` |
| `update_event` | calendar | `event_id`, `updates` (object) | |
| `cancel_event` | calendar | `event_id` | |
| `create_proposal_draft` | proposals | `contact_id`, `title` | `opportunity_id`, `scope_summary`, `pricing_items`, `total_estimate` |

#### Memory Actions

| Type | Module | Required Payload | Optional Payload |
|------|--------|-----------------|------------------|
| `remember` | memory | `key`, `value` | `category` (scheduling/communication/preferences/contacts/rules/general) |
| `store_memory` | memory | `memory_type`, `content` | `title`, `importance_score` (1-10) |

`memory_type` values for `store_memory`: `preference`, `communication_style`, `decision`, `contact_context`, `recurring_pattern`, `strategic_context`, `behavior_pattern`

### 3.4 Validation Rules (its-validator)

Field validation types used during payload validation:

| Type | Validation |
|------|-----------|
| `string` | typeof === 'string', non-empty if required |
| `number` | typeof === 'number', not NaN |
| `boolean` | typeof === 'boolean' |
| `uuid` | Regex: `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` |
| `email` | Regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` |
| `iso_date` | Regex: `/^\d{4}-\d{2}-\d{2}$/` |
| `iso_datetime` | Regex: `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/` |
| `email_array` | Array where each element matches email regex |
| `string_array` | Array where each element is a string |
| `array` | Array.isArray check |
| `object` | typeof === 'object' && !Array.isArray |

Additional validations:
- `action_id` uniqueness across all actions
- `module` must match the expected module for the given `type` (enforced by MODULE_MAP)
- `depends_on` must reference an existing `action_id` if not null
- Unknown payload keys are stripped via `stripUnknownKeys`

### 3.5 ITS Behavioral Rules (Embedded in System Prompt)

1. Output ONLY the JSON object -- no markdown, no backticks, no explanation outside JSON.
2. Only use listed action types. Unknown types are rejected.
3. Never hallucinate UUIDs. Use query actions to look up IDs first.
4. `requires_confirmation=true` for: `send_email`, `cancel_event`, `create_proposal_draft`. Read/query actions NEVER require confirmation.
5. Default to `draft_email` for email. Only use `send_email` if user explicitly says "send".
6. Chain dependent actions with `depends_on`.
7. If required fields are missing and cannot be inferred, ask a clarifying question (empty actions array).
8. Keep `response_to_user` concise, professional, first person.
9. Use user's timezone and preferences from memory.
10. For schedule/calendar queries, use `query_schedule` immediately without asking for confirmation.
11. For contact references by name, use `query_contacts` to look them up first.
12. For any data question, use the appropriate query action. Never say "I can't access data."
13. For query actions, `response_to_user` should be a brief placeholder ("Let me check your schedule.") -- the system replaces it with actual data after execution.
14. Today's date is injected as `{CURRENT_DATE}` -- use for relative date resolution.
15. Automatically emit `store_memory` actions when user expresses preferences, corrects tone/style, makes business decisions, shares contact context, describes recurring patterns, or rejects approaches. Do NOT mention memory storage in `response_to_user`.
16. For `store_memory`, use `importance_score` 8-10 for strategic context.

### 3.6 System Prompt Assembly

The system prompt is built from these sections in order:

1. **Persona**: "You are Clara, a personal AI executive assistant for {fullName} ({email})..."
2. **Role list**: Schedule lookup, contact management, email, calendar, opportunities, proposals, pipeline summaries
3. **ITS Schema Spec**: Full JSON schema with all action types and payloads
4. **Rules**: The 16 behavioral rules above (with `{CURRENT_DATE}` replaced by today's date)
5. **Short-term Memories** (if any): `USER MEMORIES (use these to personalize responses):\n- [{category}] {key}: {value}`
6. **Semantic Memories** (if any): `RELEVANT LONG-TERM MEMORY:\n- ({memory_type}) {title}: {content}`
7. **Page Context** (if any): `CURRENT PAGE CONTEXT:\n- Module: {module}\n- Record ID: {id}\n- Path: {path}`
8. **Custom Prompt** (if any): `ADDITIONAL USER INSTRUCTIONS:\n{system_prompt_override}`

---

## 4. Backend Edge Functions -- Assistant Chat

### 4.1 Endpoint: `assistant-chat`

**Method**: POST
**Auth**: Bearer token (JWT) or service role key with `internal_user_id`

#### Request Body

```typescript
{
  thread_id: string;          // Required
  content?: string;           // User message (for normal chat)
  context?: {                 // Current page context
    current_path: string;
    current_module: string | null;
    current_record_id: string | null;
  };
  stream?: boolean;           // Enable SSE streaming
  action?: 'confirm';         // For confirmation flow
  execution_request_id?: string;  // For confirmation flow
  approved?: boolean;         // For confirmation flow
  action_ids?: string[];      // Selective action approval
  internal_user_id?: string;  // Service-role impersonation
}
```

#### Response (non-streaming)

```typescript
{
  response: string;                    // Natural language response text
  its_request: ITSRequest | null;      // Parsed ITS request
  execution_result: {                  // Execution outcome
    execution_id: string;
    status: 'success' | 'partial' | 'failed' | 'awaiting_confirmation';
    results: Array<{
      action_id: string;
      status: 'success' | 'failed' | 'skipped' | 'awaiting_confirmation';
      resource_id: string | null;
      error: string | null;
      query_data?: unknown;
    }>;
  } | null;
  tool_calls: Array<{                 // Tool call receipts
    id: string;
    tool_name: string;
    input: object;
    output: unknown;
    status: 'success' | 'error';
    duration_ms: number;
  }>;
  confirmations_pending: Array<{       // Pending confirmations
    id: string;
    action_type: string;
    description: string;
    details: object;
    status: 'pending';
  }>;
  drafts: Array<{                      // Email drafts
    id: string;
    type: 'email';
    to: string;
    subject: string;
    body: string;
    confirmation_id: string;
  }>;
  model_used: string;                  // LLM model identifier
}
```

#### SSE Streaming Response

When `stream: true`, the response is `text/event-stream`:

| Event Type | Description | Payload |
|-----------|-------------|---------|
| `token` | Individual text token | `{ type: "token", text: "..." }` |
| `plan` | Execution plan requiring confirmation | `{ type: "plan", its_request, response, model_used }` |
| `execution_result` | Actions executed | `{ type: "execution_result", response, its_request, execution_result, model_used }` |
| `done` | Conversational response (no actions) | `{ type: "done", response, model_used }` |
| `error` | Error occurred | `{ type: "error", message: "..." }` |

Terminal event: `data: [DONE]\n\n`

### 4.2 Processing Pipeline (Detailed)

#### Step 1: Authentication & User Loading
```
1. Extract user context from JWT or service role key
2. Load user record from users table
3. If action === "confirm", branch to confirmation handler
```

#### Step 2: Context Assembly
```
1. Load assistant_profiles for the user
2. Load assistant_user_memory (short-term KV memories)
3. Load last 40 messages from assistant_messages for the thread
4. Resolve LLM config (org-level provider or fallback to env var)
```

#### Step 3: Semantic Memory Retrieval
```
1. Generate embedding for user's message via OpenAI text-embedding-3-small
2. Call search_clara_memories RPC with embedding, limit 5
3. Returns memories ranked by cosine similarity
```

#### Step 4: System Prompt Construction
```
buildITSSystemPrompt(user, profile, memories, context, semanticMemories)
```
See Section 3.6 for full structure.

#### Step 5: LLM Call
```
Call Anthropic Messages API:
  model: claude-sonnet-4-20250514
  temperature: 0.2
  max_tokens: 4096
  system: assembled system prompt
  messages: conversation history + current message
```

#### Step 6: ITS Parsing
The `parseITSFromLLM` function:
1. Strip markdown code fences if present
2. Find first `{` and last `}` in output
3. Extract substring and `JSON.parse`
4. Returns null if no valid JSON found (treated as conversational response)

#### Step 7: Validation Pipeline
```
1. validateITSRequest(parsed)     -- structure validation
2. validateActionPayload(action)  -- per-action field validation
3. stripUnknownKeys(action)       -- remove unexpected fields
4. validatePermissions(actions, user) -- check RBAC
5. validateIntegrationState(actions, context) -- check Gmail/Calendar/Phone connected
6. applyConfirmationOverrides(request, context) -- force confirmation if needed
```

#### Step 8: Execution or Confirmation Storage

**If `requires_confirmation`**:
1. Insert into `assistant_execution_requests` with status `awaiting_confirmation`
2. Insert action log entries with status `queued`
3. Return plan to frontend

**If no confirmation needed**:
1. Topological sort actions by `depends_on`
2. Execute sequentially
3. For each action: resolve dependency IDs (replace parent action_id with actual resource_id)
4. Log each action to `assistant_action_logs`
5. Update `assistant_execution_requests` with final status

#### Step 9: Query Result Summarization

If any query actions returned `query_data`, a second LLM call summarizes results:

```
System: "You are Clara, a personal AI assistant for {name}. The user asked: '{message}'"
+ data blocks from query results
+ instructions for natural language formatting

Model: claude-sonnet-4-20250514
Temperature: 0.2
Max tokens: 4096
```

If the LLM returns JSON instead of text, a template-based fallback generates the summary.

### 4.3 Confirmation Flow

When the user approves/rejects a pending execution plan:

```
POST /functions/v1/assistant-chat
{
  thread_id: "...",
  action: "confirm",
  execution_request_id: "...",
  approved: true/false,
  action_ids: ["a-1", "a-2"]  // optional selective approval
}
```

**If rejected**: Update execution_requests to "failed", action_logs to "canceled"

**If approved**:
1. Optionally filter to only approved `action_ids`
2. Execute the action plan (same as Step 8)
3. Return execution results

### 4.4 Action Execution Details

Each action type maps to specific database operations:

| Action | Operation |
|--------|-----------|
| `create_contact` | INSERT into contacts (auto-assigns department, owner, source='clara_assistant') |
| `update_contact` | UPDATE contacts WHERE id AND organization_id |
| `create_opportunity` | INSERT into opportunities |
| `move_opportunity` | UPDATE opportunities SET stage_id, stage_changed_at |
| `create_project` | INSERT into projects (auto-resolves pipeline, stage, department, contact from opportunity) |
| `create_task` | INSERT into calendar_tasks (auto-resolves calendar) |
| `draft_email` | Returns success with pseudo resource_id `draft-{action_id}` (no DB write) |
| `send_email` | Resolves Gmail OAuth token, creates RFC 2822 raw email, calls Gmail API `messages/send` |
| `send_sms` | Returns success (stub - implement with your SMS provider) |
| `create_event` | Resolves Calendar OAuth token, calls Google Calendar API `events` |
| `update_event` | PATCH Google Calendar event |
| `cancel_event` | DELETE Google Calendar event |
| `create_proposal_draft` | INSERT into proposals + proposal_line_items |
| `query_schedule` | Parallel queries to calendar_events, calendar_tasks, appointments, google_calendar_events |
| `query_contacts` | Multi-word search across first_name, last_name, email, phone, company |
| `query_opportunities` | Filtered query with status, pipeline, date range |
| `query_tasks` | Filtered query with status, priority, date range |
| `query_projects` | Filtered query with status, search |
| `query_proposals` | Filtered query with status, search |
| `query_analytics` | Aggregate query (pipeline/opportunity or contact counts) |
| `remember` | UPSERT into assistant_user_memory (key/value) |
| `store_memory` | Generate embedding via OpenAI, INSERT into clara_memories |

### 4.5 Dependency Resolution

The `resolveDependencyIds` function replaces placeholder references:
- If an action has `depends_on` pointing to a parent action
- And its payload contains `contact_id`, `opportunity_id`, or `project_id` set to the parent's `action_id`
- The value is replaced with the parent's actual `resource_id` from execution

This enables chaining like: "Create contact John Smith and then create an opportunity for him" where the opportunity's `contact_id` automatically resolves to the newly created contact's ID.

### 4.6 Topological Sort

Actions are executed in dependency order using a recursive DFS:
1. Build a map of action_id -> action
2. Visit each action; if it has `depends_on`, visit the dependency first
3. Add to sorted list after dependencies are visited

---

## 5. Backend Edge Functions -- AI Reporting

### 5.1 Endpoint: `ai-report-generate`

**Method**: POST
**Auth**: Bearer token (JWT)

#### Request Body
```typescript
{
  prompt: string;
  scope: 'my' | 'team' | 'org';
  timeframe: {
    type: 'preset' | 'custom';
    preset?: string;  // last_7_days, last_30_days, this_month, etc.
    customStart?: string;  // ISO date
    customEnd?: string;    // ISO date
  };
  parent_report_id?: string;  // For follow-up reports
}
```

#### Response
```typescript
{
  success: boolean;
  report_id: string;
  report: AIReport;  // Full report object with result_json
  tokens_used: number;
}
```

### 5.2 Two-Stage Pipeline

#### Stage 1: Plan

**Model**: Claude Opus (`claude-opus-4-20250514`)
**Temperature**: 0.15
**Max tokens**: 8192

The system prompt provides 12 data source schemas (contacts, conversations, appointments, opportunities, invoices, payments, tasks, ai_runs, reviews, workflows, forms, projects) with their table names and field definitions.

**Output**: `report_plan` JSON:
```typescript
{
  type: "report_plan",
  report_name: string,
  report_category: string,
  scope: string,
  timeframe: { preset, start, end },
  data_sources: [{ module, entities, fields }],
  sql_queries: [{ id, purpose, sql }],
  charts: [{ chart_id, title, type, query_id, series, x }],
  tables: [{ table_id, title, query_id, columns }],
  kpi_queries: [{ id, label, sql, format }]
}
```

SQL queries use template placeholders: `{{ORG_ID}}`, `{{USER_ID}}`, `{{DEPARTMENT_ID}}`, `{{TIME_RANGE_START}}`, `{{TIME_RANGE_END}}`

#### SQL Sanitization

Before execution, each SQL query is validated:
- Must start with `SELECT` (case-insensitive)
- Blocked keywords: INSERT, UPDATE, DELETE, DROP, CREATE, ALTER, TRUNCATE, EXEC, EXECUTE, `--`, `;.*SELECT`

Template placeholders are then replaced with actual values:
```
{{ORG_ID}} -> user.orgId
{{USER_ID}} -> user.id
{{DEPARTMENT_ID}} -> user.departmentId
{{TIME_RANGE_START}} -> calculated start date
{{TIME_RANGE_END}} -> calculated end date
```

Queries are executed via `exec_report_query` RPC (SECURITY DEFINER).

#### Stage 2: Compose

**Model**: Claude Opus (`claude-opus-4-20250514`)
**Temperature**: 0.15
**Max tokens**: 8192

The compose prompt includes:
- Report plan metadata
- Chart/table/KPI definitions from Stage 1
- All query results (first 50 rows each)

**Output**: `report_compose` JSON:
```typescript
{
  type: "report_compose",
  title: string,
  executive_summary: string,      // 2-4 paragraph narrative
  kpis: [{                         // 4-6 key metrics
    label, value, delta_pct, trend, format
  }],
  charts: [{                       // Visualizations
    chart_id, title, type, config, data: [{ x_label, series_name: value }]
  }],
  tables: [{                       // Summary tables
    table_id, title,
    columns: [{ key, label, format }],
    rows: [{ col_key: value }]
  }],
  insights: string[],              // Data-driven observations
  recommendations: string[],      // Actionable advice
  dashboard_cards: [{              // Dashboard widgets
    card_id, title, value, trend, delta_pct, category
  }]
}
```

#### Post-Processing

After compose:
1. Generate standalone HTML report (`generateRenderedHTML`)
2. Generate CSV data (`generateCSVData`)
3. Update `ai_reports` row with status "complete", result_json, rendered_html, csv_data

### 5.3 Timeframe Resolution

| Preset | Start | End |
|--------|-------|-----|
| `today` | Start of today | Now |
| `yesterday` | Start of yesterday | Start of today |
| `last_7_days` | 7 days ago | Now |
| `last_30_days` | 30 days ago | Now |
| `last_90_days` | 90 days ago | Now |
| `this_month` | 1st of current month | Now |
| `last_month` | 1st of previous month | 1st of current month |
| `this_quarter` | 1st of current quarter | Now |
| `last_quarter` | 1st of previous quarter | 1st of current quarter |
| `this_year` | Jan 1 of current year | Now |
| `last_year` | Jan 1 of previous year | Jan 1 of current year |
| `custom` | `customStart` | `customEnd` |

### 5.4 Data Source Schemas (Available for Report Queries)

| Source Name | Table | Key Fields |
|-------------|-------|------------|
| contacts | contacts | id, first_name, last_name, email, status, source, lead_score, created_at |
| conversations | conversations | id, contact_id, status, unread_count, created_at, last_message_at |
| appointments | appointments | id, contact_id, status (scheduled/completed/canceled/no_show), start_at_utc |
| opportunities | opportunities | id, contact_id, pipeline_id, stage_id, status (open/won/lost), value_amount |
| invoices | invoices | id, contact_id, status (draft/sent/paid/overdue/void), total_amount, paid_amount, balance_due |
| payments | payments | id, invoice_id, amount, status (pending/completed/failed/refunded), payment_date |
| tasks | contact_tasks | id, contact_id, title, status, priority, due_date |
| ai_runs | ai_agent_runs | id, agent_id, status, tokens_used, execution_time_ms |
| reviews | reviews | id, provider, rating (1-5), sentiment, received_at |
| workflows | workflow_enrollments | id, workflow_id, contact_id, status |
| forms | form_submissions | id, form_id, contact_id, submitted_at |
| projects | projects | id, name, status, budget, actual_cost, start_date, due_date |

### 5.5 Supporting Edge Functions

#### `ai-report-query`
Natural language question -> single SQL query -> answer.
Used for ad-hoc questions within a report context.

#### `ai-report-schedule-runner`
Triggered by cron. Fetches schedules where `next_run_at <= NOW()` and `is_active = true`, limit 10. For each, calls `ai-report-generate` internally, then updates `next_run_at` to `now() + cadence_days * interval '1 day'`.

#### `ai-report-cleanup`
Triggered by cron. Calls `cleanup_expired_ai_reports()` RPC to delete reports past their `delete_at` TTL.

### 5.6 Follow-Up Reports

When `parent_report_id` is provided:
1. Load the parent report's name, prompt, and result_json
2. Append parent context to the Plan stage prompt
3. The LLM considers prior findings when creating the new plan
4. The new report is linked to the parent via `parent_report_id`

---

## 6. Memory System

### 6.1 Short-Term Memory (Key-Value)

**Table**: `assistant_user_memory`
**Mechanism**: UPSERT on `(user_id, memory_key)`

Triggered by the `remember` action type. The LLM emits this when the user says things like "remember that I prefer morning meetings."

Categories: `scheduling`, `communication`, `preferences`, `contacts`, `rules`, `general`

Injected into system prompt as:
```
USER MEMORIES:
- [scheduling] preferred_meeting_time: "morning"
- [communication] email_style: "brief and professional"
```

### 6.2 Long-Term Semantic Memory (Vector)

**Table**: `clara_memories`
**Mechanism**: OpenAI embedding generation + pgvector cosine similarity search

Triggered by the `store_memory` action type. The LLM automatically emits this (silently, alongside other actions) when it detects:
- User preferences or style corrections
- Business decisions or strategic context
- Contact relationship information
- Recurring behavioral patterns

**Storage flow**:
1. Concatenate `title + ": " + content` (or just content if no title)
2. Call OpenAI `text-embedding-3-small` (truncate to 8000 chars)
3. Store embedding as vector(1536) in `clara_memories`

**Retrieval flow**:
1. Embed the user's current message
2. Call `search_clara_memories` RPC
3. Returns top 5 memories by cosine similarity where `importance_score > 0`
4. Inject into system prompt as `RELEVANT LONG-TERM MEMORY`

**Decay**: Daily cron at 4:00 AM UTC decrements all `importance_score` values by 1 (minimum 0). Memories with score 0 are excluded from search results. High-importance memories (8-10) persist for weeks; low-importance ones (1-3) fade within days.

---

## 7. Frontend -- Assistant Chat Components

### 7.1 Component Hierarchy

```
AssistantFAB (floating button, bottom-right corner)
  |
  v (toggles)
AssistantPanel (slide-in panel, tabbed: Chat | Voice | Activity | Settings)
  |
  +--> AssistantChatView (chat tab)
  |      +--> ThreadSelector (thread list + new thread button)
  |      +--> Message list (scrollable)
  |      |      +--> MessageBubble (per message)
  |      |            +--> ClaraMarkdown (for text content)
  |      |            +--> ExecutionPlanCard (for execution_plan messages)
  |      |            +--> ExecutionResultCard (for execution_result messages)
  |      |            +--> ToolReceiptCard (for tool_calls)
  |      |            +--> ActionConfirmationCard (for confirmations)
  |      |            +--> DraftPreviewCard (for email drafts)
  |      +--> Input field + send button
```

Also:
- `AskClaraButton` -- inline button placed on specific pages, passes page context to assistant

### 7.2 AssistantContext (React Context)

**State managed**:
```typescript
{
  panelOpen: boolean;
  activeTab: 'chat' | 'voice' | 'activity' | 'settings';
  threads: AssistantThread[];
  activeThread: AssistantThread | null;
  messages: AssistantMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  streamingContent: string;  // Accumulated tokens during streaming
  profile: AssistantProfile | null;
  pageContext: ClaraPageContext;
}
```

**Key behaviors**:
- Keyboard shortcut: Cmd+Shift+K (Mac) / Ctrl+Shift+K (Windows) to toggle panel
- `openWithContext(module, recordId)` -- opens panel with pre-set page context (used by AskClaraButton)
- Auto-loads threads and profile on mount
- Page context is derived from current route path

### 7.3 Message Flow (Streaming)

1. User types message and clicks send
2. Frontend calls `sendMessageStreaming(threadId, content, context)`
3. User message is inserted into `assistant_messages` via Supabase client
4. Thread `updated_at` is touched
5. Frontend calls `streamEdgeFunction('assistant-chat', { thread_id, content, context, stream: true })`
6. Response is read as SSE stream via `parseSSEStream`
7. For each `token` event: append text to `streamingContent` state
8. For `plan` event: show ExecutionPlanCard with approve/reject buttons
9. For `execution_result` event: show ExecutionResultCard with action results
10. For `done` event: finalize the message
11. After stream ends, `persistStreamedAssistantMessage` inserts the complete assistant message

### 7.4 Message Rendering by Type

| message_type | Component | Description |
|-------------|-----------|-------------|
| `text` | ClaraMarkdown | Renders markdown content using react-markdown |
| `execution_plan` | ExecutionPlanCard | Shows proposed actions with Approve/Reject buttons |
| `execution_result` | ExecutionResultCard | Shows action results (success/failure per action) |
| `tool_result` | ToolReceiptCard | Shows individual tool call receipts |
| `action_confirmation` | ActionConfirmationCard | Legacy confirmation cards |
| `draft_preview` | DraftPreviewCard | Shows email draft preview (to, subject, body) |
| `error` | Error styling | Red alert with error text |

### 7.5 Response Parsing

The `extractCleanResponse` function (from `claraResponseParser.ts`) extracts the `response_to_user` field from JSON-wrapped LLM output. The LLM responds with full JSON, but the user sees only the natural language response. Logic:
1. If content starts with `{`, try to parse JSON and extract `response_to_user`
2. If content contains a JSON block (between first `{` and last `}`), try to parse and extract
3. Fallback: return raw content

### 7.6 Confirmation Workflow (Frontend)

When `ExecutionPlanCard` is rendered:
1. User sees list of proposed actions with descriptions
2. "Approve" button calls `confirmExecutionRequest(threadId, executionRequestId, true, selectedActionIds)`
3. "Reject" button calls `confirmExecutionRequest(threadId, executionRequestId, false)`
4. Response updates the thread with execution results

Selective approval: User can check/uncheck individual actions before approving.

### 7.7 Real-Time Subscriptions

```typescript
supabase.channel(`assistant-messages-${threadId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'assistant_messages',
    filter: `thread_id=eq.${threadId}`,
  }, callback)
  .subscribe();
```

Used to receive messages from other sources (e.g., if a background process posts a message to the thread).

---

## 8. Frontend -- AI Reporting Components

### 8.1 Pages

#### Reporting Dashboard (`Reporting.tsx`)
- Quick-generate bar at top (text input + scope selector + timeframe selector + generate button)
- Stats grid: total reports, running, scheduled, last generated date
- Filterable table of all reports (by category, scope, status, search)
- Each row links to the report detail view

#### Report Chat Interface (`AIReporting.tsx`)
- Chat-style interface for conversational report generation
- Sidebar with report history
- Messages alternate between user prompts and generated reports
- Suggested prompts displayed for new users

#### Report Detail View (`ReportView.tsx`)
- KPI grid at top (4-6 cards)
- Executive summary narrative
- Charts (bar, line, area, pie via Recharts)
- Data tables
- Insights list
- Recommendations list
- Actions: follow-up question input, schedule button, duplicate, export (HTML/CSV), delete
- Version history (linked via parent_report_id)

### 8.2 Report Generation Flow (Frontend)

1. User enters prompt, selects scope and timeframe
2. Frontend calls `generateReport(orgId, userId, request)`
3. Service calls `callEdgeFunction('ai-report-generate', payload)`
4. If successful, returns report_id immediately
5. Frontend starts polling: `pollReportStatus(reportId, onUpdate, maxAttempts=60, intervalMs=3000)`
6. Poll fetches report every 3 seconds, calls `onUpdate` callback
7. When status becomes 'complete' or 'failed', polling stops
8. Complete report is rendered with charts, tables, KPIs

### 8.3 Chart Rendering

The `AIReportChart` component wraps Recharts:

| Chart Type | Recharts Component | Configuration |
|-----------|-------------------|---------------|
| bar | `<BarChart>` with `<Bar>` | Auto-detects series from data keys, 10-color palette |
| line | `<LineChart>` with `<Line>` | Monotone curves, dot markers |
| area | `<AreaChart>` with `<Area>` | Filled areas with opacity |
| pie | `<PieChart>` with `<Pie>` | Auto-detects value key, label with percentage |

X-axis key is auto-detected: first string-type key in data[0], or first key overall.
Series are auto-detected: all numeric keys except the x-axis key.

Color palette (10 colors): `#22d3ee`, `#10b981`, `#f59e0b`, `#ef4444`, `#8b5cf6`, `#ec4899`, `#06b6d4`, `#84cc16`, `#f97316`, `#6366f1`

### 8.4 KPI Cards

The `ReportKPICard` component:
- Displays label, formatted value, and trend indicator
- Value formatting: currency (Intl.NumberFormat USD), percentage (x100 + "%"), number (K/M abbreviations)
- Trend: up (green, TrendingUp icon), down (red, TrendingDown icon), flat (gray, Minus icon)
- Delta percentage badge with +/- prefix

Grid layout adapts: 2 cols for <=2 KPIs, 3 cols for 3 KPIs, 2-4 cols for 4+ KPIs

### 8.5 Scheduling

The `ScheduleReportModal`:
- Preset cadences: 7, 14, 30, 60, 90 days (from `CADENCE_OPTIONS`)
- Custom interval: 1-365 days
- Shows calculated next run date
- Creates an `ai_report_schedules` row

### 8.6 Report Scoping

| Scope | Access Level | Data Filter |
|-------|-------------|-------------|
| `my` | Any authenticated user | `owner_id = user_id` or `assigned_user_id = user_id` |
| `team` | Manager+ role | `department_id = user.department_id` |
| `org` | Admin+ role | `organization_id = user.org_id` (no user filter) |

---

## 9. LLM Configuration

### 9.1 Models

| Use Case | Model | Temperature | Max Tokens |
|----------|-------|-------------|------------|
| Assistant chat | `claude-sonnet-4-20250514` | 0.2 | 4096 |
| Query result summarization | `claude-sonnet-4-20250514` | 0.2 | 4096 |
| Report plan generation | `claude-opus-4-20250514` | 0.15 | 8192 |
| Report compose | `claude-opus-4-20250514` | 0.15 | 8192 |

### 9.2 API Configuration

**Endpoint**: `https://api.anthropic.com/v1/messages`
**API version header**: `anthropic-version: 2023-06-01`

**Headers**:
```
Content-Type: application/json
x-api-key: {ANTHROPIC_API_KEY}
anthropic-version: 2023-06-01
```

### 9.3 Provider Resolution

The system resolves the LLM API key in order:
1. Check `llm_providers` table for org-level Anthropic provider with `enabled = true`
2. If found, use `api_key_encrypted` from that row
3. If not found, fall back to `ANTHROPIC_API_KEY` environment variable

### 9.4 Embedding Configuration

**Model**: OpenAI `text-embedding-3-small`
**Dimensions**: 1536
**Endpoint**: `https://api.openai.com/v1/embeddings`
**API key**: `OPENAI_API_KEY` environment variable
**Input truncation**: 8000 characters max

---

## 10. Security & Permissions

### 10.1 Action Permission Map

| Action Type | Required Permission |
|-------------|-------------------|
| `create_contact` | `contacts.create` |
| `update_contact` | `contacts.edit` |
| `create_opportunity` | `opportunities.create` |
| `move_opportunity` | `opportunities.move_stage` |
| `create_project` | `projects.create` |
| `create_task` | `projects.tasks.manage` |
| `draft_email` | `personal_assistant.run` |
| `send_email` | `personal_assistant.run` |
| `send_sms` | `personal_assistant.run` |
| `create_event` | `meetings.edit` |
| `update_event` | `meetings.edit` |
| `cancel_event` | `meetings.edit` |
| `create_proposal_draft` | `proposals.create` |
| `query_analytics` | `reporting.view` |
| `query_schedule` | `personal_assistant.run` |
| `query_contacts` | `personal_assistant.run` |
| `query_opportunities` | `personal_assistant.run` |
| `query_tasks` | `personal_assistant.run` |
| `query_projects` | `personal_assistant.run` |
| `query_proposals` | `personal_assistant.run` |
| `remember` | `personal_assistant.run` |

Super Admin users bypass all permission checks.

### 10.2 Confirmation Rules

**Always require confirmation** (regardless of user settings):
- `send_email`
- `cancel_event`

**Financial actions** (always require confirmation):
- `create_invoice_draft`
- `create_proposal_draft`

**Destructive writes** (confirmation required only when `confirm_all_writes` is enabled on user profile):
- `update_contact`
- `move_opportunity`
- `update_event`
- `send_sms`

**Special case**: First-time SMS to any contact always requires confirmation (checked via `assistant_action_logs` for previous successful `send_sms`).

### 10.3 Integration State Checks

Before executing actions that depend on external services:

| Action Group | Check | Error Message |
|-------------|-------|--------------|
| `send_email`, `draft_email` | Gmail OAuth connected with `gmail.send` or `gmail.modify` scope | "Gmail is not connected. Please connect Gmail in Settings > Integrations." |
| `create_event`, `update_event`, `cancel_event` | Google Calendar connection exists with `sync_enabled` | "Google Calendar is not connected. Please connect in Settings > Calendars." |
| `send_sms` | Active phone number in `phone_numbers` table | "No active phone number configured. Please set up phone in Settings." |

### 10.4 Report Access Control

- `my` scope: Any authenticated user
- `team` scope: Requires Manager, Admin, or Super Admin role
- `org` scope: Requires Admin or Super Admin role
- SQL queries always include `organization_id = '{{ORG_ID}}'`
- `my` scope adds `owner_id` / `assigned_user_id` / `assigned_to` filter
- `team` scope adds `department_id` filter
- SQL sanitization prevents non-SELECT queries

### 10.5 RLS Policies

All assistant and reporting tables have RLS enabled. Key patterns:
- Users can only read/write their own threads, messages, profiles, and memories
- Organization-scoped access requires `organization_id` match
- `assistant_execution_requests` restricted to the owning `user_id`
- `ai_reports` accessible by creator or organization members (via `user_can_access_report` function)
- `ai_report_schedules` restricted to owning user

---

## 11. Adaptation Notes

### 11.1 Replacing External Integrations

The current system uses Google APIs for email and calendar. To adapt:

- **Email**: Replace `resolveGmailAccessToken` and Gmail API calls in `send_email` with your email provider's API
- **Calendar**: Replace `resolveCalendarAccessToken` and Google Calendar API calls with your calendar provider's API
- **SMS**: The `send_sms` action is currently a stub. Implement with Twilio, MessageBird, or your SMS provider

### 11.2 Adapting the ITS System Prompt

To add new action types:
1. Add the action type to `ALLOWED_ACTION_TYPES` in the validator
2. Add its module mapping to `MODULE_MAP`
3. Add payload schema to `PAYLOAD_SCHEMAS`
4. Add the action description and payload spec to the ITS system prompt
5. Add permission mapping to `ACTION_PERMISSION_MAP`
6. Implement execution logic in the `executeITSAction` switch statement
7. Add description to `describeAction`

### 11.3 Database Considerations

- The `clara_memories` table requires the `pgvector` extension. Install with `CREATE EXTENSION IF NOT EXISTS vector;`
- The `search_clara_memories` RPC uses `<=>` cosine distance operator
- The IVFFlat index requires at least ~100 rows to be effective. Consider switching to HNSW for better performance at larger scales
- The `exec_report_query` function must be SECURITY DEFINER to aggregate across RLS-protected tables
- Memory decay cron requires `pg_cron` extension

### 11.4 Frontend State Management

The assistant uses React Context (`AssistantContext`) for state management. Key patterns to replicate:
- Panel open/close state with keyboard shortcut
- Thread list with lazy message loading
- Streaming token accumulation
- Message type-based rendering dispatch
- Page context injection from routing

### 11.5 Environment Variables Required

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for edge functions |
| `SUPABASE_ANON_KEY` | Anon key for frontend client |
| `ANTHROPIC_API_KEY` | Anthropic API key (fallback if not in llm_providers) |
| `OPENAI_API_KEY` | OpenAI API key for embeddings |

### 11.6 Cron Jobs Required

| Job | Schedule | Function |
|-----|----------|----------|
| Memory decay | Daily at 4:00 AM UTC | `decrement_clara_memory_score()` |
| Report cleanup | Daily | `cleanup_expired_ai_reports()` |
| Scheduled reports | Every 15 minutes (recommended) | `ai-report-schedule-runner` edge function |

### 11.7 Key Design Decisions

1. **ITS over function calling**: The system uses a structured JSON schema (ITS) instead of native LLM function calling. This provides more control over validation, confirmation flows, and dependency chaining.

2. **Two-pass reports**: Report generation uses two LLM calls (plan + compose) rather than one. This allows SQL execution between passes, providing real data to the compose stage.

3. **Dual memory system**: Short-term KV memory for explicit "remember X" commands; long-term vector memory for automatic preference/context learning. The dual approach balances explicit user control with implicit personalization.

4. **Confirmation as first-class concept**: Rather than always executing actions, the system has a rich confirmation flow with selective approval, making it safe for high-stakes operations like sending emails or creating financial documents.

5. **Streaming with deferred execution**: During SSE streaming, the LLM output is accumulated. Only after the full response is collected does the system parse ITS, validate, and potentially execute actions. This means the user sees typing indicators while actions are processed post-stream.
