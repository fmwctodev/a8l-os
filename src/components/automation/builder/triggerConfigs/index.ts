import type { ComponentType } from 'react';
import type { TriggerNodeData } from '../../../../types';

export interface TriggerConfigProps {
  data: TriggerNodeData;
  onUpdate: (updates: Partial<TriggerNodeData>) => void;
}

import ContactChangedConfig from './ContactChangedConfig';
import ContactCreatedConfig from './ContactCreatedConfig';
import ContactDndConfig from './ContactDndConfig';
import ContactTagConfig from './ContactTagConfig';
import CustomDateReminderConfig from './CustomDateReminderConfig';
import NoteConfig from './NoteConfig';
import TaskConfig from './TaskConfig';
import EngagementScoreConfig from './EngagementScoreConfig';
import SchedulerConfig from './SchedulerConfig';
import CallDetailsConfig from './CallDetailsConfig';
import EmailEventsConfig from './EmailEventsConfig';
import CustomerRepliedConfig from './CustomerRepliedConfig';
import ConversationAIConfig from './ConversationAIConfig';
import CustomTriggerConfig from './CustomTriggerConfig';
import FormSubmittedConfig from './FormSubmittedConfig';
import SurveySubmittedConfig from './SurveySubmittedConfig';
import ReviewReceivedConfig from './ReviewReceivedConfig';
import ProspectGeneratedConfig from './ProspectGeneratedConfig';
import AppointmentStatusConfig from './AppointmentStatusConfig';
import CustomerBookedConfig from './CustomerBookedConfig';
import OpportunityStatusChangedConfig from './OpportunityStatusChangedConfig';
import OpportunityChangedConfig from './OpportunityChangedConfig';
import OpportunityStageChangedConfig from './OpportunityStageChangedConfig';
import OpportunityCreatedConfig from './OpportunityCreatedConfig';
import OpportunityStaleConfig from './OpportunityStaleConfig';

type ConfigEntry = {
  component: ComponentType<TriggerConfigProps>;
  props?: Record<string, unknown>;
};

export const TRIGGER_CONFIG_MAP: Record<string, ConfigEntry> = {
  contact_changed: { component: ContactChangedConfig },
  contact_created: { component: ContactCreatedConfig },
  contact_dnd_changed: { component: ContactDndConfig },
  contact_tag_changed: { component: ContactTagConfig },
  contact_custom_date_reminder: { component: CustomDateReminderConfig },
  contact_note_added: { component: NoteConfig, props: { isChanged: false } },
  contact_note_changed: { component: NoteConfig, props: { isChanged: true } },
  contact_task_added: { component: TaskConfig, props: { mode: 'added' } },
  contact_task_reminder: { component: TaskConfig, props: { mode: 'reminder' } },
  contact_task_completed: { component: TaskConfig, props: { mode: 'completed' } },
  contact_engagement_score: { component: EngagementScoreConfig },
  event_scheduler: { component: SchedulerConfig },
  event_call_details: { component: CallDetailsConfig },
  event_email: { component: EmailEventsConfig },
  event_customer_replied: { component: CustomerRepliedConfig },
  event_conversation_ai: { component: ConversationAIConfig },
  event_custom: { component: CustomTriggerConfig },
  event_form_submitted: { component: FormSubmittedConfig },
  event_survey_submitted: { component: SurveySubmittedConfig },
  event_review_received: { component: ReviewReceivedConfig },
  event_prospect_generated: { component: ProspectGeneratedConfig },
  appointment_status_changed: { component: AppointmentStatusConfig },
  appointment_customer_booked: { component: CustomerBookedConfig },
  opportunity_status_changed: { component: OpportunityStatusChangedConfig },
  opportunity_created: { component: OpportunityCreatedConfig },
  opportunity_changed: { component: OpportunityChangedConfig },
  opportunity_stage_changed: { component: OpportunityStageChangedConfig },
  opportunity_stale: { component: OpportunityStaleConfig },
};
