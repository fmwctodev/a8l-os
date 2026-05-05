# Automations Module — Action / Trigger Completeness Matrix

Comprehensive audit of every workflow action and trigger across three pillars:
1. **Engine handler** — does `workflow-processor` actually execute it?
2. **UI config** — is there a `*Config.tsx` component in `actionConfigs/` or `triggerConfigs/` to bind the node's data?
3. **Picker entry** — does the `ActionPickerDrawer` / `TriggerPickerDrawer` list it for users to pick?

Goal: every row green. As of 2026-05-05 (post-Phase-1), many engine handlers have no UI config or picker entry, so users can't actually create those node types from the builder.

**Status legend:**
- ✅ Done
- ⚠️ Partial
- ❌ Missing — needs build
- 🚫 N/A (deprecated or not user-facing)

---

## Triggers (workflow_trigger_type)

| trigger_type (enum) | Emitter (Phase 1 ✓) | Engine filter handler | UI Config | Picker entry |
|---|---|---|---|---|
| `contact_created` | ✅ DB trigger | ⚠️ no specific filter (allows any) | ✅ `ContactCreatedConfig` | ❌ |
| `contact_updated` | ✅ DB trigger | ⚠️ generic | ✅ `ContactChangedConfig` | ❌ |
| `contact_tag_added` | ✅ DB trigger | ✅ `contact_tag_changed` | ✅ `ContactTagConfig` | ❌ |
| `contact_tag_removed` | ✅ DB trigger | ✅ `contact_tag_changed` | ✅ `ContactTagConfig` | ❌ |
| `contact_owner_changed` | ✅ DB trigger | ❌ | ❌ | ❌ |
| `contact_department_changed` | ✅ DB trigger | ❌ | ❌ | ❌ |
| `conversation_message_received` | ✅ plivo-sms-inbound | ✅ `event_customer_replied` (close enough) | ✅ `CustomerRepliedConfig` | ❌ |
| `conversation_status_changed` | ❌ no emitter | ❌ | ❌ | ❌ |
| `conversation_assigned` | ❌ no emitter | ❌ | ❌ | ❌ |
| `appointment_booked` | ✅ booking-api | ✅ `appointment_customer_booked` | ✅ `CustomerBookedConfig` | ❌ |
| `appointment_rescheduled` | ✅ DB trigger | ⚠️ no specific filter | ❌ | ❌ |
| `appointment_canceled` | ✅ DB trigger | ✅ `appointment_status_changed` | ✅ `AppointmentStatusConfig` | ❌ |
| `form_submitted` | ✅ form-submit | ✅ `event_form_submitted` | ✅ `FormSubmittedConfig` | ❌ |
| `opportunity_created` | ✅ DB trigger + form-submit | ✅ `opportunity_created` | ✅ `OpportunityCreatedConfig` | ❌ |
| `opportunity_stage_changed` | ✅ DB trigger | ✅ `opportunity_stage_changed` | ✅ `OpportunityStageChangedConfig` | ❌ |
| `opportunity_status_changed` | ✅ DB trigger | ✅ `opportunity_status_changed` | ✅ `OpportunityStatusChangedConfig` | ❌ |
| `sms_send_requested` | 🚫 reserved future use | ❌ | ❌ | ❌ |
| `ai_call_started` (P6) | ✅ vapi-webhook | ✅ allow-all | ❌ (no specific UI yet — fires on every call) | ✅ TRIGGER_OPTIONS |
| `ai_call_completed` (P6) | ✅ vapi-webhook | ✅ outcome/duration/qualified/assistant filter | ✅ `AICallCompletedConfig` | ✅ TRIGGER_OPTIONS |
| `ai_voicemail_received` (P6) | ✅ vapi-webhook | ✅ keyword/duration/sentiment filter | ✅ `AIVoicemailReceivedConfig` | ✅ TRIGGER_OPTIONS |
| `ai_agent_handoff_requested` (P6) | ✅ vapi-webhook | ✅ reason/channel filter | ✅ `AIAgentHandoffConfig` | ✅ TRIGGER_OPTIONS |

