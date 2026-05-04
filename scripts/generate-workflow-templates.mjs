/**
 * Generates production-ready WorkflowDefinition JSON for the 10 system
 * automation templates per the Autom8tion Lab Workflow Library v1.0 PDF.
 *
 * Output: writes a SQL migration to stdout that UPDATEs each system
 * template's latest version snapshot to the new content. Because the
 * existing instantiated workflows carry their own copy of the snapshot,
 * they are unaffected — the change only impacts new instantiations from
 * the templates after this migration runs.
 *
 * Run:  node scripts/generate-workflow-templates.mjs > supabase/migrations/<ts>_workflow_template_v2_content.sql
 */

import fs from 'node:fs';
import path from 'node:path';

const SPACING_Y = 130;
const COL_X = 320;

let nodeCounter = 0;
function id(prefix = 'n') {
  return `${prefix}${++nodeCounter}`;
}

/** Builder helpers to keep authoring readable. */

function trigger(triggerType, extra = {}) {
  return { type: 'trigger', data: { triggerType, triggerCategory: 'event', ...extra } };
}
function delay(value, unit = 'minutes') {
  return { type: 'delay', data: { delayType: 'wait_duration', duration: { value, unit } } };
}
function action(actionType, config = {}) {
  return { type: 'action', data: { actionType, config } };
}
function condition(label, rules) {
  return { type: 'condition', data: { label, conditions: { logic: 'and', rules } } };
}
function endNode(label = 'End') {
  return { type: 'end', data: { label } };
}

/**
 * Build a WorkflowDefinition from a sequence spec.
 *
 * Spec items can be:
 *   - { type, data }          — a single node, will be wired serially to the previous
 *   - { branch: condition, yes: [steps], no: [steps] } — condition with two branches
 *
 * Each branch ends with its own `end` node.
 */
function buildDefinition(seq, settings = {}) {
  nodeCounter = 0;
  const nodes = [];
  const edges = [];

  const wireAndPlace = (items, x, startY, parentId, parentHandle) => {
    let prevId = parentId;
    let prevHandle = parentHandle;
    let y = startY;

    for (const item of items) {
      if (item.branch) {
        // Place condition node
        const condId = id('c');
        const condNode = { id: condId, ...item.branch, position: { x, y } };
        nodes.push(condNode);
        if (prevId) {
          const edge = { id: `e_${prevId}_${condId}`, source: prevId, target: condId };
          if (prevHandle) edge.sourceHandle = prevHandle;
          edges.push(edge);
        }
        y += SPACING_Y;

        // YES branch - flows to the right
        wireAndPlace(item.yes || [], x + 280, y, condId, 'true');
        // NO branch - flows down (main path)
        wireAndPlace(item.no || [], x, y, condId, 'false');

        // Branch terminates the parent flow — caller usually puts end nodes inside
        return;
      }

      const nodeId = id();
      const node = { id: nodeId, ...item, position: { x, y } };
      nodes.push(node);

      if (prevId) {
        const edge = { id: `e_${prevId}_${nodeId}`, source: prevId, target: nodeId };
        if (prevHandle) edge.sourceHandle = prevHandle;
        edges.push(edge);
      }

      prevId = nodeId;
      prevHandle = undefined;
      y += SPACING_Y;
    }
  };

  wireAndPlace(seq, COL_X, 60, null, undefined);

  return {
    nodes,
    edges,
    viewport: { x: 0, y: 0, zoom: 1 },
    settings: {
      enrollmentRules: {
        allow_re_enrollment: 'after_completion',
        stop_existing_on_re_entry: false,
        max_concurrent_enrollments: 1,
      },
      waitTimeoutDays: 30,
      loggingVerbosity: 'standard',
      failureNotificationUserIds: [],
      ...settings,
    },
  };
}

// ---------------------------------------------------------------------------
// Workflow copy from the PDF
// ---------------------------------------------------------------------------

const WELCOME_EMAIL_BODY = `Hey {{contact.first_name}},

Thanks for reaching out to Autom8ion Lab. I wanted to personally welcome you and make sure you didn't disappear into a generic email funnel.

Here's what happens next:
→ I'll send over a few resources we typically share with new contacts
→ If you're ready to chat sooner, you can grab time on my calendar here: https://os.autom8ionlab.com/book/capability-briefing
→ If you have a quick question, just hit reply — this email goes straight to my inbox

A bit about us: We engineer custom AI agents and automation systems for service businesses — the kind of work that takes lead follow-up, client onboarding, and back-office ops off your plate so you stop losing deals to slow response times and manual handoffs.

Looking forward to connecting.

Sean Richard
Founder
Autom8ion Lab
698-310-2712 | autom8ionlab.com`;

