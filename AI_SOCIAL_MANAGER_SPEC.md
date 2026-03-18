# AI Social Manager Module — Developer Specification

> Complete specification for rebuilding the AI Social Manager module in a new CRM.
> This document covers architecture, database schema, TypeScript types, services, UI pages,
> components, edge functions, and permissions.

---

## Table of Contents

1. [Module Overview](#1-module-overview)
2. [Tech Stack & Dependencies](#2-tech-stack--dependencies)
3. [Architecture & Routing](#3-architecture--routing)
4. [Database Schema](#4-database-schema)
5. [Row Level Security](#5-row-level-security)
6. [TypeScript Types](#6-typescript-types)
7. [Services Layer](#7-services-layer)
8. [Pages & UI Screens](#8-pages--ui-screens)
9. [Component Library](#9-component-library)
10. [Edge Functions (Backend)](#10-edge-functions-backend)
11. [Permissions & Feature Flags](#11-permissions--feature-flags)
12. [Provider Reference](#12-provider-reference)
13. [Platform Content Rules](#13-platform-content-rules)

---

## 1. Module Overview

The **AI Social Manager** is a full-featured social media management module with an AI-powered content generation layer. Users interact with a conversational AI that writes posts, generates media (images/video), and manages publishing — all from a single interface.

### Six Primary Sections

| Tab | Route | Description |
|---|---|---|
| **Chat** | `/marketing/social/chat` | Conversational AI that generates post drafts, accepts URLs/YouTube links/file uploads, and tracks background media generation jobs |
| **Posts** | `/marketing/social/posts` | List of all posts with status filtering, search, calendar view, and per-post actions |
| **Campaigns** | `/marketing/social/campaigns` | Recurring campaign management with autopilot mode and AI batch post generation |
| **Guidelines** | `/marketing/social/guidelines` | Organization-wide AI content rules: tone, hashtags, writing style, emoji rules, platform tweaks |
| **Accounts** | `/marketing/social/accounts` | OAuth-based social account connection management (connect, reconnect, disconnect) |
| **Analytics** | `/marketing/social/analytics` | Post performance metrics with aggregate stats, charts, and a per-post breakdown table |

### Supported Social Platforms

`facebook` | `instagram` | `linkedin` | `google_business` | `tiktok` | `youtube` | `reddit`

---

## 2. Tech Stack & Dependencies

- **Frontend:** React 18 + TypeScript, Vite, TailwindCSS
- **Icons:** `lucide-react`
- **Routing:** `react-router-dom` v7
- **Database & Auth:** Supabase (`@supabase/supabase-js`)
- **Backend Functions:** Supabase Edge Functions (Deno)
- **Social Publishing Integration:** Late API (third-party, `late.dev`)
- **Media Generation:** Kie API (third-party image/video generation)

---

## 3. Architecture & Routing

### Layout Wrapper: `AISocialManagerLayout`

All social routes are wrapped in a persistent layout component. It renders:

- A dark header strip (`bg-slate-800`, `border-b border-slate-700`) with:
  - `BrainCircuit` icon from lucide-react in a cyan-tinted container (`bg-cyan-500/10`)
  - Title: **"AI Social Manager"** (`text-white`, `text-2xl font-bold`)
  - Subtitle: *"Your dedicated AI social media strategist"* (`text-slate-400`, `text-sm`)
  - **"New Post"** button (cyan, `bg-cyan-600 hover:bg-cyan-700`) — only shown when user has `marketing.social.manage`
- A horizontal **tab navigation bar** directly below the header (no separate sidebar)
  - Active tab: `text-cyan-400 border-b-2 border-cyan-500`
  - Inactive tab: `text-slate-400 border-b-2 border-transparent hover:text-slate-300 hover:border-slate-600`
  - Tabs scroll horizontally on small screens (`overflow-x-auto`)
- A `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8` content container with `<Outlet />`

The entire module background is **dark**: `min-h-screen bg-slate-900`.

### Tabs Definition

```typescript
const tabs = [
  { path: '/marketing/social/chat',       label: 'Chat',       icon: MessageSquare },
  { path: '/marketing/social/posts',      label: 'Posts',      icon: FileText },
  { path: '/marketing/social/campaigns',  label: 'Campaigns',  icon: Repeat },
  { path: '/marketing/social/guidelines', label: 'Guidelines', icon: BookOpen },
  { path: '/marketing/social/accounts',   label: 'Accounts',   icon: Link },
  { path: '/marketing/social/analytics',  label: 'Analytics',  icon: BarChart3 },
];
```

**Active tab logic:**
- Exact path match, OR
- `/marketing/social` root → Chat tab is active
- `startsWith(tab.path)` for sub-routes (e.g., `/campaigns/:id` → Campaigns active)

### Route Tree

```
/marketing/social                          → AISocialManagerLayout (requires: marketing.social.view + feature: marketing)
  / (index)                                → <SocialChat />
  /chat                                    → <SocialChat />
  /posts                                   → <SocialPosts />
  /posts/calendar                          → <SocialCalendar />
  /campaigns                               → <SocialCampaigns />
  /campaigns/:id                           → <SocialCampaignDetail />
  /guidelines                              → <SocialGuidelines />
  /accounts                                → <SocialAccounts />
  /analytics                               → <SocialAnalytics />

/marketing/social/posts/new                → <PostComposer /> (requires: marketing.social.manage, outside layout)
/marketing/social/posts/:id/edit           → <PostComposer /> (requires: marketing.social.manage, outside layout)
/marketing/social/approve/:token           → <PostApprovalPage /> (PUBLIC — no auth required)
```

---

## 4. Database Schema

### `social_accounts`

Stores OAuth-connected social media accounts per organization.

```sql
CREATE TABLE social_accounts (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider                text NOT NULL CHECK (provider IN ('facebook','instagram','linkedin','google_business','tiktok','youtube','reddit')),
  external_account_id     text NOT NULL,
  display_name            text NOT NULL,
  profile_image_url       text,
  access_token_encrypted  text,
  refresh_token_encrypted text,
  token_expiry            timestamptz,
  token_meta              jsonb DEFAULT '{}',
  account_type            text DEFAULT 'page',
  status                  text NOT NULL DEFAULT 'connected' CHECK (status IN ('connected','disconnected','error')),
  last_error              text,
  connected_by            uuid REFERENCES users(id) ON DELETE SET NULL,
  unipile_account_id      text,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);
```

### `social_account_groups`

Named groupings of accounts for bulk-posting.

```sql
CREATE TABLE social_account_groups (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  account_ids     uuid[] NOT NULL DEFAULT '{}',
  created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
```

### `social_posts`

The central posts table. Every draft, scheduled, and published post lives here.

```sql
CREATE TABLE social_posts (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by              uuid REFERENCES users(id) ON DELETE SET NULL,

  -- Content
  body                    text NOT NULL DEFAULT '',
  media                   jsonb NOT NULL DEFAULT '[]',   -- [{url, type, thumbnail_url}]
  targets                 jsonb NOT NULL DEFAULT '[]',   -- array of social_account UUIDs
  first_comment           text,
  link_preview            jsonb,                         -- {url}
  platform_options        jsonb DEFAULT '{}',            -- per-platform advanced settings
  customized_per_channel  boolean DEFAULT false,

  -- Status
  status                  text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','pending_approval','scheduled','queued','posting','posted','failed','cancelled','denied')),
  scheduled_at_utc        timestamptz,
  scheduled_timezone      text DEFAULT 'UTC',

  -- Approval workflow
  requires_approval       boolean DEFAULT false,
  approved_by             uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at             timestamptz,
  approval_token          text,
  approval_notes          text,
  approval_requested_at   timestamptz,
  approval_email_sent_at  timestamptz,

  -- Publishing results
  posted_at               timestamptz,
  published_at            timestamptz,
  provider_post_ids       jsonb DEFAULT '{}',   -- {provider: platformPostId}
  attempt_count           integer DEFAULT 0,
  last_error              text,

  -- AI metadata
  ai_generated            boolean DEFAULT false,
  ai_generation_id        uuid,
  hook_text               text,
  cta_text                text,
  hashtags                text[],
  visual_style_suggestion text,
  engagement_prediction   numeric,
  ab_variant_group        uuid,
  media_asset_ids         uuid[] DEFAULT '{}',

  -- Linking
  campaign_id             uuid REFERENCES social_campaigns(id) ON DELETE SET NULL,
  thread_id               uuid REFERENCES social_ai_threads(id) ON DELETE SET NULL,

  -- Late API fields
  late_post_id            text,
  late_status             text,
  late_response           jsonb,

  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);
```

### `social_post_content`

Per-platform text overrides when `customized_per_channel = true`.

```sql
CREATE TABLE social_post_content (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  platform    text NOT NULL,
  account_id  uuid REFERENCES social_accounts(id) ON DELETE SET NULL,
  text        text NOT NULL DEFAULT '',
  follow_up_comment text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (post_id, platform)
);
```

### `social_post_media`

Per-platform media overrides.

```sql
CREATE TABLE social_post_media (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  platform    text NOT NULL,
  account_id  uuid REFERENCES social_accounts(id) ON DELETE SET NULL,
  media_items jsonb NOT NULL DEFAULT '[]',
  created_at  timestamptz DEFAULT now(),
  UNIQUE (post_id, platform)
);
```

### `social_post_logs`

Audit trail for every post state change.

```sql
CREATE TABLE social_post_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  account_id uuid REFERENCES social_accounts(id) ON DELETE SET NULL,
  action     text NOT NULL
    CHECK (action IN ('created','scheduled','approved','denied','approval_requested','posted','failed','cancelled','publish_attempted')),
  details    jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
```

### `social_post_metrics`

Analytics synced from the publishing API.

```sql
CREATE TABLE social_post_metrics (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id             uuid NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  platform            text NOT NULL,
  impressions         integer DEFAULT 0,
  reach               integer DEFAULT 0,
  likes               integer DEFAULT 0,
  comments            integer DEFAULT 0,
  shares              integer DEFAULT 0,
  saves               integer DEFAULT 0,
  clicks              integer DEFAULT 0,
  video_views         integer DEFAULT 0,
  watch_time_seconds  integer DEFAULT 0,
  engagement_score    numeric DEFAULT 0,
  reach_score         numeric DEFAULT 0,
  fetched_at          timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
```

### `social_post_comment_posts`

One row per live post that has received comments (bridging Late API post IDs to our system).

```sql
CREATE TABLE social_post_comment_posts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  late_post_id        text NOT NULL,
  late_account_id     text NOT NULL,
  platform            text NOT NULL,
  post_body_preview   text,
  platform_post_url   text,
  comment_count       integer NOT NULL DEFAULT 0,
  last_comment_at     timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, late_post_id, late_account_id)
);
```

### `social_post_comments`

Individual comments synced from social platforms.

```sql
CREATE TABLE social_post_comments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  comment_post_id     uuid REFERENCES social_post_comment_posts(id) ON DELETE CASCADE,
  late_comment_id     text NOT NULL,
  late_post_id        text NOT NULL,
  late_account_id     text NOT NULL,
  platform            text NOT NULL,
  author_id           text,
  author_name         text,
  author_handle       text,
  author_avatar_url   text,
  text                text,
  like_count          integer NOT NULL DEFAULT 0,
  reply_count         integer NOT NULL DEFAULT 0,
  is_reply            boolean NOT NULL DEFAULT false,
  parent_comment_id   text,
  hidden              boolean NOT NULL DEFAULT false,
  has_private_reply   boolean NOT NULL DEFAULT false,
  actioned_at         timestamptz,
  actioned_by         uuid REFERENCES users(id) ON DELETE SET NULL,
  synced_at           timestamptz NOT NULL DEFAULT now(),
  comment_created_at  timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, late_comment_id)
);
```

### `social_ai_threads`

Chat conversation containers (one per session/topic).

```sql
CREATE TABLE social_ai_threads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           text NOT NULL DEFAULT '',
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
```

### `social_ai_messages`

Individual messages within a thread.

```sql
CREATE TABLE social_ai_messages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id      uuid NOT NULL REFERENCES social_ai_threads(id) ON DELETE CASCADE,
  role           text NOT NULL DEFAULT 'user' CHECK (role IN ('user','assistant','system')),
  content        text NOT NULL DEFAULT '',
  message_type   text NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text','url_scrape','youtube_transcript','file_upload','post_draft','campaign_request','image_suggestion')),
  attachments    jsonb NOT NULL DEFAULT '[]',
  generated_posts jsonb,
  metadata       jsonb NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now()
);
```

**`generated_posts` structure** (set when `message_type = 'post_draft'`):
```json
[
  {
    "platform": "instagram",
    "hook": "Opening hook line",
    "body": "Main caption body text",
    "cta": "Call to action text",
    "hashtags": ["#tag1", "#tag2"],
    "visual_style_suggestion": "Bright, high-contrast lifestyle photo",
    "engagement_prediction": 7.4,
    "character_count": 892
  }
]
```

**`metadata` structure** for assistant messages:
```json
{
  "model_used": "gpt-5.2",
  "media_jobs": [
    {
      "job_id": "uuid",
      "model_id": "nano-banana-2",
      "model_name": "Nano Banana 2",
      "media_type": "image",
      "prompt": "The generation prompt used",
      "status": "pending",
      "draft_index": 0
    }
  ],
  "media_skipped_reason": "No applicable media model",
  "auto_draft_ids": ["post-uuid-1", "post-uuid-2"]
}
```

> **Important:** `auto_draft_ids` is an array of `social_posts.id` records auto-created as drafts when the AI generates posts. This links the chat message to the draft posts so they can be updated when the user publishes.

### `social_campaigns`

Recurring content campaigns.

```sql
CREATE TABLE social_campaigns (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                text NOT NULL DEFAULT '',
  description         text NOT NULL DEFAULT '',
  theme               text NOT NULL DEFAULT '',
  frequency           text NOT NULL DEFAULT 'weekly'
    CHECK (frequency IN ('daily','weekly','biweekly','monthly')),
  platforms           jsonb NOT NULL DEFAULT '[]',
  content_type        text NOT NULL DEFAULT '',
  hook_style_preset   text NOT NULL DEFAULT 'question'
    CHECK (hook_style_preset IN ('question','statistic','story','bold_claim','educational')),
  approval_required   boolean NOT NULL DEFAULT false,
  autopilot_mode      boolean NOT NULL DEFAULT false,
  status              text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','paused','completed')),
  next_generation_at  timestamptz,
  last_generated_at   timestamptz,
  post_count          integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
```

### `social_guidelines`

Organization-wide AI content guidelines. One row per organization (`user_id = NULL`).

```sql
CREATE TABLE social_guidelines (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id              uuid REFERENCES users(id) ON DELETE CASCADE,
  content_themes       jsonb NOT NULL DEFAULT '[]',
  image_style          jsonb NOT NULL DEFAULT '[]',
  writing_style        jsonb NOT NULL DEFAULT '[]',
  tone_preferences     jsonb NOT NULL DEFAULT '{"formality":50,"friendliness":50,"energy":50,"confidence":50}',
  words_to_avoid       text[] NOT NULL DEFAULT '{}',
  hashtag_preferences  jsonb NOT NULL DEFAULT '{"preferred":[],"banned":[]}',
  cta_rules            text[] NOT NULL DEFAULT '{}',
  emoji_rules          jsonb NOT NULL DEFAULT '{"frequency":"minimal","banned":[]}',
  industry_positioning text NOT NULL DEFAULT '',
  visual_style_rules   jsonb NOT NULL DEFAULT '[]',
  platform_tweaks      jsonb NOT NULL DEFAULT '{}',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
```

### `social_post_ai_metadata`

Audit log for every AI action taken on a post.

```sql
CREATE TABLE social_post_ai_metadata (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id            uuid REFERENCES social_posts(id) ON DELETE SET NULL,
  organization_id    uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id            uuid REFERENCES users(id) ON DELETE SET NULL,
  platform           text,
  action_type        text NOT NULL,
  model_used         text,
  brand_kit_id       uuid,
  brand_voice_id     uuid,
  brand_kit_version  integer,
  brand_voice_version integer,
  input_content      text,
  input_length       integer,
  output_content     text,
  output_length      integer,
  tokens_used        integer DEFAULT 0,
  generation_params  jsonb DEFAULT '{}',
  applied            boolean DEFAULT false,
  applied_at         timestamptz,
  created_at         timestamptz DEFAULT now()
);
```

### `social_content_patterns`

Performance patterns extracted from published posts for AI learning.

```sql
CREATE TABLE social_content_patterns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  post_id         uuid REFERENCES social_posts(id) ON DELETE SET NULL,
  hook_type       text NOT NULL DEFAULT '',
  content_topic   text NOT NULL DEFAULT '',
  hashtags_used   text[] NOT NULL DEFAULT '{}',
  visual_style    text NOT NULL DEFAULT '',
  posting_hour    integer NOT NULL DEFAULT 0,
  posting_day     integer NOT NULL DEFAULT 0,
  engagement_rate numeric NOT NULL DEFAULT 0,
  reach           integer NOT NULL DEFAULT 0,
  clicks          integer NOT NULL DEFAULT 0,
  platform        text NOT NULL DEFAULT '',
  analyzed_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
```

### `social_ai_learning_signals`

Granular ML feature signals from published posts.

```sql
CREATE TABLE social_ai_learning_signals (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  post_id                 uuid NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  platform                text NOT NULL,
  hook_text               text,
  caption_length          integer DEFAULT 0,
  word_count              integer DEFAULT 0,
  emoji_count             integer DEFAULT 0,
  hashtag_count           integer DEFAULT 0,
  mention_count           integer DEFAULT 0,
  has_cta                 boolean DEFAULT false,
  has_question            boolean DEFAULT false,
  has_link                boolean DEFAULT false,
  media_type              text DEFAULT 'text',  -- 'text' | 'image' | 'video'
  media_count             integer DEFAULT 0,
  video_duration_seconds  integer,
  has_music               boolean DEFAULT false,
  posting_hour            integer,
  posting_day_of_week     integer,
  posting_month           integer,
  engagement_score        numeric DEFAULT 0,
  reach_score             numeric DEFAULT 0,
  engagement_percentile   numeric,
  is_high_performer       boolean DEFAULT false,
  is_low_performer        boolean DEFAULT false,
  analyzed_at             timestamptz NOT NULL DEFAULT now(),
  created_at              timestamptz NOT NULL DEFAULT now()
);
```

### `social_oauth_states`

Temporary state tokens for OAuth flows (15-minute TTL).

```sql
CREATE TABLE social_oauth_states (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider        text NOT NULL,
  state_token     text NOT NULL UNIQUE,
  redirect_uri    text NOT NULL,
  meta            jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now(),
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '15 minutes')
);
```

### `social_contacts`

Maps platform users to CRM contacts.

```sql
CREATE TABLE social_contacts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id         uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  platform           text NOT NULL,
  external_sender_id text NOT NULL,
  display_name       text NOT NULL DEFAULT '',
  profile_url        text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, platform, external_sender_id)
);
```

---

## 5. Row Level Security

Enable RLS on every table and apply these policies. Replace `has_org_permission` with your own helper function that checks if `auth.uid()` has a specific permission key within their organization.

```sql
-- Example pattern for most tables:
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view social posts"
  ON social_posts FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users with manage permission can insert social posts"
  ON social_posts FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users with manage permission can update social posts"
  ON social_posts FOR UPDATE
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users with manage permission can delete social posts"
  ON social_posts FOR DELETE
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));
```

Apply the same pattern to all social tables. For `social_ai_threads` and `social_ai_messages`, additionally restrict SELECT to threads owned by `auth.uid()` (or all org threads for super admins — handle this via application-level queries rather than RLS to avoid complexity).

---

## 6. TypeScript Types

```typescript
// types/socialManager.ts

export type SocialProvider =
  | 'facebook'
  | 'instagram'
  | 'linkedin'
  | 'google_business'
  | 'tiktok'
  | 'youtube'
  | 'reddit';

export type SocialPostStatus =
  | 'draft'
  | 'pending_approval'
  | 'scheduled'
  | 'queued'
  | 'posting'
  | 'posted'
  | 'failed'
  | 'cancelled'
  | 'denied';

export type SocialAIThreadStatus = 'active' | 'archived';
export type SocialAIMessageRole = 'user' | 'assistant' | 'system';
export type SocialAIMessageType =
  | 'text'
  | 'url_scrape'
  | 'youtube_transcript'
  | 'file_upload'
  | 'post_draft'
  | 'campaign_request'
  | 'image_suggestion';

export type SocialCampaignFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';
export type SocialCampaignStatus = 'active' | 'paused' | 'completed';
export type HookStylePreset = 'question' | 'statistic' | 'story' | 'bold_claim' | 'educational';
export type EmojiFrequency = 'none' | 'minimal' | 'moderate' | 'heavy';
export type PublishMode = 'draft' | 'schedule' | 'post_now';

// --- Shared ---
export interface PlatformDraft {
  platform: SocialProvider;
  hook: string;       // opening hook line
  body: string;       // main caption
  cta: string;        // call-to-action
  hashtags: string[];
  visual_style_suggestion: string;
  engagement_prediction: number;  // 0–10 AI score
  character_count: number;
}

// --- Threads ---
export interface SocialAIThread {
  id: string;
  organization_id: string;
  user_id: string;
  title: string;
  status: SocialAIThreadStatus;
  created_at: string;
  updated_at: string;
  last_message?: SocialAIMessage | null;
  owner_name?: string;  // populated for super admin view
}

// --- Messages ---
export interface SocialAIAttachment {
  type: 'url' | 'youtube' | 'file' | 'image';
  url?: string;
  filename?: string;
  title?: string;
  content?: string;
}

export interface MediaJobInfo {
  job_id: string;
  model_id: string;
  model_name: string;
  media_type: 'image' | 'video';
  prompt: string;
  status: string;       // 'pending' | 'generating' | 'ready' | 'failed'
  draft_index: number;
  message_id?: string;
  preloadedAssets?: MediaAsset[];
  error?: string;
}

export interface SocialAIMessage {
  id: string;
  thread_id: string;
  role: SocialAIMessageRole;
  content: string;
  message_type: SocialAIMessageType;
  attachments: SocialAIAttachment[];
  generated_posts: PlatformDraft[] | null;
  metadata: {
    model_used?: string;
    media_jobs?: MediaJobInfo[];
    media_skipped_reason?: string;
    auto_draft_ids?: string[];
  };
  created_at: string;
}

// --- Media ---
export interface MediaPreferences {
  video_model_id?: string;
  video_mode?: string;
  aspect_ratio?: string;
  auto_generate_media?: boolean;
  style_preset_id?: string;
}

export interface MediaAsset {
  id: string;
  public_url: string;
  media_type: 'image' | 'video';
  thumbnail_url?: string;
}

// --- Posts ---
export interface SocialPost {
  id: string;
  organization_id: string;
  created_by: string | null;
  body: string;
  media: Array<{ url: string; type: 'image' | 'video'; thumbnail_url?: string }>;
  targets: string[];  // social_account IDs
  status: SocialPostStatus;
  scheduled_at_utc: string | null;
  scheduled_timezone: string;
  requires_approval: boolean;
  approved_by: string | null;
  approved_at: string | null;
  posted_at: string | null;
  published_at: string | null;
  provider_post_ids: Record<string, string>;
  ai_generated: boolean;
  hook_text: string | null;
  cta_text: string | null;
  hashtags: string[] | null;
  visual_style_suggestion: string | null;
  engagement_prediction: number | null;
  campaign_id: string | null;
  thread_id: string | null;
  approval_token: string | null;
  late_post_id: string | null;
  created_at: string;
  updated_at: string;
}

// --- Accounts ---
export interface SocialAccount {
  id: string;
  organization_id: string;
  provider: SocialProvider;
  external_account_id: string;
  display_name: string;
  profile_image_url: string | null;
  token_expiry: string | null;
  status: 'connected' | 'disconnected' | 'error';
  last_error: string | null;
  connected_by: string | null;
  unipile_account_id: string | null;
  created_at: string;
  updated_at: string;
}

// --- Campaigns ---
export interface SocialCampaign {
  id: string;
  organization_id: string;
  created_by: string;
  name: string;
  description: string;
  theme: string;
  frequency: SocialCampaignFrequency;
  platforms: SocialProvider[];
  content_type: string;
  hook_style_preset: HookStylePreset;
  approval_required: boolean;
  autopilot_mode: boolean;
  status: SocialCampaignStatus;
  next_generation_at: string | null;
  last_generated_at: string | null;
  post_count: number;
  created_at: string;
  updated_at: string;
}

// --- Guidelines ---
export interface GuidelineBlock {
  content: string;
}

export interface TonePreferences {
  formality: number;    // 0–100
  friendliness: number; // 0–100
  energy: number;       // 0–100
  confidence: number;   // 0–100
}

export interface HashtagPreferences {
  preferred: string[];
  banned: string[];
}

export interface EmojiRules {
  frequency: EmojiFrequency;
  banned: string[];
}

export interface PlatformTweak {
  tone_override?: string;
  additional_rules?: string;
  hashtag_limit?: number;
}

export interface SocialGuideline {
  id: string;
  organization_id: string;
  user_id: string | null;
  content_themes: GuidelineBlock[];
  image_style: GuidelineBlock[];
  writing_style: GuidelineBlock[];
  tone_preferences: TonePreferences;
  words_to_avoid: string[];
  hashtag_preferences: HashtagPreferences;
  cta_rules: string[];
  emoji_rules: EmojiRules;
  industry_positioning: string;
  visual_style_rules: string[];
  platform_tweaks: Record<string, PlatformTweak>;
  created_at: string;
  updated_at: string;
}

// --- Metrics ---
export interface SocialPostMetrics {
  id: string;
  post_id: string;
  organization_id: string;
  platform: string;
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  video_views: number;
  watch_time_seconds: number;
  engagement_score: number;
  reach_score: number;
  fetched_at: string;
}
```

---

## 7. Services Layer

### `services/socialAccounts.ts`

```typescript
// Get all accounts for an organization
getSocialAccounts(organizationId: string): Promise<SocialAccount[]>
// → supabase.from('social_accounts').select('*, connected_by_user:users(name)').eq('organization_id', orgId)

// Get a single account
getSocialAccountById(id: string): Promise<SocialAccount | null>

// Get connected accounts for a specific provider
getSocialAccountsByProvider(orgId: string, provider: SocialProvider): Promise<SocialAccount[]>
// → .eq('status', 'connected')

// Disconnect: nullify tokens, set status = 'disconnected'
disconnectSocialAccount(id: string): Promise<void>
// → .update({ status: 'disconnected', access_token_encrypted: null, refresh_token_encrypted: null })

// Hard delete
deleteSocialAccount(id: string): Promise<void>

// Aggregate stats for dashboard
getSocialStats(organizationId: string): Promise<{
  connectedAccounts: number;
  scheduledPosts: number;
  postedThisWeek: number;
  failedPosts: number;
}>

// Generate OAuth connection URL via Late API
connectViaLate(
  provider: SocialProvider,
  successUrl?: string,
  failureUrl?: string
): Promise<{ url: string }>
// → calls edge function 'late-connect' with { provider, success_redirect_url, failure_redirect_url }

// Regenerate OAuth URL for existing account
reconnectViaLate(
  accountId: string,
  provider: SocialProvider
): Promise<{ url: string }>
// → calls 'late-connect' with { provider, reconnect_account_id: accountId }

// UI helpers
getProviderDisplayName(provider: SocialProvider): string
getProviderColor(provider: SocialProvider): string   // returns hex color
```

### `services/socialPosts.ts`

```typescript
interface SocialPostFilters {
  status?: SocialPostStatus[];
  startDate?: string;
  endDate?: string;
  search?: string;
  campaignId?: string;
}

// List posts
getSocialPosts(orgId: string, filters?: SocialPostFilters): Promise<SocialPost[]>

// Single post
getSocialPostById(id: string): Promise<SocialPost | null>
// → joins created_by_user:users(name), approved_by_user:users(name)

// Calendar posts (scheduled + posted)
getCalendarPosts(orgId: string, startDate: string, endDate: string): Promise<SocialPost[]>
// → status IN ('scheduled','queued','posting','posted','failed') AND scheduled_at_utc BETWEEN

// CRUD
createSocialPost(orgId: string, userId: string, data: Partial<SocialPost>): Promise<SocialPost>
// After insert: createPostLog(postId, null, 'created', {})
// If approval_required: generate UUID approval_token

updateSocialPost(id: string, updates: Partial<SocialPost>): Promise<void>

schedulePost(id: string, scheduledAtUtc: string, timezone: string): Promise<void>
// → .update({ status: 'scheduled', scheduled_at_utc, scheduled_timezone })
// + createPostLog(id, null, 'scheduled', { scheduled_at: scheduledAtUtc })

approvePost(id: string, userId: string): Promise<void>
// → .update({ status: 'scheduled', approved_by: userId, approved_at: now() })
// + createPostLog(id, null, 'approved', { approved_by: userId })

cancelPost(id: string): Promise<void>

duplicatePost(id: string, userId: string): Promise<SocialPost>
// Creates a draft copy; does NOT copy: status, approval fields, published_at, etc.

deleteSocialPost(id: string): Promise<void>

// Post logs
getPostLogs(postId: string): Promise<SocialPostLog[]>
createPostLog(postId: string, accountId: string | null, action: string, details: object): Promise<void>

// Approval workflow
submitForApproval(postId: string, scheduledAtUtc?: string, timezone?: string): Promise<void>
// → generates UUID approval_token, sets status='pending_approval', records log

approvePostWithToken(token: string, userId: string): Promise<void>
// → finds post by approval_token, sets approved
denyPostWithToken(token: string, userId: string, notes: string): Promise<void>
// → sets status='denied', approval_notes

// Per-channel content
getChannelContent(postId: string): Promise<Record<SocialProvider, { text: string; follow_up_comment?: string }>>

// Publishing
publishPost(postId: string): Promise<void>
// → calls edge function 'social-worker' with { post_id: postId }

// Platform metadata
getCharacterLimits(): Record<SocialProvider, number>
getMediaRequirements(): Record<SocialProvider, { maxImages: number; maxVideoSeconds?: number; aspectRatios: string[] }>
```

### `services/socialCampaigns.ts`

```typescript
getCampaigns(orgId: string, status?: SocialCampaignStatus): Promise<SocialCampaign[]>
getCampaignById(id: string): Promise<SocialCampaign | null>

createCampaign(
  orgId: string,
  userId: string,
  input: Omit<SocialCampaign, 'id' | 'organization_id' | 'created_by' | 'post_count' | 'created_at' | 'updated_at'>
): Promise<SocialCampaign>

updateCampaign(id: string, updates: Partial<SocialCampaign>): Promise<void>
deleteCampaign(id: string): Promise<void>

toggleAutopilot(id: string, enabled: boolean): Promise<void>
// → .update({ autopilot_mode: enabled })

generatePosts(campaignId: string): Promise<{ generated: number }>
// → calls edge function 'ai-social-campaign-generator' with { campaign_id: campaignId }

getCampaignPosts(campaignId: string): Promise<SocialPost[]>
// → .eq('campaign_id', campaignId).order('created_at', { ascending: false })
```

### `services/socialMetrics.ts`

```typescript
interface AggregatedMetrics {
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  engagementRate: number;  // percentage
}

getMetricsForOrg(orgId: string): Promise<Array<SocialPost & { metrics: SocialPostMetrics[] }>>
// → last 50 posted posts, joined with metrics

getMetricsForPost(postId: string): Promise<SocialPostMetrics[]>

refreshPostMetrics(postId: string): Promise<SocialPostMetrics>
// → calls edge function 'late-metrics' with { post_id: postId }

refreshAllMetrics(): Promise<{ synced: number }>
// → calls edge function 'late-metrics' with { bulk: true }

aggregateMetrics(metrics: SocialPostMetrics[]): AggregatedMetrics
// Sum all fields; engagement_rate = (likes+comments+shares) / impressions * 100
```

### `services/socialComments.ts`

```typescript
interface CommentPostFilters {
  platform?: SocialProvider;
  lateAccountId?: string;
  startDate?: string;
  endDate?: string;
}

getCommentPosts(orgId: string, filters?: CommentPostFilters): Promise<SocialPostCommentPost[]>
// sorted by last_comment_at desc

getCommentsForPost(orgId: string, latePostId: string): Promise<SocialPostComment[]>
// → .eq('late_post_id', latePostId).order('comment_created_at', { ascending: true })

syncComments(orgId: string): Promise<{ synced: number }>
// → calls edge function 'late-inbox-comments-sync' with { org_id: orgId }

hideComment(orgId: string, lateCommentId: string, lateAccountId: string): Promise<void>
// → calls edge function 'late-inbox-comments-sync' with { action: 'hide', ... }
// + updates local record: hidden = true

replyToComment(
  orgId: string,
  lateCommentId: string,
  latePostId: string,
  lateAccountId: string,
  replyText: string
): Promise<void>
// → calls edge function 'late-inbox-comments-sync' with { action: 'reply', reply_text: replyText, ... }

markCommentActioned(orgId: string, commentId: string, userId: string): Promise<void>
// → .update({ actioned_at: now(), actioned_by: userId })

getLastCommentsSyncedAt(orgId: string): Promise<string | null>
// → MAX(synced_at) from social_post_comments WHERE organization_id = orgId
```

### `services/socialGuidelines.ts`

```typescript
// Get org-level guidelines (user_id IS NULL)
getGuidelines(orgId: string): Promise<SocialGuideline | null>
// → .eq('organization_id', orgId).is('user_id', null).maybeSingle()

// Create or update guidelines
upsertGuidelines(orgId: string, updates: Partial<SocialGuideline>): Promise<SocialGuideline>
// → supabase.from('social_guidelines').upsert({ organization_id: orgId, user_id: null, ...updates }, { onConflict: 'organization_id,user_id' })

// Additive merge from AI chat (only adds, never removes existing data)
mergeGuidelineFromChat(orgId: string, partialUpdate: Partial<SocialGuideline>): Promise<void>
// Fetch existing → merge arrays (append unique) → merge tone_preferences (overwrite only if provided) → upsert
```

### `services/socialChat.ts`

```typescript
// Threads
getThreads(orgId: string, userId: string): Promise<SocialAIThread[]>
// → status = 'active', ordered by updated_at desc, for specific user

getAllOrgThreads(orgId: string): Promise<(SocialAIThread & { owner_name?: string })[]>
// → all active threads, joins users.name as owner_name (for super admin)

getThreadById(threadId: string): Promise<SocialAIThread | null>

// Messages
getThreadMessages(threadId: string): Promise<SocialAIMessage[]>
// → ordered by created_at asc

// Create
createThread(orgId: string, userId: string, title?: string): Promise<SocialAIThread>
// → inserts with title = title || 'New conversation'

// Send a message — critical function, see full details below
sendMessage(
  threadId: string,
  content: string,
  messageType?: SocialAIMessageType,
  attachments?: SocialAIAttachment[],
  mediaPrefs?: MediaPreferences
): Promise<SendMessageResult>

// Lifecycle
archiveThread(threadId: string): Promise<void>
// → .update({ status: 'archived' })

deleteThread(threadId: string): Promise<void>
// → .delete()

// Publishing from chat
publishDraftFromChat(params: PublishDraftParams): Promise<string>
// Returns the social_post.id

updateDraftMedia(postId: string, media: MediaItem[], mediaAssetIds: string[]): Promise<void>
// → .update({ media, media_asset_ids }).eq('status', 'draft')
```

#### `sendMessage` — Detailed Flow

```
1. Insert user message into social_ai_messages (role='user')
2. POST to edge function 'ai-social-chat' with:
   - thread_id, content, message_type, attachments
   - auto_generate_media (default: true)
   - video_model_id, video_mode, aspect_ratio, style_preset_id (if provided)
   - DO NOT send text model — it is locked server-side
3. If edge function fails → delete the user message, throw error
4. Parse response: { response, drafts, media_jobs, media_skipped_reason, model_used }
5. Build full content string:
   - Start with response text
   - Append each draft as: "\n---DRAFT---\n{JSON}\n---END_DRAFT---"
6. Insert AI message into social_ai_messages (role='assistant')
7. If drafts exist → for each draft, insert a social_posts record with status='draft',
   collect IDs into auto_draft_ids[]
8. Update AI message metadata to include auto_draft_ids
9. Update thread.updated_at; if title = 'New conversation' → set title to first 60 chars of content
10. Return { userMessage, aiMessage, mediaJobs: enrichedMediaJobs, mediaSkippedReason }
```

#### `publishDraftFromChat` — Detailed Flow

```typescript
interface PublishDraftParams {
  orgId: string;
  userId: string;
  draft: {
    platform: string;
    hook: string;
    body: string;
    cta: string;
    hashtags: string[];
    visual_style_suggestion?: string;
    engagement_prediction?: number;
  };
  accountIds: string[];
  mode: PublishMode;
  scheduledAtUtc?: string;
  media?: MediaItem[];
  mediaAssetIds?: string[];
  threadId?: string;
  existingPostId?: string;  // if set, UPDATE instead of INSERT
}
```

Behavior:
- `mode = 'post_now'` → status = `'scheduled'`, scheduled_at_utc = now()
- `mode = 'schedule'` → status = `'scheduled'`, scheduled_at_utc = provided value
- `mode = 'draft'`    → status = `'draft'`
- Full body = `[hook, body, cta].filter(Boolean).join('\n\n')`
- If `existingPostId` provided → UPDATE that post, else INSERT new post
- Returns post ID

### `services/socialAI.ts`

```typescript
// Get active brand kit & brand voice for AI context
getActiveBrandboardForAI(orgId: string): Promise<{
  brandKit: { id: string; version: number; name: string; colors: string[]; ... } | null;
  brandVoice: { id: string; version: number; name: string; tone_settings: object; ... } | null;
}>

// Quick improvements on existing content
generateQuickSuggestion(options: {
  content: string;
  platform: SocialProvider;
  action: 'improve' | 'make_shorter' | 'make_longer' | 'add_hook' | 'add_cta' | 'fix_grammar' | 'add_hashtags';
  orgId: string;
  postId?: string;
}): Promise<{ suggestion: string; tokens_used: number }>
// → calls edge function 'ai-social-content' with { action_type: 'quick_suggestion', ...options }

// Generate new content from scratch
generateNewContent(options: {
  objective: 'awareness' | 'engagement' | 'conversion' | 'education' | 'entertainment';
  tone: 'professional' | 'casual' | 'humorous' | 'inspirational' | 'educational';
  length: 'short' | 'medium' | 'long';
  platforms: SocialProvider[];
  customPrompt?: string;
  orgId: string;
}): Promise<{ drafts: PlatformDraft[]; tokens_used: number }>
// → calls 'ai-social-content' with { action_type: 'generate_new', ...options }

// Repurpose existing content
repurposeContent(options: {
  sourceType: 'text' | 'url' | 'youtube' | 'file';
  sourceContent: string;    // text, URL, or YouTube URL
  action: 'adapt_platform' | 'expand' | 'summarize' | 'change_tone';
  targetPlatform: SocialProvider;
  orgId: string;
}): Promise<{ result: string; tokens_used: number }>
// → calls 'ai-social-content' with { action_type: 'repurpose', ...options }

// Hashtag generation
generateHashtags(options: {
  content: string;
  platform: SocialProvider;
  count: number;
  includeNiche?: boolean;
  includeTrending?: boolean;
  includeBrand?: boolean;
  orgId: string;
}): Promise<{ hashtags: string[] }>
// → calls 'ai-social-content' with { action_type: 'generate_hashtags', ...options }

// CTA generation
generateCTA(options: {
  content: string;
  objective: string;
  platform: SocialProvider;
  orgId: string;
}): Promise<{ ctas: string[] }>
// → calls 'ai-social-content' with { action_type: 'generate_cta', ...options }

// Web scraping for context
scrapeURL(url: string): Promise<{
  title: string;
  description: string;
  content: string;
  url: string;
}>
// → calls 'ai-social-content' with { action_type: 'scrape_url', url }

// YouTube transcript extraction
extractYouTubeContent(url: string): Promise<{
  title: string;
  description: string;
  transcript: string;
  channel: string;
  duration: number;
}>
// → calls 'ai-social-content' with { action_type: 'extract_youtube', url }

// Usage tracking
getAIUsageStats(
  orgId: string,
  startDate?: string,
  endDate?: string
): Promise<{ total_calls: number; total_tokens: number; by_action: Record<string, number> }>
```

### `services/socialAccountGroups.ts`

```typescript
getAccountGroups(orgId: string): Promise<SocialAccountGroup[]>
getAccountGroupById(id: string): Promise<SocialAccountGroup | null>

createAccountGroup(
  orgId: string,
  name: string,
  accountIds: string[],
  createdBy: string,
  description?: string
): Promise<SocialAccountGroup>

updateAccountGroup(id: string, updates: Partial<SocialAccountGroup>): Promise<void>
deleteAccountGroup(id: string): Promise<void>
```

---

## 8. Pages & UI Screens

### Chat Page — `SocialChat.tsx`

**Layout:** Two-column fixed-height panel (`height: calc(100vh - 260px)`, `min-height: 500px`), both columns with `bg-slate-900`, `border border-slate-700 rounded-xl`.

**Left column (280px fixed width):**
- `ThreadSidebar` component

**Right column (flex-1):**
- `ChatMessageList` component (flex-1, scrollable)
- `ChatMediaSettings` component (fixed bottom strip)
- `ChatInput` component (fixed bottom)

**State management:**
```typescript
const [threads, setThreads] = useState<SocialAIThread[]>([]);
const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
const [messages, setMessages] = useState<SocialAIMessage[]>([]);
const [sending, setSending] = useState(false);
const [accounts, setAccounts] = useState<SocialAccount[]>([]);
const [mediaPreferences, setMediaPreferences] = useState<MediaPreferences>({
  auto_generate_media: true,
  video_mode: 'std',
});
const [activeMediaJobs, setActiveMediaJobs] = useState<MediaJobInfo[]>([]);
const [draftAssets, setDraftAssets] = useState<Record<string, MediaAsset[]>>({});
const [publishStatuses, setPublishStatuses] = useState<Record<string, { mode: PublishMode; scheduledAt?: string }>>({});
```

**On thread change:** Load messages, rehydrate media jobs from message metadata, fetch completed assets from `getAssetsByJobIds()`, rebuild `draftAssets` map keyed as `${messageId}-${draftIndex}`.

**On send:**
1. If no active thread → create one first, set as active
2. Call `sendMessage()` → append both messages to state
3. If `mediaJobs` returned → append to `activeMediaJobs`
4. Update thread's `updated_at` and title (if still "New conversation")

**On publish draft:**
1. Find `auto_draft_ids` from message metadata
2. Call `publishDraftFromChat()` with existing post ID if found
3. If `mode = 'post_now'` → additionally call `social-worker` edge function
4. Update `publishStatuses` state to disable re-publishing

---

### Posts Page — `SocialPosts.tsx`

**Header:**
- Title: "Social Posts" (`text-white text-2xl font-semibold`)
- Right actions: "Calendar View" button (link icon + `CalendarDays`) + "New Post" button (cyan)

**Tabs:** `Posts` | `Comments`

**Posts Tab — filter bar:**
```
Status pills: All | Drafts | Scheduled | Published | Failed
Search input (right side)
```

**Post card list:**
Each card is a row showing:
- Left: colored status dot
- Post body preview (2-line clamp, `text-slate-300`)
- Account provider icons (up to 3, with `+N` overflow)
- AI badge (cyan "AI" chip if `ai_generated = true`)
- Scheduled/posted date-time in small text
- Right: three-dot (`MoreVertical`) menu → Edit, Duplicate, Delete, Publish Now (drafts only)

**Status colors:**
```typescript
const STATUS_COLORS = {
  draft:            'bg-slate-500 text-slate-300',
  pending_approval: 'bg-amber-500/20 text-amber-400',
  scheduled:        'bg-blue-500/20 text-blue-400',
  queued:           'bg-yellow-500/20 text-yellow-400',
  posting:          'bg-yellow-500/20 text-yellow-400',
  posted:           'bg-green-500/20 text-green-400',
  failed:           'bg-red-500/20 text-red-400',
  cancelled:        'bg-slate-500/20 text-slate-400',
  denied:           'bg-red-500/20 text-red-400',
};
```

**Comments Tab:**
- Renders `SocialCommentsTab` component
- Shows posts with comments, expandable comment threads per post
- Per-comment actions: Reply (opens inline reply input), Hide, Mark as Actioned
- "Sync Comments" button at top (calls `syncComments()`)

---

### Calendar Page — `SocialCalendar.tsx`

**Design:** White card (`bg-white rounded-xl border border-gray-200`) — note: this page uses light theme unlike the rest of the module.

**Header controls:**
- Back arrow → `/marketing/social/posts`
- Title: "Social Calendar"
- "List View" link + "New Post" button (rose/red: `bg-rose-600`)

**Month/Week toggle** (`bg-gray-100 rounded-lg` pill)

**Month grid:**
- 7 columns (Sun–Sat headers)
- Each cell: `min-h-[120px]`, highlight today with `bg-rose-600` circle on date number
- Off-month days: `bg-gray-50` dimmed
- Up to 3 post cards in month view; "+N more" button switches to week view
- `+` add button appears on hover for future dates

**Week grid:**
- Same 7 columns but `min-h-[400px]` per cell
- Shows up to 10 posts per cell

**Post card (calendar):**
- White card with border, hover: `border-rose-300 shadow-sm`
- Status color dot (left)
- Provider icons (top)
- 2-line body preview
- Time display if scheduled
- Drag handle (`GripVertical`) on hover
- `draggable` attribute — `onDragStart`, `onDragOver`, `onDrop` handlers

**Drag-and-drop rescheduling:**
- Drop target date cell highlights: `bg-rose-50`
- On drop → opens `RescheduleModal` with pre-filled date
- Save calls `schedulePost(postId, newDatetime, 'UTC')`

**PostPreviewModal:** Full modal showing post body, media grid, account badges, status, reschedule/edit buttons.

**RescheduleModal:** Date + time inputs, Save calls `schedulePost()`.

---

### Campaigns Page — `SocialCampaigns.tsx`

**Layout:** Header + grid of campaign cards.

**Filter pills:** All | Active | Paused | Completed

**Campaign Card:**
```
┌─────────────────────────────────────────┐
│  [Icon] Campaign Name          [Status] │
│  Description text (2-line clamp)        │
│  Theme: "Content theme"                 │
│  ─────────────────────────────────────  │
│  [Platform icons]   Frequency: Weekly   │
│  Hook: Question     Posts: 12           │
│  ─────────────────────────────────────  │
│  Autopilot: [toggle]                    │
│  [Generate Posts]       [Edit] [Delete] │
└─────────────────────────────────────────┘
```

**Create Campaign Modal fields:**
| Field | Type | Required |
|---|---|---|
| Name | text input | Yes |
| Description | textarea | No |
| Theme / Topic | text input | Yes |
| Frequency | select: Daily/Weekly/Biweekly/Monthly | Yes |
| Hook Style | select: Question/Statistic/Story/Bold Claim/Educational | Yes |
| Platforms | multi-checkbox with provider icons | Yes (at least 1) |
| Require Approval | toggle | No |
| Autopilot Mode | toggle | No |

---

### Campaign Detail Page — `SocialCampaignDetail.tsx`

**Stat cards row:**
- Status badge, Frequency, Total Posts count, Autopilot status

**Actions:**
- Edit campaign button
- "Generate Posts" button (`disabled` when loading, shows spinner)
- Autopilot toggle (inline)

**Posts list:** Same card style as Posts page, filtered to this campaign's `campaign_id`.

---

### Guidelines Page — `SocialGuidelines.tsx`

**Access control:** Read-only for users without `marketing.social.manage`.

**Auto-save:** Debounced 800ms — any field change triggers `upsertGuidelines()`. Shows "Saving..." / "Saved" badge near header.

**Sections (all as dark cards in the dark layout):**

1. **Content Themes** — `GuidelineBlockEditor` with `content_themes` array
2. **Image Style** — `GuidelineBlockEditor` with `image_style` array
3. **Writing Style** — `GuidelineBlockEditor` with `writing_style` array
4. **Tone Preferences** — Four range sliders (0–100) with labels:
   - Formality (Casual ←→ Formal)
   - Friendliness (Reserved ←→ Warm)
   - Energy (Calm ←→ High Energy)
   - Confidence (Humble ←→ Bold)
5. **Words to Avoid** — Tag chip input (add/remove strings)
6. **Hashtag Preferences:**
   - Preferred hashtags (tag input, shows as green chips)
   - Banned hashtags (tag input, shows as red chips)
7. **CTA Rules** — Tag input (add/remove rule strings)
8. **Emoji Rules:**
   - Frequency selector: None / Minimal / Moderate / Heavy (pill buttons)
   - Banned emojis tag input
9. **Industry Positioning** — Single `<textarea>`
10. **Visual Style Rules** — Tag input (add/remove)
11. **Platform Tweaks** — Accordion per provider:
    - Tone override text input
    - Additional rules textarea
    - Max hashtags number input

**Brandboard Sync button:** Imports `tone_settings` from the active brand voice and writes to `tone_preferences`.

---

### Accounts Page — `SocialAccounts.tsx`

**Layout:** Two sections:
1. "Connect New Account" — grid of provider buttons
2. "Connected Accounts" — list of connected accounts

**Provider connect button:**
```
[Provider Icon]  Facebook
                 "Connect your Facebook page..."
                                        [Connect →]
```

**Connected account row:**
```
[Avatar] Display Name            [Provider Icon]  [Status Badge]
         @handle or page name

                                 [Reconnect]  [Disconnect]
```

**Status badges:**
- `connected` → green `bg-green-500/20 text-green-400`
- `error` → red `bg-red-500/20 text-red-400`
- `token_expiry < 7 days` → amber `bg-amber-500/20 text-amber-400` "Token Expiring"

**Connection flow:**
1. Click "Connect [Provider]"
2. Call `connectViaLate(provider)` → get `{url}`
3. `window.location.href = url` (full redirect) OR open popup
4. After OAuth callback, the user returns to this page; call `loadAccounts()` to refresh

---

### Analytics Page — `SocialAnalytics.tsx`

**Time range pills:** 7 days | 30 days | 90 days

**"Sync Metrics" button** → `refreshAllMetrics()`, shows loading spinner + success toast.

**Metric summary cards (6 cards in a row):**
Each shows icon + label + total value + optional trend percentage.

Cards: Impressions | Reach | Likes | Comments | Shares | Saves | Clicks

**Charts (3 charts):**
1. **Hook Performance** — Bar chart: hook type (question/statistic/story/etc.) vs. avg engagement
2. **Platform Breakdown** — Grouped bar chart: metrics per platform
3. **Best Posting Hours** — Heatmap or bar chart: hour of day (0–23) vs. avg engagement

**Per-post breakdown table:**
| Post Preview | Platform | Posted At | Impressions | Reach | Likes | Comments | Engagement % |
|---|---|---|---|---|---|---|---|
| 2-line body clamp | icon | date | # | # | # | # | X.X% |

---

### Post Composer — `PostComposer.tsx` (standalone page, outside layout)

**Full-page layout** (no tab nav, has its own header with back button).

**Three-column layout:**

```
┌──────────────┬──────────────────────────┬─────────────────────┐
│   Accounts   │    Content Editor        │   Preview / AI      │
│   (240px)    │    (flex-1)              │   (320px)           │
└──────────────┴──────────────────────────┴─────────────────────┘
```

**Left — AccountSelector:**
- Connected accounts as checkboxes
- Account groups section (expandable)
- "Create Group" button → `CreateGroupModal`
- Shows account avatar + display_name + provider icon per row

**Center — ContentComposer:**
- Main textarea with character count per selected platform
- Media upload zone (drag-and-drop or click to browse)
- Media thumbnails grid with remove buttons
- "Customize per channel" toggle — when on, shows per-provider text tabs
- "First comment" text input (optional follow-up comment)
- Link URL input (for link cards)
- Scheduling section:
  - Date picker, Time picker, Timezone select
  - OR "Post Now" button
- "Requires Approval" toggle
- Platform Advanced Options (`PlatformAdvancedOptions`)

**Right — AI Panel + Preview:**
- Tab bar: `Preview` | `AI Assistant`
- **Preview tab:** `PostPreviewPanel` showing simulated platform layout
- **AI Assistant tab:** accordion sections:
  - Quick Suggestions (7 action buttons)
  - Generate New Content (form: objective/tone/length/prompt → generates drafts)
  - Repurpose (source type/content, action, target platform)
  - Hashtag Suggestions (count + toggle switches)
  - CTA Suggestions

**Character count UX:**
- Gray: under 80% of limit
- Amber: 80–99% of limit
- Red + bold: over limit (post still saveable as draft, but can't schedule/publish)

---

## 9. Component Library

### `ThreadSidebar`

```typescript
interface Props {
  threads: SocialAIThread[];
  activeThreadId: string | null;
  loading: boolean;
  onSelectThread: (id: string) => void;
  onNewThread: () => void;
  onArchiveThread: (id: string) => void;
  onDeleteThread: (id: string) => void;
  showOwner?: boolean;      // super admin mode
  currentUserId?: string;
}
```

- Dark sidebar: `bg-slate-800 border-r border-slate-700 h-full flex flex-col`
- Header with "Conversations" title + `+` new button (cyan)
- Scrollable thread list
- Active thread: `bg-slate-700`
- Hover reveals archive (`Archive` icon) and delete (`Trash2` icon) action buttons
- Thread shows: title (1-line), relative time, owner name badge (if `showOwner`)
- Empty state: icon + "No conversations yet" + CTA
- Loading state: skeleton rows

### `ChatMessageList`

```typescript
interface Props {
  messages: SocialAIMessage[];
  isTyping: boolean;
  accounts: SocialAccount[];
  activeMediaJobs: MediaJobInfo[];
  draftAssets: Record<string, MediaAsset[]>;
  publishStatuses: Record<string, { mode: PublishMode; scheduledAt?: string }>;
  onPublishDraft: (msgId, draftIndex, draft, mode, accountIds, media, mediaAssetIds, scheduledAt?) => Promise<void>;
  onMediaAssetReady: (messageId, draftIndex, assets) => void;
  onMediaJobStatusChange: (jobId, status) => void;
  onSendPrompt: (prompt: string) => void;
}
```

- Scrollable container (`overflow-y-auto flex-1`)
- User messages: right-aligned, `bg-cyan-600 text-white rounded-xl rounded-tr-sm`
- Assistant messages: left-aligned, `bg-slate-800 text-slate-200 rounded-xl rounded-tl-sm`
- When `message_type = 'post_draft'` → parse `---DRAFT---` blocks from `content` → render `PostDraftCard` per draft
- `isTyping = true` → show animated typing indicator (3 bouncing dots)
- After all messages → render `ChatMediaTracker` for any pending `activeMediaJobs`
- Empty state: centered prompt cards with starter questions (clicking calls `onSendPrompt`)

**Draft block parsing:**
```typescript
function parseDraftBlocks(content: string): { text: string; drafts: PlatformDraft[] } {
  const draftRegex = /---DRAFT---\n(.*?)\n---END_DRAFT---/gs;
  const drafts: PlatformDraft[] = [];
  let text = content;
  let match;
  while ((match = draftRegex.exec(content)) !== null) {
    try {
      drafts.push(JSON.parse(match[1]));
    } catch {}
    text = text.replace(match[0], '');
  }
  return { text: text.trim(), drafts };
}
```

### `PostDraftCard`

```typescript
interface Props {
  draft: PlatformDraft;
  draftIndex: number;
  messageId: string;
  availableAccounts: SocialAccount[];
  defaultAccountIds: string[];
  publishStatus?: { mode: PublishMode; scheduledAt?: string };
  preloadedMedia?: MediaAsset[];
  existingPostId?: string;
  onPublish: (draftIndex, draft, mode, accountIds, media, mediaAssetIds, scheduledAt?) => Promise<void>;
}
```

- Card: `bg-slate-700 rounded-xl border border-slate-600 p-4`
- Header: platform icon + platform display name + engagement prediction badge (`7.4/10`)
- Hook text: `text-white font-semibold text-sm`
- Body text: `text-slate-300 text-sm`
- CTA: `text-cyan-400 text-sm italic`
- Hashtags: small gray chips
- Visual style suggestion: small italic text
- Character count: colored based on limit
- Divider
- **Account selection:** checkboxes for each connected account with icon
- **Publish mode:** three buttons: `Draft` | `Schedule` | `Post Now`
  - Schedule mode shows: date + time inputs
- **Action button:** changes label based on mode, disabled when `publishStatus` set
- If `publishStatus` set → show green "Published" / "Scheduled" / "Saved" badge instead of button
- Media section: thumbnail grid of `preloadedMedia`

### `ChatMediaTracker`

```typescript
interface Props {
  jobs: MediaJobInfo[];
  onAssetReady: (jobId: string, draftIndex: number, assets: MediaAsset[]) => void;
  onStatusChange: (jobId: string, status: string) => void;
}
```

- Renders a compact status bar showing all in-flight media generation jobs
- Each job row: model name, type badge (image/video), truncated prompt, status chip
- Status chips: `pending` (gray), `generating` (yellow animate-pulse), `ready` (green), `failed` (red)
- Polls `getAssetsByJobIds([jobId])` every 5s for pending/generating jobs
- When status → `ready` → calls `onAssetReady`

### `ChatMediaSettings`

```typescript
interface Props {
  preferences: MediaPreferences;
  onChange: (prefs: MediaPreferences) => void;
  videoModels?: Array<{ id: string; name: string }>;
}
```

- Thin strip at bottom of chat (above input): `bg-slate-800 border-t border-slate-700 px-4 py-2`
- Toggle: "Auto-generate media" (toggle switch)
- When enabled → show video model selector dropdown
- Aspect ratio selector: `9:16` | `16:9` | `1:1` | `4:5`

### `ChatInput`

```typescript
interface Props {
  onSend: (content: string, messageType?: string, attachments?: Attachment[]) => Promise<void>;
  sending: boolean;
  disabled?: boolean;
}
```

- `bg-slate-800 border-t border-slate-700 p-4`
- Expandable textarea (auto-grows)
- Paperclip button for URL/file attachments (shows dropdown: "Paste URL", "YouTube", "Upload File")
- Send button (cyan, `ArrowUp` icon) — disabled when `sending` or empty
- Keyboard: `Enter` to send, `Shift+Enter` for new line
- When attaching URL → shows small preview chip above textarea

### `GuidelineBlockEditor`

```typescript
interface Props {
  label: string;
  blocks: GuidelineBlock[];
  onChange: (blocks: GuidelineBlock[]) => void;
  disabled?: boolean;
  placeholder?: string;
}
```

- Each block: full-width `<textarea>` with auto-height
- Remove button (`X`) on right of each block (hidden when `disabled`)
- "Add block" button at bottom (hidden when `disabled`)
- `disabled = true` → renders as static `<div>` elements

### `SocialCommentsTab`

```typescript
interface Props {
  orgId: string;
}
```

- Fetches `getCommentPosts()` on mount
- "Sync" button calls `syncComments()`, shows last synced time
- Post rows (expandable accordion):
  - Platform icon, post body preview, comment count badge, last comment time
  - Expand → shows `CommentThread` sub-component
- `CommentThread`: each comment as a row with avatar, author name, text, time, action buttons
  - Reply button → expands inline reply textarea
  - Hide button → calls `hideComment()`
  - Mark Done button (checkmark) → calls `markCommentActioned()`
  - Replied/Hidden indicator badges

### `AccountSelector`

```typescript
interface Props {
  accounts: SocialAccount[];
  groups: SocialAccountGroup[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onCreateGroup: () => void;
}
```

- Scrollable list with `h-full overflow-y-auto`
- "Individual Accounts" section header
- Each account: checkbox + avatar + display_name + provider icon
- "Account Groups" section header + "Create Group" button
- Each group: checkbox (selects all accounts in group) + group name + member count

### `ContentComposer`

```typescript
interface Props {
  value: string;
  onChange: (value: string) => void;
  targets: string[];
  accounts: SocialAccount[];
  characterLimits: Record<string, number>;
  mediaItems: MediaItem[];
  onMediaChange: (items: MediaItem[]) => void;
  customized: boolean;
  onCustomizedChange: (v: boolean) => void;
  channelContent?: Record<string, string>;
  onChannelContentChange?: (platform: string, text: string) => void;
}
```

### `PostPreviewPanel`

```typescript
interface Props {
  body: string;
  media: MediaItem[];
  platform: SocialProvider;
  accountName: string;
  accountAvatar?: string;
}
```

- Renders a convincing mock of each platform's post card style
- Facebook: white card, avatar+name header, body text, image grid
- Instagram: square image dominant, body below
- LinkedIn: card with "Like/Comment/Share" actions
- TikTok: vertical video style with overlaid text

### `AIContentAssistant`

```typescript
interface Props {
  postId?: string;
  content: string;
  platform: SocialProvider;
  targets: SocialProvider[];
  orgId: string;
  brandKitId?: string;
  brandVoiceId?: string;
  onApply: (newContent: string) => void;
}
```

Accordion sections:
1. **Quick Suggestions** — 7 buttons, each calls `generateQuickSuggestion()`, shows result with "Apply" button
2. **Generate New** — form fields → calls `generateNewContent()`, shows draft cards
3. **Repurpose** — source type selector + input + action → calls `repurposeContent()`
4. **Hashtags** — count slider + toggles → calls `generateHashtags()`, shows chips
5. **CTA** — objective selector → calls `generateCTA()`, shows options as buttons

### `CreateGroupModal`

```typescript
interface Props {
  accounts: SocialAccount[];
  existingGroup?: SocialAccountGroup;
  onSave: (name: string, accountIds: string[], description?: string) => Promise<void>;
  onClose: () => void;
}
```

- Name input (required)
- Description input (optional)
- Checkboxes for all accounts with provider icon
- Save / Cancel buttons

---

## 10. Edge Functions (Backend)

All edge functions are Supabase Edge Functions (Deno). They must:
- Return `Content-Type: application/json`
- Include CORS headers on all responses
- Handle `OPTIONS` preflight with `200`
- Wrap all logic in `try/catch`

### `ai-social-chat`

**Method:** POST
**Auth:** Required (Supabase JWT)

**Request body:**
```json
{
  "thread_id": "uuid",
  "content": "User message text",
  "message_type": "text",
  "attachments": [],
  "auto_generate_media": true,
  "video_model_id": "optional-model-id",
  "video_mode": "std",
  "aspect_ratio": "9:16",
  "style_preset_id": "optional-uuid"
}
```

**IMPORTANT:** The text generation model (GPT-5.2) and image model (Nano Banana 2) are hard-coded server-side. The client CANNOT override the text model. If a `text_model_id` parameter is sent in the request, return `400 Bad Request`.

**Process:**
1. Authenticate request, extract `organization_id` and `user_id` from JWT
2. Load thread + all message history
3. Load org's `social_guidelines` for context
4. Load active brand kit + brand voice
5. Build system prompt with guidelines, brand voice, and platform-specific rules
6. Call text AI (GPT-5.2) with full conversation history
7. Parse AI response for draft blocks (look for JSON arrays in response)
8. If `auto_generate_media = true` and drafts have `visual_style_suggestion` → submit media generation jobs to Kie API
9. Return response

**Response:**
```json
{
  "response": "AI text response",
  "drafts": [
    {
      "platform": "instagram",
      "hook": "Hook text",
      "body": "Body text",
      "cta": "CTA text",
      "hashtags": ["#tag"],
      "visual_style_suggestion": "Style hint",
      "engagement_prediction": 7.4,
      "character_count": 892
    }
  ],
  "media_jobs": [
    {
      "job_id": "uuid",
      "model_id": "nano-banana-2",
      "model_name": "Nano Banana 2",
      "media_type": "image",
      "prompt": "Generation prompt",
      "status": "pending",
      "draft_index": 0
    }
  ],
  "media_skipped_reason": null,
  "model_used": "gpt-5.2"
}
```

### `ai-social-content`

**Method:** POST
**Auth:** Required

**Request body:**
```json
{
  "action_type": "quick_suggestion | generate_new | repurpose | generate_hashtags | generate_cta | scrape_url | extract_youtube",
  "org_id": "uuid",
  "...action-specific fields"
}
```

**Returns:** Action-specific result object. See `services/socialAI.ts` for shapes.

### `ai-social-campaign-generator`

**Method:** POST
**Auth:** Required

**Request body:**
```json
{ "campaign_id": "uuid" }
```

**Process:**
1. Load campaign by ID, verify org ownership
2. Load `social_guidelines`
3. Generate N posts (based on frequency: daily=7, weekly=4, biweekly=2, monthly=1) per platform
4. Insert posts into `social_posts` with `campaign_id`, `ai_generated = true`, status based on `autopilot_mode`
5. Increment `campaign.post_count`

**Response:**
```json
{ "generated": 12, "post_ids": ["uuid1", "uuid2", "..."] }
```

### `social-worker`

**Method:** POST
**Auth:** Required

**Request body:**
```json
{ "post_id": "uuid" }
```

**Process:**
1. Load post + targets (social account IDs)
2. Resolve per-channel content (use `social_post_content` overrides if `customized_per_channel`)
3. For each target account → publish via Late API
4. On success: update `status = 'posted'`, `posted_at = now()`, `late_post_id`, `late_status`
5. On failure: update `status = 'failed'`, `last_error`, increment `attempt_count`
6. Log result in `social_post_logs`

### `late-connect`

**Method:** POST
**Auth:** Required

**Request body:**
```json
{
  "provider": "instagram",
  "success_redirect_url": "https://app.example.com/marketing/social/accounts",
  "failure_redirect_url": "https://app.example.com/marketing/social/accounts",
  "reconnect_account_id": "optional-existing-account-uuid"
}
```

**Response:**
```json
{ "data": { "url": "https://auth.late.dev/connect/..." } }
```

### `late-metrics`

**Method:** POST
**Auth:** Required

**Single post:**
```json
{ "post_id": "uuid" }
```

**Bulk:**
```json
{ "bulk": true }
```

**Response (single):**
```json
{ "success": true, "metrics": { "impressions": 1200, "likes": 45, ... } }
```

**Response (bulk):**
```json
{ "synced": 23 }
```

### `late-inbox-comments-sync`

**Method:** POST
**Auth:** Required

**Sync:**
```json
{ "org_id": "uuid" }
```

**Hide comment:**
```json
{ "org_id": "uuid", "action": "hide", "late_comment_id": "...", "late_account_id": "..." }
```

**Reply to comment:**
```json
{
  "org_id": "uuid",
  "action": "reply",
  "late_comment_id": "...",
  "late_post_id": "...",
  "late_account_id": "...",
  "reply_text": "Thank you!"
}
```

---

## 11. Permissions & Feature Flags

### Permission Keys

| Key | Description |
|---|---|
| `marketing.social.view` | Can access the social module, view posts, accounts, analytics, guidelines |
| `marketing.social.manage` | Can create/edit/delete posts, manage campaigns, edit guidelines, connect/disconnect accounts |

### Feature Flag

The `marketing` feature flag must be enabled for the organization. If disabled, redirect to a "Feature Disabled" page.

### Super Admin Behavior

- Can view **all** organization threads in the Chat (not just their own)
- Threads list shows `owner_name` badge per thread
- Can access and edit Guidelines regardless of `manage` permission

---

## 12. Provider Reference

| Provider Key | Display Name | Brand Hex | Icon |
|---|---|---|---|
| `facebook` | Facebook | `#1877F2` | Facebook-style F |
| `instagram` | Instagram | `#E4405F` | Camera outline |
| `linkedin` | LinkedIn | `#0A66C2` | "in" square |
| `google_business` | Google Business | `#4285F4` | Google G |
| `tiktok` | TikTok | `#000000` | Musical note |
| `youtube` | YouTube | `#FF0000` | Play button |
| `reddit` | Reddit | `#FF4500` | Reddit alien |

---

## 13. Platform Content Rules

### Character Limits

```typescript
const PLATFORM_CHARACTER_LIMITS: Record<SocialProvider, number> = {
  facebook:        63206,
  instagram:       2200,
  linkedin:        3000,
  google_business: 1500,
  tiktok:          2200,
  youtube:         5000,  // caption; title is 100 chars
  reddit:          40000,
};
```

### Hashtag Guidelines

```typescript
const PLATFORM_HASHTAG_GUIDELINES = {
  facebook:        { max: 3,   placement: 'end',   note: 'Use sparingly' },
  instagram:       { max: 30,  placement: 'end',   note: 'Widely accepted, use 10–15' },
  linkedin:        { max: 5,   placement: 'end',   note: 'Professional; 3–5 optimal' },
  google_business: { max: 0,   placement: 'none',  note: 'Not supported' },
  tiktok:          { max: 10,  placement: 'end',   note: 'Mix trending + niche' },
  youtube:         { max: 15,  placement: 'end',   note: 'In description' },
  reddit:          { max: 0,   placement: 'none',  note: 'Use flair instead' },
};
```

### Emoji Guidelines

```typescript
const PLATFORM_EMOJI_GUIDELINES = {
  facebook:        { recommended: true,  frequency: 'moderate' },
  instagram:       { recommended: true,  frequency: 'moderate' },
  linkedin:        { recommended: true,  frequency: 'minimal'  },
  google_business: { recommended: false, frequency: 'none'     },
  tiktok:          { recommended: true,  frequency: 'heavy'    },
  youtube:         { recommended: false, frequency: 'none'     },
  reddit:          { recommended: false, frequency: 'minimal'  },
};
```

### Media Requirements

```typescript
const PLATFORM_MEDIA_REQUIREMENTS = {
  facebook:        { maxImages: 10, maxVideoSec: 14400, aspectRatios: ['1:1','4:5','16:9'] },
  instagram:       { maxImages: 10, maxVideoSec: 60,    aspectRatios: ['1:1','4:5','9:16'] },
  linkedin:        { maxImages: 9,  maxVideoSec: 600,   aspectRatios: ['1:1','4:5','16:9'] },
  google_business: { maxImages: 1,  maxVideoSec: 30,    aspectRatios: ['4:3','1:1']        },
  tiktok:          { maxImages: 0,  maxVideoSec: 600,   aspectRatios: ['9:16']             },
  youtube:         { maxImages: 0,  maxVideoSec: null,  aspectRatios: ['16:9']             },
  reddit:          { maxImages: 20, maxVideoSec: 900,   aspectRatios: ['any']              },
};
```

---

*End of specification. This document covers the complete AI Social Manager module as implemented. Build each section in the order: Database → Types → Services → Edge Functions → Components → Pages.*
