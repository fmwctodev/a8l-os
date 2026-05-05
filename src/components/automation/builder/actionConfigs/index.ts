import type { ComponentType } from 'react';
import type { ActionNodeData } from '../../../../types';

export interface ActionConfigProps {
  data: ActionNodeData;
  onUpdate: (updates: Partial<ActionNodeData>) => void;
}

import SendSmsConfig from './SendSmsConfig';
import CreateContactConfig from './CreateContactConfig';
import FindContactConfig from './FindContactConfig';
import CopyContactConfig from './CopyContactConfig';
import DeleteContactConfig from './DeleteContactConfig';
import ModifyEngagementScoreConfig from './ModifyEngagementScoreConfig';
import ModifyFollowersConfig from './ModifyFollowersConfig';
import AddNoteConfig from './AddNoteConfig';
import EditConversationConfig from './EditConversationConfig';
import SendSlackMessageConfig from './SendSlackMessageConfig';
import SendMessengerConfig from './SendMessengerConfig';
import SendGmbMessageConfig from './SendGmbMessageConfig';
import SendInternalNotificationConfig from './SendInternalNotificationConfig';
import ConversationAIReplyConfig from './ConversationAIReplyConfig';
import FacebookInteractiveConfig from './FacebookInteractiveConfig';
import InstagramInteractiveConfig from './InstagramInteractiveConfig';
import ReplyInCommentsConfig from './ReplyInCommentsConfig';
import SendLiveChatConfig from './SendLiveChatConfig';
import ManualActionConfig from './ManualActionConfig';
import SplitTestConfig from './SplitTestConfig';
import GoToConfig from './GoToConfig';
import RemoveFromWorkflowActionConfig from './RemoveFromWorkflowActionConfig';
import DripModeConfig from './DripModeConfig';
import UpdateCustomValueConfig from './UpdateCustomValueConfig';
import ArrayOperationConfig from './ArrayOperationConfig';
import TextFormatterConfig from './TextFormatterConfig';
import AIPromptConfig from './AIPromptConfig';
import UpdateAppointmentStatusConfig from './UpdateAppointmentStatusConfig';
import GenerateBookingLinkConfig from './GenerateBookingLinkConfig';
import CreateOrUpdateOpportunityConfig from './CreateOrUpdateOpportunityConfig';
import RemoveOpportunityConfig from './RemoveOpportunityConfig';
import SendDocumentsAndContractsConfig from './SendDocumentsAndContractsConfig';

type ConfigEntry = {
  component: ComponentType<ActionConfigProps>;
  props?: Record<string, unknown>;
};

export const ACTION_CONFIG_MAP: Record<string, ConfigEntry> = {
  send_sms: { component: SendSmsConfig },
  create_contact: { component: CreateContactConfig },
  find_contact: { component: FindContactConfig },
  copy_contact: { component: CopyContactConfig },
  delete_contact: { component: DeleteContactConfig },
  modify_engagement_score: { component: ModifyEngagementScoreConfig },
  modify_followers: { component: ModifyFollowersConfig },
  add_note: { component: AddNoteConfig },
  edit_conversation: { component: EditConversationConfig },
  send_slack_message: { component: SendSlackMessageConfig },
  send_messenger: { component: SendMessengerConfig },
  send_gmb_message: { component: SendGmbMessageConfig },
  send_internal_notification: { component: SendInternalNotificationConfig },
  conversation_ai_reply: { component: ConversationAIReplyConfig },
  facebook_interactive_messenger: { component: FacebookInteractiveConfig },
  instagram_interactive_messenger: { component: InstagramInteractiveConfig },
  reply_in_comments: { component: ReplyInCommentsConfig },
  send_live_chat_message: { component: SendLiveChatConfig },
  manual_action: { component: ManualActionConfig },
  split_test: { component: SplitTestConfig },
  go_to: { component: GoToConfig },
  remove_from_workflow_action: { component: RemoveFromWorkflowActionConfig },
  drip_mode: { component: DripModeConfig },
  update_custom_value: { component: UpdateCustomValueConfig },
  array_operation: { component: ArrayOperationConfig },
  text_formatter: { component: TextFormatterConfig },
  ai_prompt: { component: AIPromptConfig },
  update_appointment_status: { component: UpdateAppointmentStatusConfig },
  generate_booking_link: { component: GenerateBookingLinkConfig },
  create_or_update_opportunity: { component: CreateOrUpdateOpportunityConfig },
  remove_opportunity: { component: RemoveOpportunityConfig },
  send_documents_and_contracts: { component: SendDocumentsAndContractsConfig },
};