const HOT_LEAD_EMAIL_BODY = `{{contact.first_name}},

Got your inquiry — based on what you shared, this looks like exactly the kind of project we work on every day.

I want to skip the back-and-forth. Here's a link to my calendar with 15-minute openings this week: https://os.autom8ionlab.com/book/capability-briefing

On the call we'll cover:
→ Where you're at right now with [PAIN POINT]
→ What "solved" looks like for you
→ Whether we're the right fit (and if not, who is)

If today's not the right time but you've got a quick question, hit reply.

Talk soon,
Sean Richard`;

const WARM_LEAD_EMAIL_BODY = `Hey {{contact.first_name}},

Thanks for filling out the form. Based on your responses, I put together a quick resource that should help: [LINK TO GUIDE / CASE STUDY]

A lot of folks in your spot are wrestling with the same things — [TOP 1-2 PAIN POINTS]. The guide walks through how we've solved it for clients in [INDUSTRY].

If after reading it you'd like to chat, my calendar is here: https://os.autom8ionlab.com/book/capability-briefing

No pressure either way.

Sean Richard
Autom8ion Lab`;

const COLD_LEAD_EMAIL_BODY = `Hi {{contact.first_name}},

Thanks for getting in touch. Based on what you shared, we may not be the right fit right now, but I want to keep you in the loop with the kind of resources we share with our community.

I'll send over our monthly insights — practical tactics on automation, AI, and operations. Unsubscribe anytime.

If your situation changes and you'd like to reconnect, just reply to any email.

Best,
Sean Richard`;

const FOLLOWUP1_EMAIL = `Hey {{contact.first_name}},

Wanted to bump my last email to the top of your inbox in case it slipped through.

Quick recap: [1-LINE SUMMARY OF ORIGINAL OFFER OR ASK].

If now's not the right time, no worries at all — just let me know and I'll back off. If it is, here's my calendar: https://os.autom8ionlab.com/book/capability-briefing

Sean Richard`;

const BREAKUP_EMAIL = `{{contact.first_name}},

I've reached out a few times and haven't heard back, which usually means one of three things:

1. You're slammed and this isn't a priority right now
2. You're not interested and I should stop following up
3. You fell off a cliff (in which case, hope you're OK)

A one-word reply is all I need: 1, 2, or 3. Whichever it is, I'll respect it.

If I don't hear back, I'll assume #2 and close your file — no hard feelings.

Sean Richard`;

const BOOKING_CONFIRM_EMAIL = `{{contact.first_name}}, you're booked. ✅

Here are your details:
📅 Date: {{appointment.start_date}}
⏰ Time: {{appointment.start_time}} ({{appointment.timezone}})
📍 Location: {{appointment.location}}
👤 With: {{appointment.assigned_user_name}}

What to expect:
- We'll start on time — please join 1-2 minutes early
- Have any prep questions ready
- The call is roughly {{appointment.duration}} minutes

Need to reschedule? Use this link: [RESCHEDULE LINK]
Need to cancel? [CANCEL LINK]

Looking forward to it.

Sean Richard
Autom8ion Lab`;

const POST_MEETING_AI_PROMPT = `You are writing a post-meeting follow-up email on behalf of Sean Richard at Autom8ion Lab.

Meeting context:
- Attendee: {{contact.first_name}} {{contact.last_name}} from {{contact.company_name}}
- Meeting topic: {{appointment.title}}
- Meeting notes/transcript: {{meeting.notes}}

Write a follow-up email that:
1. Thanks them for their time (briefly — one line)
2. Recaps the 2-3 most important things discussed (bulleted)
3. Lists the agreed next steps with owners (who does what)
4. Includes a soft close-the-loop CTA (book next meeting / approve proposal / etc.)

Tone: Professional but warm. Conversational, not corporate. Short sentences.
Length: 150-200 words max.

Do NOT include subject line or signature — just the body.`;

const POST_MEETING_BREAKUP_EMAIL = `{{contact.first_name}},

It's been about a week since we connected. I want to make sure I'm not chasing if the timing's just not right.

Where's your head at?

A) Still interested — let's keep moving
B) Interested but not right now — circle back in [X] months
C) Not the right fit after all — close the file

Whichever it is, I'll respect it.

Sean Richard`;

