import {
  History,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Sparkles,
  Settings,
  User,
  Bot,
  Cpu,
} from 'lucide-react';
import type { EmailCampaignDomainEvent } from '../../../types';

interface CampaignDomainEventLogProps {
  events: EmailCampaignDomainEvent[];
}

export function CampaignDomainEventLog({ events }: CampaignDomainEventLogProps) {
  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'warmup_started':
        return <Play className="h-4 w-4 text-emerald-400" />;
      case 'warmup_paused':
      case 'auto_paused':
        return <Pause className="h-4 w-4 text-amber-400" />;
      case 'warmup_resumed':
        return <Play className="h-4 w-4 text-cyan-400" />;
      case 'warmup_completed':
        return <CheckCircle className="h-4 w-4 text-emerald-400" />;
      case 'dns_verified':
        return <CheckCircle className="h-4 w-4 text-emerald-400" />;
      case 'dns_failed':
        return <XCircle className="h-4 w-4 text-red-400" />;
      case 'config_updated':
        return <Settings className="h-4 w-4 text-slate-400" />;
      case 'ai_recommendation_applied':
        return <Sparkles className="h-4 w-4 text-amber-400" />;
      case 'threshold_warning':
        return <AlertTriangle className="h-4 w-4 text-amber-400" />;
      case 'threshold_breach':
        return <AlertTriangle className="h-4 w-4 text-red-400" />;
      default:
        return <History className="h-4 w-4 text-slate-400" />;
    }
  };

  const getEventTitle = (eventType: string) => {
    switch (eventType) {
      case 'warmup_started':
        return 'Warm-up started';
      case 'warmup_paused':
        return 'Warm-up paused';
      case 'auto_paused':
        return 'Automatically paused';
      case 'warmup_resumed':
        return 'Warm-up resumed';
      case 'warmup_completed':
        return 'Warm-up completed';
      case 'dns_verified':
        return 'DNS verified';
      case 'dns_failed':
        return 'DNS verification failed';
      case 'config_updated':
        return 'Configuration updated';
      case 'ai_recommendation_applied':
        return 'AI recommendation applied';
      case 'threshold_warning':
        return 'Threshold warning';
      case 'threshold_breach':
        return 'Threshold breached';
      default:
        return eventType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    }
  };

  const getActorIcon = (actorType: string) => {
    switch (actorType) {
      case 'user':
        return <User className="h-3 w-3" />;
      case 'ai':
        return <Bot className="h-3 w-3" />;
      case 'system':
        return <Cpu className="h-3 w-3" />;
      default:
        return <Cpu className="h-3 w-3" />;
    }
  };

  const getActorLabel = (event: EmailCampaignDomainEvent) => {
    if (event.actor_type === 'user' && event.actor) {
      return event.actor.name || event.actor.email;
    }
    return event.actor_type === 'ai' ? 'AI' : 'System';
  };

  if (events.length === 0) {
    return (
      <div className="bg-slate-900/50 rounded-lg p-8 text-center">
        <History className="h-12 w-12 text-slate-600 mx-auto mb-4" />
        <p className="text-sm text-slate-400">No activity recorded yet</p>
        <p className="text-xs text-slate-500 mt-1">
          Events will appear as actions are taken on this domain
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <History className="h-5 w-5 text-slate-400" />
        <div>
          <h4 className="text-sm font-medium text-white">Activity History</h4>
          <p className="text-xs text-slate-400">
            Recent events and changes for this domain
          </p>
        </div>
      </div>

      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-700" />
        <ul className="space-y-4">
          {events.map((event) => (
            <li key={event.id} className="relative pl-10">
              <div className="absolute left-0 w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                {getEventIcon(event.event_type)}
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <h5 className="text-sm font-medium text-white">
                    {getEventTitle(event.event_type)}
                  </h5>
                  <span className="text-xs text-slate-500">
                    {new Date(event.created_at).toLocaleString()}
                  </span>
                </div>
                {event.reason && (
                  <p className="mt-1 text-sm text-slate-300">{event.reason}</p>
                )}
                {event.ai_recommendation_text && (
                  <div className="mt-2 flex items-start gap-2">
                    <Sparkles className="h-4 w-4 text-amber-400 mt-0.5" />
                    <p className="text-sm text-amber-400/80">{event.ai_recommendation_text}</p>
                  </div>
                )}
                <div className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                  {getActorIcon(event.actor_type)}
                  <span>{getActorLabel(event)}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
