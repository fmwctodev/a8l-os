import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import {
  Send, Users, CheckSquare, TrendingUp, Calendar, CreditCard,
  Megaphone, FileText, FolderKanban, Sparkles, Settings, AlertCircle,
  Mail, MessageSquare, Phone, Tag, UserPlus, Receipt, Star, Webhook, Bell,
} from 'lucide-react';
import type { BuilderNodeData } from '../../../../types/workflowBuilder';
import type { ActionNodeData } from '../../../../types';
import { ACTION_OPTIONS } from '../../../../types/workflowBuilder';

const CATEGORY_STYLES: Record<string, { bg: string; icon: string; IconComp: React.ElementType }> = {
  communication: { bg: 'bg-sky-500', icon: 'text-sky-600', IconComp: Send },
  contact_management: { bg: 'bg-violet-500', icon: 'text-violet-600', IconComp: Users },
  tasks: { bg: 'bg-orange-500', icon: 'text-orange-600', IconComp: CheckSquare },
  opportunities: { bg: 'bg-emerald-500', icon: 'text-emerald-600', IconComp: TrendingUp },
  appointments: { bg: 'bg-blue-500', icon: 'text-blue-600', IconComp: Calendar },
  payments: { bg: 'bg-green-500', icon: 'text-green-600', IconComp: CreditCard },
  marketing: { bg: 'bg-pink-500', icon: 'text-pink-600', IconComp: Megaphone },
  proposals: { bg: 'bg-amber-500', icon: 'text-amber-600', IconComp: FileText },
  projects: { bg: 'bg-teal-500', icon: 'text-teal-600', IconComp: FolderKanban },
  flow_control: { bg: 'bg-gray-500', icon: 'text-gray-600', IconComp: Settings },
  ai: { bg: 'bg-amber-500', icon: 'text-amber-600', IconComp: Sparkles },
  system: { bg: 'bg-slate-500', icon: 'text-slate-600', IconComp: Settings },
};

const ACTION_ICON_MAP: Record<string, React.ElementType> = {
  send_sms: MessageSquare,
  send_email: Mail,
  send_internal_sms: MessageSquare,
  send_internal_email: Mail,
  call_contact: Phone,
  add_tag: Tag,
  remove_tag: Tag,
  assign_contact_owner: UserPlus,
  create_invoice: Receipt,
  send_invoice: Receipt,
  send_review_request: Star,
  webhook: Webhook,
  notify_user: Bell,
};

type ActionNodeType = Node<BuilderNodeData, 'action'>;

function ActionNodeComponent({ data, selected }: NodeProps<ActionNodeType>) {
  const actionData = data.nodeData as ActionNodeData;
  const actionOption = ACTION_OPTIONS.find(a => a.type === actionData.actionType);
  const category = actionOption?.category ?? 'system';
  const style = CATEGORY_STYLES[category] ?? CATEGORY_STYLES.system;
  const IconComp = ACTION_ICON_MAP[actionData.actionType] ?? style.IconComp;
  const isValid = data.isValid;

  return (
    <div
      className={`
        relative w-[260px] rounded-lg border-2 bg-white shadow-sm transition-all
        ${selected ? 'border-cyan-500 shadow-cyan-500/20 shadow-md' : isValid ? 'border-gray-200' : 'border-red-300'}
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
      />
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className={`flex-shrink-0 w-8 h-8 rounded-md ${style.bg} flex items-center justify-center`}>
          <IconComp className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-[11px] font-semibold uppercase tracking-wider ${style.icon}`}>
            {actionOption?.category?.replace('_', ' ') || 'Action'}
          </div>
          <div className="text-sm font-medium text-gray-900 truncate">
            {actionOption?.label || data.label}
          </div>
        </div>
        {!isValid && (
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
      />
    </div>
  );
}

export const ActionNode = memo(ActionNodeComponent);