const PROPOSAL_CONFIRM_EMAIL = `{{contact.first_name}},

As promised, your proposal is attached / linked below:

📄 [PROPOSAL LINK]

A quick guide to reviewing it:
→ Page 1-2: What we'll deliver and the scope
→ Page 3: Timeline and milestones
→ Page 4: Investment and payment terms
→ Page 5: Acceptance — sign right inside the document

If anything raises a question, reply to this email or text me at 698-310-2712.

Once you're ready, hit "Approve" inside the proposal and we'll get the kickoff scheduled within 24 hours.

Sean Richard
Autom8ion Lab`;

const PROPOSAL_FOLLOWUP_EMAIL = `Hey {{contact.first_name}},

Wanted to follow up on the proposal I sent over a few days ago. No pressure — I know these decisions take time and there are usually a few stakeholders involved.

A few quick notes that might help:
→ If you have questions on scope, pricing, or timeline, I'm happy to jump on a 10-minute call to walk through it: https://os.autom8ionlab.com/book/capability-briefing
→ If you need to share it internally, the link is: [PROPOSAL LINK]
→ If anything needs to change to make it a yes, tell me what and we'll figure it out

What's the best next step from your side?

Sean Richard`;

const ONBOARDING_EMAIL = `{{contact.first_name}},

Officially welcome to Autom8ion Lab. We're genuinely excited to be working with you.

Here's exactly what happens from here:

**Step 1 — Kickoff call (this week)**
You'll get an email tomorrow with a link to book your kickoff. We'll spend 45 minutes aligning on goals, walking through your access/credentials, and locking the project plan.

**Step 2 — Onboarding doc**
After kickoff, you'll get a Notion/shared drive with your project hub: timeline, deliverables, point-of-contact, and weekly status doc.

**Step 3 — Build phase begins**
We start work the day after kickoff. Expect your first milestone within [X] days.

In the meantime, if anything comes up, your direct contacts are:
👤 Sean Richard — [YOUR EMAIL] — 698-310-2712
👤 [BACKUP CONTACT] — [BACKUP EMAIL]

Welcome to the team.

Sean Richard
Autom8ion Lab`;

const KICKOFF_PREP_EMAIL = `{{contact.first_name}},

Ready to kick this off. Grab a 45-minute slot here: https://os.autom8ionlab.com/book/capability-briefing

Before the call, please:
→ Review the welcome email I sent yesterday (so we're aligned on the process)
→ Have your team's primary point-of-contact available, ideally on the call
→ Bring any access we'll need (logins, accounts, brand assets)

If you've got questions before then, just reply.

Talk soon,
Sean Richard`;

const REENGAGE_EMAIL = `Hey {{contact.first_name}},

It's been about a month since we last spoke and I wanted to check in — no agenda, just genuinely curious.

When we talked, you were dealing with [PAIN POINT FROM PREVIOUS CONVO — IF NO CUSTOM FIELD, KEEP GENERIC: "the challenges around [TOPIC]"]. A lot can change in 30 days.

Three quick questions:
1. Did you end up solving it another way?
2. Did the priority shift to something else?
3. Or is it still on the list and the timing just hasn't been right?

If it's #3 and you'd like to revisit, I've got time this week: https://os.autom8ionlab.com/book/capability-briefing

If it's #1 or #2, I'd love to hear what you ended up doing — always learning from how folks solve this stuff.

Either way, no pressure.

Sean Richard
Autom8ion Lab`;

const REVIEW_EMAIL = `{{contact.first_name}},

Hope you're loving what we built / delivered. 🚀

I've got a small ask — would you mind leaving us a quick Google review? It takes about 60 seconds and it makes a real difference for a small business like ours.

👉 [REVIEW LINK]

Even a single sentence on what stood out helps. If your experience wasn't 5 stars, I want to hear that too — just hit reply and let me know what we missed.

Either way, thank you for trusting us with your project.

Sean Richard
Autom8ion Lab`;