**Trigger-side gap summary:**
- Picker entries are entirely missing (TriggerPickerDrawer needs to enumerate every trigger type)
- 3 trigger types have no engine filter handler (contact_owner_changed, contact_department_changed, appointment_rescheduled)
- 2 conversation triggers have no emitter (status_changed, assigned)
- AI/Vapi triggers belong to Phase 6

---

## Actions (workflow_action_type)

### Communication

| action_type | Engine handler | UI Config | Picker entry |
|---|---|---|---|
| `send_sms` | ✅ | ❌ | ❌ |
| `send_email` (legacy Gmail) | ⚠️ uses Gmail (Phase 5 dual-rail rewrite) | ❌ | ❌ |
| `send_email_org` (P4-P5) | ❌ — Phase 4 | ❌ — Phase 4 | ❌ — Phase 4 |
| `send_email_personal` (P4-P5) | ❌ — Phase 4 | ❌ — Phase 4 | ❌ — Phase 4 |
| `webhook_post` | ✅ | ❌ | ❌ |
| `notify_user` | ✅ | ❌ | ❌ |
| `send_review_request` | ✅ | ❌ | ❌ |
| `send_booking_link` | ✅ | ❌ | ❌ |
| `send_slack_message` | ⚠️ stub | ✅ `SendSlackMessageConfig` | ❌ |
| `send_messenger` | ⚠️ stub | ✅ `SendMessengerConfig` | ❌ |
| `send_gmb_message` | ⚠️ stub | ✅ `SendGmbMessageConfig` | ❌ |
| `send_internal_notification` | ✅ | ✅ | ❌ |
| `send_live_chat_message` | ⚠️ stub | ✅ | ❌ |
| `facebook_interactive_messenger` | ⚠️ stub | ✅ | ❌ |
| `instagram_interactive_messenger` | ⚠️ stub | ✅ | ❌ |
| `reply_in_comments` | ⚠️ stub | ✅ | ❌ |
| `send_documents_and_contracts` | ⚠️ stub | ✅ | ❌ |

### Contact management

| action_type | Engine | UI Config | Picker |
|---|---|---|---|
| `add_tag` | ✅ | ❌ | ❌ |
| `remove_tag` | ✅ | ❌ | ❌ |
| `update_field` | ✅ | ❌ | ❌ |
| `assign_owner` | ✅ | ❌ | ❌ |
| `move_department` | ✅ | ❌ | ❌ |
| `create_note` | ✅ | ❌ | ❌ |
| `add_note` (alias) | ✅ | ✅ `AddNoteConfig` | ❌ |
| `edit_conversation` | ✅ | ✅ | ❌ |
| `modify_engagement_score` | ✅ | ✅ | ❌ |
| `modify_followers` | ✅ | ✅ | ❌ |
| `set_dnd` | ✅ | ❌ | ❌ |
| `remove_dnd` | ✅ | ❌ | ❌ |
| `create_contact` | ✅ | ✅ | ❌ |
| `find_contact` | ✅ | ✅ | ❌ |
| `delete_contact` | ✅ | ✅ | ❌ |
| `copy_contact` | ✅ | ✅ | ❌ |

### Opportunities

| action_type | Engine | UI Config | Picker |
|---|---|---|---|
| `create_opportunity` | ✅ | ❌ | ❌ |
| `update_opportunity` | ✅ | ❌ | ❌ |
| `create_or_update_opportunity` | ✅ | ✅ | ❌ |
| `move_opportunity_stage` | ✅ | ❌ | ❌ |
| `assign_opportunity_owner` | ✅ | ❌ | ❌ |
| `mark_opportunity_won` | ✅ | ❌ | ❌ |
| `mark_opportunity_lost` | ✅ | ❌ | ❌ |
| `remove_opportunity` | ✅ | ✅ | ❌ |

### Appointments

