import { Phone, Mail, PhoneCall, MessageCircle, Share2 } from 'lucide-react';
import type { MessageChannel } from '../../types';

interface ChannelIconProps {
  channel?: MessageChannel;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  platform?: string | null;
}

const channelConfig: Record<MessageChannel, { icon: typeof Phone; color: string; label: string }> = {
  sms: { icon: Phone, color: 'text-cyan-400', label: 'SMS' },
  email: { icon: Mail, color: 'text-blue-400', label: 'Email' },
  voice: { icon: PhoneCall, color: 'text-teal-400', label: 'Voice' },
  webchat: { icon: MessageCircle, color: 'text-sky-400', label: 'Webchat' },
  social_dm: { icon: Share2, color: 'text-blue-400', label: 'Social DM' },
};

const PLATFORM_LABEL: Record<string, string> = {
  facebook: 'Facebook DM',
  instagram: 'Instagram DM',
  linkedin: 'LinkedIn DM',
};

const sizeClasses = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

export function ChannelIcon({ channel, size = 'sm', showLabel = false, platform }: ChannelIconProps) {
  const config = channel ? channelConfig[channel] : channelConfig.sms;
  const Icon = config.icon;
  const label = (channel === 'social_dm' && platform && PLATFORM_LABEL[platform])
    ? PLATFORM_LABEL[platform]
    : config.label;

  if (showLabel) {
    return (
      <span className={`inline-flex items-center gap-1 ${config.color}`}>
        <Icon className={sizeClasses[size]} />
        <span className="text-xs">{label}</span>
      </span>
    );
  }

  return <Icon className={`${sizeClasses[size]} ${config.color}`} title={label} />;
}

interface ChannelBadgeProps {
  channel: MessageChannel;
  variant?: 'filled' | 'outline';
  platform?: string | null;
}

export function ChannelBadge({ channel, variant = 'filled', platform }: ChannelBadgeProps) {
  const config = channelConfig[channel];
  const Icon = config.icon;
  const label = (channel === 'social_dm' && platform && PLATFORM_LABEL[platform])
    ? PLATFORM_LABEL[platform]
    : config.label;

  const baseClasses = 'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium';
  const variantClasses = variant === 'filled'
    ? 'bg-slate-700 text-slate-200'
    : `border border-slate-600 ${config.color}`;

  return (
    <span className={`${baseClasses} ${variantClasses}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

interface MultiChannelIndicatorProps {
  channels: MessageChannel[];
  maxDisplay?: number;
}

export function MultiChannelIndicator({ channels, maxDisplay = 3 }: MultiChannelIndicatorProps) {
  const uniqueChannels = [...new Set(channels)];
  const displayChannels = uniqueChannels.slice(0, maxDisplay);
  const remaining = uniqueChannels.length - maxDisplay;

  return (
    <div className="flex items-center gap-1">
      {displayChannels.map((channel) => {
        const config = channelConfig[channel];
        const Icon = config.icon;
        return (
          <div
            key={channel}
            className={`w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center ${config.color}`}
            title={config.label}
          >
            <Icon className="w-3 h-3" />
          </div>
        );
      })}
      {remaining > 0 && (
        <span className="text-xs text-slate-500">+{remaining}</span>
      )}
    </div>
  );
}