const HOT_LEAD_AI_SCORING_PROMPT = `You are a B2B lead qualification expert for Autom8ion Lab, which sells custom AI agents, workflow automation, and intelligent business process systems for service businesses.

Our ideal customer:
- Industry: [LIST INDUSTRIES]
- Company size: [SIZE RANGE]
- Role: Owner, founder, COO, or marketing/ops director
- Budget: $[MIN] - $[MAX] for our services
- Timeline: Looking to buy within 90 days

Score this lead from 0-100 based on the form data below. Use this rubric:
- 70-100: Strong fit, sales-ready (matches industry, size, role, has budget, near-term timeline)
- 40-69: Partial fit (matches some criteria, may need nurture)
- 0-39: Poor fit (wrong industry, no budget, or no timeline)

Lead data:
- Name: {{contact.first_name}} {{contact.last_name}}
- Email: {{contact.email}}
- Company: {{contact.company_name}}
- Role: {{contact.job_title}}
- Form responses: {{form.responses}}

Return ONLY the numeric score (e.g. "78"). No explanation.`;

const HOT_LEAD_FAST_AI_PROMPT = `You are Sean Richard, the founder/lead at Autom8ion Lab (we engineer custom AI agents, workflow automation, and intelligent business process systems for service businesses).

A high-intent lead just submitted our form. Write a short, conversational email (5-7 sentences max) that:
1. Acknowledges their specific submission by referencing what they wrote (use the form data below)
2. Demonstrates you actually read it — call back to one specific detail
3. Offers two clear next steps:
   a) Book time on the calendar: https://os.autom8ionlab.com/book/capability-briefing
   b) Reply directly with questions
4. Mentions you'll also try them by phone shortly (so they're expecting a call)

Tone: Direct, warm, human. No corporate fluff. No "I hope this email finds you well." Sound like a real person who just read their form and is excited to help.

Lead info:
- Name: {{contact.first_name}}
- Company: {{contact.company_name}}
- Form responses: {{form.responses}}

Output only the email body — no subject line, no signature.`;

// ---------------------------------------------------------------------------
// Workflow definitions (10)
// ---------------------------------------------------------------------------

const WORKFLOWS = {};

// 1. New Lead Welcome Sequence
WORKFLOWS['New Lead Welcome Sequence'] = buildDefinition(
  [
    trigger('contact_created'),
    delay(2, 'minutes'),
    action('send_email', {
      subject: 'Welcome to Autom8ion Lab, {{contact.first_name}} 👋',
      preview_text: 'Glad to have you here — quick note from the team',
      body: WELCOME_EMAIL_BODY,
    }),
    action('update_custom_field', { fieldKey: 'lead_status', value: 'Welcomed' }),
    action('add_tag', { tagId: '', tagName: 'welcomed' }),
    action('add_tag', { tagId: '', tagName: 'new-lead' }),
    delay(1, 'days'),
    {
      branch: condition('Has the contact replied?', [
        { field: 'tags', operator: 'includes', value: 'engaged' },
      ]),
      yes: [
        action('add_tag', { tagId: '', tagName: 'engaged' }),
        endNode('Engaged — End'),
      ],
      no: [
        action('send_sms', {
          body: "Hey {{contact.first_name}}, it's Sean Richard from Autom8ion Lab. Just making sure my welcome email landed — sometimes they get filtered. Any questions I can answer? Reply STOP to opt out.",
        }),
        action('add_tag', { tagId: '', tagName: 'welcome-sequence-complete' }),
        endNode(),
      ],
    },
  ],
  { stopOnResponse: true }
);

