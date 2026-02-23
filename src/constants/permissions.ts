export const Permissions = {
  AI_AGENTS: {
    VIEW: 'ai_agents.view',
    MANAGE: 'ai_agents.manage',
    RUN: 'ai_agents.run',
    MEMORY_RESET: 'ai_agents.memory.reset',
  },

  AI_SETTINGS: {
    VIEW: 'ai.settings.view',
    MANAGE: 'ai.settings.manage',
    KNOWLEDGE_MANAGE: 'ai.knowledge.manage',
    MODELS_MANAGE: 'ai.models.manage',
    PROMPTS_MANAGE: 'ai.prompts.manage',
    VOICES_MANAGE: 'ai.voices.manage',
  },

  APPOINTMENTS: {
    VIEW: 'appointments.view',
    CREATE: 'appointments.create',
    EDIT: 'appointments.edit',
    CANCEL: 'appointments.cancel',
  },

  APPOINTMENT_TYPES: {
    MANAGE_ALL: 'appointment_types.manage_all',
    MANAGE_DEPARTMENT: 'appointment_types.manage_department',
    MANAGE_OWN: 'appointment_types.manage_own',
  },

  AUDIT: {
    VIEW: 'audit.view',
    VIEW_LOGS: 'audit_logs.view',
  },

  AUTOMATION: {
    VIEW: 'automation.view',
    MANAGE: 'automation.manage',
  },

  AVAILABILITY: {
    MANAGE_OWN: 'availability.manage_own',
    MANAGE_DEPARTMENT: 'availability.manage_department',
  },

  BRANDBOARD: {
    VIEW: 'brandboard.view',
    MANAGE: 'brandboard.manage',
    PUBLISH: 'brandboard.publish',
    ACTIVATE: 'brandboard.activate',
  },

  CALENDARS: {
    VIEW: 'calendars.view',
    MANAGE: 'calendars.manage',
    MANAGE_ALL: 'calendars.manage_all',
    MANAGE_DEPARTMENT: 'calendars.manage_department',
    MANAGE_OWN: 'calendars.manage_own',
  },

  CHANNELS: {
    CONFIGURE: 'channels.configure',
  },

  CONTACTS: {
    VIEW: 'contacts.view',
    CREATE: 'contacts.create',
    EDIT: 'contacts.edit',
    DELETE: 'contacts.delete',
    BULK_DELETE: 'contacts.bulk_delete',
    IMPORT: 'contacts.import',
    EXPORT: 'contacts.export',
    MERGE: 'contacts.merge',
  },

  CONVERSATIONS: {
    VIEW: 'conversations.view',
    MANAGE: 'conversations.manage',
    SEND: 'conversations.send',
    ASSIGN: 'conversations.assign',
    CLOSE: 'conversations.close',
    TEMPLATES: 'conversations.templates',
  },

  CONVERSATION_RULES: {
    VIEW: 'conversation_rules.view',
    MANAGE: 'conversation_rules.manage',
  },

  CUSTOM_FIELDS: {
    VIEW: 'custom_fields.view',
    MANAGE: 'custom_fields.manage',
    GROUPS_MANAGE: 'custom_fields.groups.manage',
  },

  CUSTOM_VALUES: {
    VIEW: 'custom_values.view',
    CREATE: 'custom_values.create',
    EDIT: 'custom_values.edit',
    DELETE: 'custom_values.delete',
    CATEGORIES: 'custom_values.categories',
  },

  DEPARTMENTS: {
    MANAGE: 'departments.manage',
  },

  EMAIL: {
    SETTINGS_VIEW: 'email.settings.view',
    SETTINGS_MANAGE: 'email.settings.manage',
    SEND_TEST: 'email.send.test',
    CAMPAIGN_DOMAINS_VIEW: 'email.campaign_domains.view',
    CAMPAIGN_DOMAINS_MANAGE: 'email.campaign_domains.manage',
  },

  GOOGLE_CONNECTIONS: {
    VIEW: 'google_connections.view',
    MANAGE_OWN: 'google_connections.manage_own',
  },

  INTEGRATIONS: {
    VIEW: 'integrations.view',
    MANAGE: 'integrations.manage',
    MANAGE_USER: 'integrations.manage_user',
    LOGS_VIEW: 'integrations.logs.view',
    WEBHOOKS_MANAGE: 'integrations.webhooks.manage',
  },

  INVOICES: {
    CREATE: 'invoices.create',
    SEND: 'invoices.send',
    VOID: 'invoices.void',
  },

  MARKETING: {
    VIEW: 'marketing.view',
    MANAGE: 'marketing.manage',
    FORMS_VIEW: 'marketing.forms.view',
    FORMS_MANAGE: 'marketing.forms.manage',
    FORMS_PUBLISH: 'marketing.forms.publish',
    SURVEYS_VIEW: 'marketing.surveys.view',
    SURVEYS_MANAGE: 'marketing.surveys.manage',
    SURVEYS_PUBLISH: 'marketing.surveys.publish',
    SOCIAL_VIEW: 'marketing.social.view',
    SOCIAL_MANAGE: 'marketing.social.manage',
    SOCIAL_CONNECT: 'marketing.social.connect',
    SOCIAL_PUBLISH: 'marketing.social.publish',
    SOCIAL_APPROVE: 'marketing.social.approve',
  },

  MEDIA: {
    VIEW: 'media.view',
    MANAGE: 'media.manage',
  },

  MEETINGS: {
    VIEW: 'meetings.view',
    EDIT: 'meetings.edit',
    DELETE: 'meetings.delete',
    IMPORT: 'meetings.import',
  },

  OPPORTUNITIES: {
    VIEW: 'opportunities.view',
    CREATE: 'opportunities.create',
    EDIT: 'opportunities.edit',
    DELETE: 'opportunities.delete',
    MANAGE: 'opportunities.manage',
    MOVE_STAGE: 'opportunities.move_stage',
    CLOSE: 'opportunities.close',
  },

  PAYMENTS: {
    VIEW: 'payments.view',
    MANAGE: 'payments.manage',
  },

  PHONE: {
    SETTINGS_VIEW: 'phone.settings.view',
    SETTINGS_MANAGE: 'phone.settings.manage',
    NUMBERS_MANAGE: 'phone.numbers.manage',
    ROUTING_MANAGE: 'phone.routing.manage',
    COMPLIANCE_MANAGE: 'phone.compliance.manage',
    TEST_RUN: 'phone.test.run',
  },

  PIPELINES: {
    MANAGE: 'pipelines.manage',
  },

  PRODUCTS: {
    MANAGE: 'products.manage',
  },

  PROPOSALS: {
    VIEW: 'proposals.view',
    CREATE: 'proposals.create',
    EDIT: 'proposals.edit',
    DELETE: 'proposals.delete',
    SEND: 'proposals.send',
    AI_GENERATE: 'proposals.ai_generate',
  },

  PROPOSAL_TEMPLATES: {
    MANAGE: 'proposal_templates.manage',
  },

  REPORTING: {
    VIEW: 'reporting.view',
    MANAGE: 'reporting.manage',
    EXPORT: 'reporting.export',
    SCHEDULE: 'reporting.schedule',
    AI_QUERY: 'reporting.ai.query',
  },

  REPUTATION: {
    VIEW: 'reputation.view',
    MANAGE: 'reputation.manage',
    REQUEST: 'reputation.request',
    PROVIDERS_MANAGE: 'reputation.providers.manage',
  },

  SCORING: {
    VIEW: 'scoring.view',
    MANAGE: 'scoring.manage',
    ADJUST: 'scoring.adjust',
  },

  SECRETS: {
    VIEW: 'secrets.view',
    CREATE: 'secrets.create',
    EDIT: 'secrets.edit',
    DELETE: 'secrets.delete',
    REVEAL: 'secrets.reveal',
    CATEGORIES: 'secrets.categories',
    DYNAMIC_REFS: 'secrets.dynamic_refs',
    LOGS: 'secrets.logs',
  },

  SETTINGS: {
    VIEW: 'settings.view',
    MANAGE: 'settings.manage',
  },

  SNIPPETS: {
    VIEW: 'snippets.view',
    CREATE: 'snippets.create',
    MANAGE: 'snippets.manage',
    SYSTEM_MANAGE: 'snippets.system.manage',
  },

  STAFF: {
    VIEW: 'staff.view',
    INVITE: 'staff.invite',
    MANAGE: 'staff.manage',
    DISABLE: 'staff.disable',
    RESET_PASSWORD: 'staff.reset_password',
  },

  USERS: {
    VIEW: 'users.view',
    INVITE: 'users.invite',
    MANAGE: 'users.manage',
  },

  PERSONAL_ASSISTANT: {
    VIEW: 'personal_assistant.view',
    MANAGE: 'personal_assistant.manage',
    RUN: 'personal_assistant.run',
    CONFIGURE: 'personal_assistant.configure',
  },
} as const;