| action_type | Engine | UI Config | Picker |
|---|---|---|---|
| `create_appointment` | ✅ | ❌ | ❌ |
| `cancel_appointment` | ✅ | ❌ | ❌ |
| `reschedule_appointment` | ✅ | ❌ | ❌ |
| `send_appointment_reminder` | ✅ | ❌ | ❌ |
| `mark_no_show` | ✅ | ❌ | ❌ |
| `update_appointment_status` | ✅ | ✅ | ❌ |
| `generate_booking_link` | ✅ | ✅ | ❌ |

### Tasks

| action_type | Engine | UI Config | Picker |
|---|---|---|---|
| `create_task` | ✅ | ❌ | ❌ |
| `assign_task` | ✅ | ❌ | ❌ |
| `mark_task_complete` | ✅ | ❌ | ❌ |

### Payments

| action_type | Engine | UI Config | Picker |
|---|---|---|---|
| `create_invoice` | ✅ | ❌ | ❌ |
| `send_invoice` | ✅ | ❌ | ❌ |
| `void_invoice` | ✅ | ❌ | ❌ |
| `create_subscription` | ✅ | ❌ | ❌ |

### AI

| action_type | Engine | UI Config | Picker |
|---|---|---|---|
| `invoke_ai_agent` | ✅ | ❌ | ❌ |
| `ai_conversation_reply` | ✅ | ✅ | ❌ |
| `ai_email_draft` | ✅ | ❌ | ❌ |
| `ai_follow_up_message` | ✅ | ❌ | ❌ |
| `ai_lead_qualification` | ✅ | ❌ | ❌ |
| `ai_booking_assist` | ✅ | ❌ | ❌ |
| `ai_decision_step` | ✅ | ❌ | ❌ |
| `ai_prompt` | ✅ | ✅ | ❌ |
| `start_ai_call` (P6) | ✅ executeVapiAction → Vapi /call | ✅ `StartAiCallConfig` | ✅ ACTION_OPTIONS |
| `transfer_to_ai_agent` (P6) | ✅ executeVapiAction → Vapi /call | ✅ `TransferToAiAgentConfig` | ✅ ACTION_OPTIONS |
| `send_ai_voicemail` (P6) | ✅ executeVapiAction → Vapi /call (voicemail mode) | ✅ `SendAiVoicemailConfig` | ✅ ACTION_OPTIONS |

### Flow control

| action_type | Engine | UI Config | Picker |
|---|---|---|---|
| `delay` | ✅ (calculateDelayRunAt) | 🚫 native node | 🚫 native node |
| `wait_for_condition` | ✅ | ❌ | ❌ |
| `if_else` | ✅ (condition node) | 🚫 native node | 🚫 native node |
| `goal_check` | ✅ | 🚫 native node | 🚫 native node |
| `go_to` | ✅ | ✅ | ❌ |
| `go_to_step` | ✅ | ❌ | ❌ |
| `repeat_until` | ✅ | ❌ | ❌ |
| `stop_workflow` | ✅ | ❌ | ❌ |
| `trigger_another_workflow` | ✅ | ❌ | ❌ |
| `add_to_workflow` | ⚠️ alias | ❌ | ❌ |
| `remove_from_workflow` | ✅ | ❌ | ❌ |
| `remove_from_workflow_action` | ✅ | ✅ | ❌ |
| `set_workflow_variable` | ✅ | ❌ | ❌ |
| `manual_action` | ✅ | ✅ | ❌ |
| `split_test` | ✅ | ✅ | ❌ |
| `drip_mode` | ✅ | ✅ | ❌ |

### Data / formatting

| action_type | Engine | UI Config | Picker |
|---|---|---|---|
| `update_custom_value` | ✅ | ✅ | ❌ |
| `update_custom_field` | ✅ | ❌ | ❌ |
| `update_contact_field` | ✅ | ❌ | ❌ |
| `array_operation` | ✅ | ✅ | ❌ |
| `text_formatter` | ✅ | ✅ | ❌ |

### Marketing / system