// 2. Lead Qualification Workflow
WORKFLOWS['Lead Qualification Workflow'] = buildDefinition([
  trigger('form_submitted'),
  action('ai_prompt', {
    promptTemplate: HOT_LEAD_AI_SCORING_PROMPT,
    outputField: 'lead_score',
  }),
  delay(30, 'minutes'),
  {
    branch: condition('Lead score ≥ 70 (HOT)?', [
      { field: 'lead_score', operator: 'greater_than_or_equal', value: 70 },
    ]),
    yes: [
      action('add_tag', { tagId: '', tagName: 'hot-lead' }),
      action('add_tag', { tagId: '', tagName: 'sales-ready' }),
      action('update_custom_field', { fieldKey: 'lifecycle_stage', value: 'MQL' }),
      action('assign_contact_owner', { strategy: 'round_robin' }),
      action('send_internal_notification', {
        title: '🔥 HOT LEAD — Score: {{contact.lead_score}}',
        body: '{{contact.first_name}} {{contact.last_name}} ({{contact.company_name}}) — {{contact.phone}} | {{contact.email}}\nCall within 5 minutes for best conversion rate.',
      }),
      action('create_task', {
        title: 'Call hot lead {{contact.first_name}} {{contact.last_name}} within 5 minutes',
        priority: 'high',
        due_in_minutes: 5,
      }),
      action('send_email', {
        subject: "{{contact.first_name}}, let's get you on the calendar",
        body: HOT_LEAD_EMAIL_BODY,
      }),
      endNode('Hot — End'),
    ],
    no: [
      {
        branch: condition('Lead score ≥ 40 (WARM)?', [
          { field: 'lead_score', operator: 'greater_than_or_equal', value: 40 },
        ]),
        yes: [
          action('add_tag', { tagId: '', tagName: 'warm-lead' }),
          action('add_tag', { tagId: '', tagName: 'nurture' }),
          action('update_custom_field', { fieldKey: 'lifecycle_stage', value: 'Lead' }),
          action('send_email', {
            subject: 'Quick resource based on what you shared, {{contact.first_name}}',
            body: WARM_LEAD_EMAIL_BODY,
          }),
          endNode('Warm — End'),
        ],
        no: [
          action('add_tag', { tagId: '', tagName: 'cold-lead' }),
          action('add_tag', { tagId: '', tagName: 'low-priority' }),
          action('update_custom_field', { fieldKey: 'lifecycle_stage', value: 'Subscriber' }),
          action('send_email', {
            subject: 'Thanks for reaching out, {{contact.first_name}}',
            body: COLD_LEAD_EMAIL_BODY,
          }),
          endNode('Cold — End'),
        ],
      },
    ],
  },
]);

// 3. Follow-Up After No Response
WORKFLOWS['Follow-Up After No Response'] = buildDefinition(
  [
    trigger('contact_tag_changed', { triggerConfig: { tagName: 'awaiting-response' } }),
    delay(3, 'days'),
    {
      branch: condition('Replied?', [{ field: 'tags', operator: 'includes', value: 'engaged' }]),
      yes: [action('add_tag', { tagId: '', tagName: 'engaged' }), endNode()],
      no: [
        action('send_email', {
          subject: 'Following up, {{contact.first_name}}',
          body: FOLLOWUP1_EMAIL,
        }),
        delay(2, 'days'),
        {
          branch: condition('Replied?', [{ field: 'tags', operator: 'includes', value: 'engaged' }]),
          yes: [action('add_tag', { tagId: '', tagName: 'engaged' }), endNode()],
          no: [
            action('send_sms', {
              body: 'Hey {{contact.first_name}}, Sean Richard here — just checking if my last email landed. Easier to text than email? Happy to chat that way too. Reply STOP to opt out.',
            }),
            delay(3, 'days'),
            {
              branch: condition('Replied?', [{ field: 'tags', operator: 'includes', value: 'engaged' }]),
              yes: [action('add_tag', { tagId: '', tagName: 'engaged' }), endNode()],
              no: [
                action('send_email', {
                  subject: 'Should I close your file, {{contact.first_name}}?',
                  body: BREAKUP_EMAIL,
                }),
                action('add_tag', { tagId: '', tagName: 'no-response' }),
                action('add_tag', { tagId: '', tagName: 'cold' }),
                action('update_custom_field', { fieldKey: 'lead_status', value: 'Unresponsive' }),
                action('remove_tag', { tagId: '', tagName: 'awaiting-response' }),
                endNode(),
              ],
            },
          ],
        },
      ],
    },
  ],
  { stopOnResponse: true }
);

// 4. Appointment Reminder Sequence
WORKFLOWS['Appointment Reminder Sequence'] = buildDefinition([
  trigger('appointment_booked'),
  action('send_email', {
    subject: 'Confirmed: {{appointment.title}} on {{appointment.start_date}}',
    body: BOOKING_CONFIRM_EMAIL,
  }),
  delay(1, 'days'),
  {
    branch: condition('Appointment still active?', [
      { field: 'appointment.status', operator: 'not_equals', value: 'canceled' },
    ]),
    yes: [
      action('send_sms', {
        body: 'Hi {{contact.first_name}} — quick reminder you\'re scheduled with Autom8ion Lab tomorrow at {{appointment.start_time}}. Reply C to confirm or R to reschedule. Looking forward to it!',
      }),
      delay(23, 'hours'),
      {
        branch: condition('Still active?', [
          { field: 'appointment.status', operator: 'not_equals', value: 'canceled' },
        ]),
        yes: [
          action('send_sms', {
            body: '{{contact.first_name}}, your call with Sean Richard is in 1 hour ({{appointment.start_time}}). Join link: {{appointment.meeting_url}} — see you soon!',
          }),
          action('add_tag', { tagId: '', tagName: 'appointment-reminded' }),
          endNode(),
        ],
        no: [endNode('Canceled — End')],
      },
    ],
    no: [endNode('Canceled — End')],
  },
]);

