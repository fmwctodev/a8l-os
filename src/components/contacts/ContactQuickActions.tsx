import { useState } from 'react';
import {
  MessageSquare,
  Phone,
  Briefcase,
  Calendar,
  FileText,
  Star,
  ChevronRight,
} from 'lucide-react';
import type { Contact } from '../../types';
import { ComposeMessageDrawer } from '../dashboard/ComposeMessageDrawer';
import { BookAppointmentDrawer } from '../dashboard/BookAppointmentDrawer';
import { CreateOpportunityDrawer } from '../dashboard/CreateOpportunityDrawer';
import { CreateInvoiceDrawer } from '../dashboard/CreateInvoiceDrawer';
import { RequestReviewModal } from '../reputation/RequestReviewModal';

interface ContactQuickActionsProps {
  contact: Contact;
  onRefresh: () => void;
  canSendMessage: boolean;
  canCall: boolean;
  canCreateOpportunity: boolean;
  canBookAppointment: boolean;
  canCreateInvoice: boolean;
  canRequestReview: boolean;
}

type DrawerType = 'message' | 'appointment' | 'opportunity' | 'invoice' | 'review' | null;

export function ContactQuickActions({
  contact,
  onRefresh,
  canSendMessage,
  canCall,
  canCreateOpportunity,
  canBookAppointment,
  canCreateInvoice,
  canRequestReview,
}: ContactQuickActionsProps) {
  const [activeDrawer, setActiveDrawer] = useState<DrawerType>(null);

  const actions = [
    {
      id: 'message' as const,
      label: 'Send Message',
      description: 'SMS or Email',
      icon: MessageSquare,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      hoverColor: 'hover:bg-cyan-500/20',
      enabled: canSendMessage && (!!contact.phone || !!contact.email),
    },
    {
      id: 'call' as const,
      label: 'Call',
      description: contact.phone || 'No phone',
      icon: Phone,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      hoverColor: 'hover:bg-emerald-500/20',
      enabled: canCall && !!contact.phone,
      href: contact.phone ? `tel:${contact.phone}` : undefined,
    },
    {
      id: 'opportunity' as const,
      label: 'Create Opportunity',
      description: 'Add to pipeline',
      icon: Briefcase,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      hoverColor: 'hover:bg-amber-500/20',
      enabled: canCreateOpportunity,
    },
    {
      id: 'appointment' as const,
      label: 'Book Appointment',
      description: 'Schedule a meeting',
      icon: Calendar,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      hoverColor: 'hover:bg-blue-500/20',
      enabled: canBookAppointment,
    },
    {
      id: 'invoice' as const,
      label: 'Create Invoice',
      description: 'Send for payment',
      icon: FileText,
      color: 'text-teal-400',
      bgColor: 'bg-teal-500/10',
      hoverColor: 'hover:bg-teal-500/20',
      enabled: canCreateInvoice,
    },
    {
      id: 'review' as const,
      label: 'Request Review',
      description: 'Send review request',
      icon: Star,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
      hoverColor: 'hover:bg-yellow-500/20',
      enabled: canRequestReview && (!!contact.phone || !!contact.email),
    },
  ];

  const handleAction = (actionId: DrawerType) => {
    if (actionId === 'call') return;
    setActiveDrawer(actionId);
  };

  const handleDrawerClose = () => {
    setActiveDrawer(null);
  };

  const handleSuccess = () => {
    setActiveDrawer(null);
    onRefresh();
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
      <h3 className="text-sm font-medium text-slate-300 mb-3">Quick Actions</h3>

      <div className="space-y-2">
        {actions.map((action) => {
          if (!action.enabled) return null;

          const ActionWrapper = action.href ? 'a' : 'button';
          const wrapperProps = action.href
            ? { href: action.href }
            : { onClick: () => handleAction(action.id as DrawerType) };

          return (
            <ActionWrapper
              key={action.id}
              {...wrapperProps}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${action.bgColor} ${action.hoverColor} group`}
            >
              <div className={`w-9 h-9 rounded-lg ${action.bgColor} flex items-center justify-center`}>
                <action.icon className={`w-5 h-5 ${action.color}`} />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-white">{action.label}</p>
                <p className="text-xs text-slate-400">{action.description}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
            </ActionWrapper>
          );
        })}
      </div>

      {actions.every((a) => !a.enabled) && (
        <p className="text-sm text-slate-500 text-center py-4">
          No quick actions available
        </p>
      )}

      <ComposeMessageDrawer
        open={activeDrawer === 'message'}
        onClose={handleDrawerClose}
        onSuccess={handleSuccess}
      />

      <BookAppointmentDrawer
        open={activeDrawer === 'appointment'}
        onClose={handleDrawerClose}
        onSuccess={handleSuccess}
      />

      <CreateOpportunityDrawer
        open={activeDrawer === 'opportunity'}
        onClose={handleDrawerClose}
        onSuccess={handleSuccess}
      />

      <CreateInvoiceDrawer
        open={activeDrawer === 'invoice'}
        onClose={handleDrawerClose}
        onSuccess={handleSuccess}
      />

      {activeDrawer === 'review' && (
        <RequestReviewModal
          contactId={contact.id}
          contactName={`${contact.first_name} ${contact.last_name}`}
          contactEmail={contact.email}
          contactPhone={contact.phone}
          onClose={handleDrawerClose}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