| action_type | Engine | UI Config | Picker |
|---|---|---|---|
| `update_lead_score` | ✅ | ❌ | ❌ |
| `add_to_email_campaign` | ⚠️ stub | ❌ | ❌ |
| `remove_from_email_campaign` | ⚠️ stub | ❌ | ❌ |
| `add_to_review_campaign` | ⚠️ stub | ❌ | ❌ |
| `reply_to_review` | ⚠️ stub | ❌ | ❌ |
| `generate_ai_review_reply` | ✅ | ❌ | ❌ |
| `flag_review_spam` | ⚠️ stub | ❌ | ❌ |
| `hide_review` | ⚠️ stub | ❌ | ❌ |
| `create_review_followup_task` | ⚠️ stub | ❌ | ❌ |
| `log_custom_event` | ✅ | ❌ | ❌ |
| `webhook` (alias of webhook_post) | ✅ | ❌ | ❌ |
| `create_proposal` | ✅ | ❌ | ❌ |
| `send_proposal` | ✅ | ❌ | ❌ |
| `create_project` | ✅ | ❌ | ❌ |
| `update_project_stage` | ✅ | ❌ | ❌ |
| `generate_meeting_follow_up` | ⚠️ stub | ❌ | ❌ |
| `grant_course_access` | ⚠️ stub | ❌ | ❌ |
| `grant_community_access` | ⚠️ stub | ❌ | ❌ |

---

## High-priority backlog (must have for v1)

These are the actions / triggers most workflows actually use. Configs and picker entries should be built first:

**Triggers (top 8):**
1. `event_form_submitted` — already has config; need picker entry
2. `appointment_customer_booked` — already has config; need picker entry
3. `opportunity_created` / `opportunity_stage_changed` / `opportunity_status_changed` — configs exist; need picker
4. `contact_created` / `contact_changed` — configs exist; need picker
5. `event_customer_replied` (covers conversation_message_received) — config exists; need picker

**Actions (top 12):**
1. `send_sms` — most common; needs `SendSmsConfig` + picker
2. `send_email_org` (P4) — most common email; needs config + picker
3. `send_email_personal` (P4) — needs config + picker
4. `add_tag` / `remove_tag` — frequent; need configs (simple — tag picker)
5. `update_field` — needs `UpdateFieldConfig`
6. `assign_owner` — needs `AssignOwnerConfig`
7. `create_task` — needs `CreateTaskConfig`
8. `create_opportunity` — needs `CreateOpportunityConfig`
9. `move_opportunity_stage` — needs `MoveOpportunityStageConfig`
10. `notify_user` — needs `NotifyUserConfig`
11. `webhook_post` — needs `WebhookPostConfig`
12. `set_dnd` / `remove_dnd` — needs `SetDndConfig`

The remaining configs are nice-to-have and can be filled in iteratively as users request them.

---

## Picker drawers — ALL entries missing

Per audit, the Picker Drawers (Action + Trigger) have ZERO entries listed for users to choose from. This is the single biggest UX gap. Phase 3 implementation should:

1. Edit `ActionPickerDrawer.tsx` — enumerate every action type from `ACTION_CONFIG_MAP` plus the engine-only ones, group by category (Communication, Contact mgmt, Opportunities, Appointments, Tasks, AI, Flow control, Data, Marketing), include search box and category filter, show friendly name + description + icon for each.

2. Edit `TriggerPickerDrawer.tsx` — same pattern for trigger types, enumerated from `TRIGGER_CONFIG_MAP`.

3. Show a "Coming soon" badge for action types whose engine handler is a stub or whose config hasn't been built. Don't hide them entirely — visibility helps users know what's planned.

---

## Next steps

This audit doc establishes the baseline. Subsequent work in P3 should:
- Build the 12 priority action configs
- Build the picker drawer entries (full enumeration)
- Re-run the audit and fill in green checkmarks

Phases 4-15 will add new rows (email_org, email_personal, AI/Vapi actions/triggers, etc.) which should also land in this matrix as they ship.