// 5. Post-Meeting Follow-Up
WORKFLOWS['Post-Meeting Follow-Up'] = buildDefinition(
  [
    trigger('appointment_status_changed', {
      triggerConfig: { newStatus: 'showed' },
    }),
    action('ai_prompt', {
      promptTemplate: POST_MEETING_AI_PROMPT,
      outputField: 'ai_followup_body',
    }),
    delay(1, 'hours'),
    action('send_email', {
      subject: 'Recap & next steps from our call, {{contact.first_name}}',
      body: '{{ai_followup_body}}\n\nIf anything in this recap is off or incomplete, just hit reply — happy to adjust.\n\nSean Richard\nFounder, Autom8ion Lab',
    }),
    action('create_task', {
      title: 'Follow up with {{contact.first_name}} re: {{appointment.title}}',
      due_in_days: 3,
    }),
    action('add_tag', { tagId: '', tagName: 'met-with-sales' }),
    action('update_custom_field', { fieldKey: 'last_meeting_date', value: '{{date.today}}' }),
    delay(3, 'days'),
    {
      branch: condition('Replied since meeting?', [
        { field: 'tags', operator: 'includes', value: 'engaged-post-meeting' },
      ]),
      yes: [action('add_tag', { tagId: '', tagName: 'engaged-post-meeting' }), endNode()],
      no: [
        action('send_sms', {
          body: 'Hey {{contact.first_name}}, Sean Richard here. Just circling back on our call from earlier this week — any questions on what we discussed? Happy to jump on a quick call if helpful.',
        }),
        delay(4, 'days'),
        {
          branch: condition('Replied?', [
            { field: 'tags', operator: 'includes', value: 'engaged-post-meeting' },
          ]),
          yes: [action('add_tag', { tagId: '', tagName: 'engaged-post-meeting' }), endNode()],
          no: [
            action('send_email', {
              subject: 'Should we keep this on the calendar, {{contact.first_name}}?',
              body: POST_MEETING_BREAKUP_EMAIL,
            }),
            action('add_tag', { tagId: '', tagName: 'post-meeting-no-response' }),
            endNode(),
          ],
        },
      ],
    },
  ],
  { stopOnResponse: true }
);

// 6. Proposal Sent Nurture
WORKFLOWS['Proposal Sent Nurture'] = buildDefinition([
  trigger('contact_tag_changed', { triggerConfig: { tagName: 'proposal-sent' } }),
  action('send_email', {
    subject: 'Your proposal from Autom8ion Lab, {{contact.first_name}}',
    body: PROPOSAL_CONFIRM_EMAIL,
  }),
  action('add_tag', { tagId: '', tagName: 'pending' }),
  action('add_tag', { tagId: '', tagName: 'proposal-active' }),
  action('update_custom_field', { fieldKey: 'lifecycle_stage', value: 'Proposal Sent' }),
  delay(3, 'days'),
  {
    branch: condition('Proposal signed/paid or replied?', [
      { field: 'tags', operator: 'includes', value: 'proposal-engaged' },
    ]),
    yes: [action('add_tag', { tagId: '', tagName: 'proposal-engaged' }), endNode()],
    no: [
      action('send_email', {
        subject: 'Quick check-in on the proposal, {{contact.first_name}}',
        body: PROPOSAL_FOLLOWUP_EMAIL,
      }),
      action('add_tag', { tagId: '', tagName: 'proposal-followup-sent' }),
      endNode(),
    ],
  },
]);