export type PermissionKey =
  | typeof Permissions.AI_AGENTS[keyof typeof Permissions.AI_AGENTS]
  | typeof Permissions.AI_SETTINGS[keyof typeof Permissions.AI_SETTINGS]
  | typeof Permissions.APPOINTMENTS[keyof typeof Permissions.APPOINTMENTS]
  | typeof Permissions.APPOINTMENT_TYPES[keyof typeof Permissions.APPOINTMENT_TYPES]
  | typeof Permissions.AUDIT[keyof typeof Permissions.AUDIT]
  | typeof Permissions.AUTOMATION[keyof typeof Permissions.AUTOMATION]
  | typeof Permissions.AVAILABILITY[keyof typeof Permissions.AVAILABILITY]
  | typeof Permissions.BRANDBOARD[keyof typeof Permissions.BRANDBOARD]
  | typeof Permissions.CALENDARS[keyof typeof Permissions.CALENDARS]
  | typeof Permissions.CHANNELS[keyof typeof Permissions.CHANNELS]
  | typeof Permissions.CONTACTS[keyof typeof Permissions.CONTACTS]
  | typeof Permissions.CONVERSATIONS[keyof typeof Permissions.CONVERSATIONS]
  | typeof Permissions.CONVERSATION_RULES[keyof typeof Permissions.CONVERSATION_RULES]
  | typeof Permissions.CUSTOM_FIELDS[keyof typeof Permissions.CUSTOM_FIELDS]
  | typeof Permissions.CUSTOM_VALUES[keyof typeof Permissions.CUSTOM_VALUES]
  | typeof Permissions.DEPARTMENTS[keyof typeof Permissions.DEPARTMENTS]
  | typeof Permissions.EMAIL[keyof typeof Permissions.EMAIL]
  | typeof Permissions.GOOGLE_CONNECTIONS[keyof typeof Permissions.GOOGLE_CONNECTIONS]
  | typeof Permissions.INTEGRATIONS[keyof typeof Permissions.INTEGRATIONS]
  | typeof Permissions.INVOICES[keyof typeof Permissions.INVOICES]
  | typeof Permissions.MARKETING[keyof typeof Permissions.MARKETING]
  | typeof Permissions.MEDIA[keyof typeof Permissions.MEDIA]
  | typeof Permissions.MEETINGS[keyof typeof Permissions.MEETINGS]
  | typeof Permissions.OPPORTUNITIES[keyof typeof Permissions.OPPORTUNITIES]
  | typeof Permissions.PAYMENTS[keyof typeof Permissions.PAYMENTS]
  | typeof Permissions.PHONE[keyof typeof Permissions.PHONE]
  | typeof Permissions.PIPELINES[keyof typeof Permissions.PIPELINES]
  | typeof Permissions.PRODUCTS[keyof typeof Permissions.PRODUCTS]
  | typeof Permissions.PROPOSALS[keyof typeof Permissions.PROPOSALS]
  | typeof Permissions.PROPOSAL_TEMPLATES[keyof typeof Permissions.PROPOSAL_TEMPLATES]
  | typeof Permissions.REPORTING[keyof typeof Permissions.REPORTING]
  | typeof Permissions.REPUTATION[keyof typeof Permissions.REPUTATION]
  | typeof Permissions.SCORING[keyof typeof Permissions.SCORING]
  | typeof Permissions.SECRETS[keyof typeof Permissions.SECRETS]
  | typeof Permissions.SETTINGS[keyof typeof Permissions.SETTINGS]
  | typeof Permissions.SNIPPETS[keyof typeof Permissions.SNIPPETS]
  | typeof Permissions.STAFF[keyof typeof Permissions.STAFF]
  | typeof Permissions.USERS[keyof typeof Permissions.USERS]
  | typeof Permissions.PERSONAL_ASSISTANT[keyof typeof Permissions.PERSONAL_ASSISTANT];

export const ALL_PERMISSIONS: PermissionKey[] = Object.values(Permissions).flatMap(
  module => Object.values(module)
) as PermissionKey[];