// 7. Deal Won Onboarding
WORKFLOWS['Deal Won Onboarding'] = buildDefinition([
  trigger('payment_received'),
  action('remove_tag', { tagId: '', tagName: 'prospect' }),
  action('remove_tag', { tagId: '', tagName: 'lead' }),
  action('remove_tag', { tagId: '', tagName: 'proposal-active' }),
  action('remove_tag', { tagId: '', tagName: 'pending' }),
  action('remove_tag', { tagId: '', tagName: 'hot-lead' }),
  action('remove_tag', { tagId: '', tagName: 'warm-lead' }),
  action('add_tag', { tagId: '', tagName: 'customer' }),
  action('add_tag', { tagId: '', tagName: 'active-client' }),
  action('add_tag', { tagId: '', tagName: 'onboarding' }),
  action('update_custom_field', { fieldKey: 'lifecycle_stage', value: 'Customer' }),
  action('update_custom_field', { fieldKey: 'customer_since', value: '{{date.today}}' }),
  action('update_custom_field', { fieldKey: 'lead_status', value: 'Won' }),
  action('send_email', {
    subject: "🎉 Welcome aboard, {{contact.first_name}} — let's get you started",
    body: ONBOARDING_EMAIL,
  }),
  action('create_task', {
    title: 'Kickoff call with {{contact.first_name}} {{contact.last_name}} — schedule within 48 hours',
    due_in_days: 2,
  }),
  action('send_internal_notification', {
    title: '🎉 NEW CLIENT WON',
    body: '{{contact.first_name}} {{contact.last_name}} — {{contact.company_name}}\nDeal value: {{opportunity.monetary_value}}\nOwner: {{user.name}}\nNext step: Kickoff call (task created — due 48 hours)',
  }),
  delay(1, 'days'),
  action('send_email', {
    subject: "Let's get your kickoff on the calendar, {{contact.first_name}}",
    body: KICKOFF_PREP_EMAIL,
  }),
  endNode(),
]);

// 8. Deal Lost Re-engagement
WORKFLOWS['Deal Lost Re-engagement'] = buildDefinition([
  trigger('invoice_overdue'),
  delay(30, 'days'),
  {
    branch: condition('Already a customer?', [
      { field: 'tags', operator: 'includes', value: 'customer' },
    ]),
    yes: [endNode('Already a customer — End')],
    no: [
      action('send_email', {
        subject: 'Has anything changed on your end, {{contact.first_name}}?',
        body: REENGAGE_EMAIL,
      }),
      action('add_tag', { tagId: '', tagName: 'win-back-attempt' }),
      action('add_tag', { tagId: '', tagName: 're-engaged-30d' }),
      action('update_custom_field', { fieldKey: 'last_engagement_date', value: '{{date.today}}' }),
      delay(7, 'days'),
      {
        branch: condition('Replied or clicked?', [
          { field: 'tags', operator: 'includes', value: 're-engaged-active' },
        ]),
        yes: [
          action('add_tag', { tagId: '', tagName: 're-engaged-active' }),
          action('notify_user', {
            userId: '{{contact.owner_id}}',
            title: 'Win-back lead {{contact.first_name}} re-engaged',
            body: 'Reach out — they replied to the win-back email.',
          }),
          endNode(),
        ],
        no: [
          action('add_tag', { tagId: '', tagName: 're-engagement-no-response' }),
          endNode(),
        ],
      },
    ],
  },
]);

// 9. Review Request After Service
WORKFLOWS['Review Request After Service'] = buildDefinition(
  [
    trigger('appointment_status_changed', { triggerConfig: { newStatus: 'completed' } }),
    delay(1, 'days'),
    action('send_email', {
      subject: 'A quick favor, {{contact.first_name}}?',
      body: REVIEW_EMAIL,
    }),
    action('add_tag', { tagId: '', tagName: 'review-requested' }),
    action('update_custom_field', {
      fieldKey: 'review_request_sent_date',
      value: '{{date.today}}',
    }),
    delay(3, 'days'),
    {
      branch: condition('Review submitted?', [
        { field: 'tags', operator: 'includes', value: 'review-submitted' },
      ]),
      yes: [action('add_tag', { tagId: '', tagName: 'review-engaged' }), endNode()],
      no: [
        action('send_sms', {
          body: 'Hey {{contact.first_name}}, Sean Richard here — would you mind leaving us a quick review? Takes 60 seconds and means a lot. 🙏 [REVIEW LINK]',
        }),
        action('add_tag', { tagId: '', tagName: 'review-reminded' }),
        delay(4, 'days'),
        {
          branch: condition('Review submitted?', [
            { field: 'tags', operator: 'includes', value: 'review-submitted' },
          ]),
          yes: [action('add_tag', { tagId: '', tagName: 'review-engaged' }), endNode()],
          no: [action('add_tag', { tagId: '', tagName: 'no-review' }), endNode()],
        },
      ],
    },
  ],
  { stopOnResponse: true }
);

// 10. Hot Lead Fast Response
WORKFLOWS['Hot Lead Fast Response'] = buildDefinition([
  trigger('form_submitted', { triggerConfig: { highIntent: true } }),
  action('assign_contact_owner', { strategy: 'round_robin' }),
  action('send_internal_notification', {
    title: '🔥 HOT LEAD — RESPOND NOW',
    body: '{{contact.first_name}} {{contact.last_name}} from {{contact.company_name}}\n{{contact.phone}} | {{contact.email}}\nSource: {{form.name}}\nGoal: First call within 5 minutes',
    channels: ['sms', 'slack'],
  }),
  action('ai_prompt', {
    promptTemplate: HOT_LEAD_FAST_AI_PROMPT,
    outputField: 'ai_first_touch',
  }),
  delay(30, 'minutes'),
  action('send_email', {
    subject: "Got your message, {{contact.first_name}} — let's talk",
    body: '{{ai_first_touch}}\n\nTalk soon,\nSean Richard\nFounder, Autom8ion Lab\n698-310-2712 | https://os.autom8ionlab.com/book/capability-briefing',
  }),
  action('create_task', {
    title: 'Call hot lead {{contact.first_name}} {{contact.last_name}} within 5 minutes — {{contact.phone}}',
    priority: 'high',
    due_in_minutes: 5,
  }),
  action('add_tag', { tagId: '', tagName: 'hot-lead' }),
  action('add_tag', { tagId: '', tagName: 'fast-response-sent' }),
  action('update_custom_field', { fieldKey: 'lifecycle_stage', value: 'MQL' }),
  action('update_custom_field', { fieldKey: 'lead_source_detail', value: '{{form.name}}' }),
  action('update_custom_field', { fieldKey: 'first_touch_sent', value: '{{date.now}}' }),
  delay(15, 'minutes'),
  {
    branch: condition('Rep called or contact replied?', [
      { field: 'tags', operator: 'includes', value: 'fast-response-engaged' },
    ]),
    yes: [action('add_tag', { tagId: '', tagName: 'fast-response-engaged' }), endNode()],
    no: [
      action('send_internal_notification', {
        title: '⏰ Hot lead reminder',
        body: 'Hot lead {{contact.first_name}} {{contact.last_name}} ({{contact.phone}}) — not called yet. Form was 15 min ago. Speed-to-lead matters.',
      }),
      delay(30, 'minutes'),
      {
        branch: condition('Still no contact made?', [
          { field: 'tags', operator: 'includes', value: 'fast-response-engaged' },
        ]),
        yes: [endNode('Engaged — End')],
        no: [
          action('send_internal_notification', {
            title: '⚠ ESCALATION — Hot lead untouched for 45 min',
            body: 'Lead: {{contact.first_name}} {{contact.last_name}} ({{contact.company_name}})\nOwner: {{user.name}}\nSource: {{form.name}}\nPlease reassign or follow up directly.',
            escalate: true,
          }),
          endNode('Escalated — End'),
        ],
      },
    ],
  },
]);

// ---------------------------------------------------------------------------
// Emit SQL — UPDATE each system template's latest version_snapshot in place
// ---------------------------------------------------------------------------

const sqlLines = [
  '-- # Workflow templates v2 — Autom8tion Lab Workflow Library',
  '-- Replaces the placeholder seeded copy with production-ready content',
  '-- pulled from the workflow-library PDF. Updates the latest version_snapshot',
  "-- of each is_system='true' template in place, so future instantiations",
  '-- pick up the new content. Existing instantiated workflows in customer orgs',
  '-- carry their own copy of the older snapshot and are unaffected.',
  '',
];

for (const [name, def] of Object.entries(WORKFLOWS)) {
  const json = JSON.stringify(def).replace(/'/g, "''");
  sqlLines.push(`-- Template: ${name}`);
  sqlLines.push(`UPDATE automation_template_versions SET definition_snapshot = '${json}'::jsonb`);
  sqlLines.push(`  WHERE template_id IN (SELECT id FROM automation_templates WHERE name = '${name.replace(/'/g, "''")}' AND is_system = true)`);
  sqlLines.push(`  AND version_number = (SELECT MAX(version_number) FROM automation_template_versions WHERE template_id IN (SELECT id FROM automation_templates WHERE name = '${name.replace(/'/g, "''")}' AND is_system = true));`);
  sqlLines.push('');
}

sqlLines.push("UPDATE automation_templates SET updated_at = now() WHERE is_system = true;");

process.stdout.write(sqlLines.join('\n'));
