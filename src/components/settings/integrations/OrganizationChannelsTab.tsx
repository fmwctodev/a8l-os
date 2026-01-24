import { useState, useEffect } from 'react';
import { Phone, Mail, MessageCircle, CheckCircle, XCircle, Settings, ChevronRight, X } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { getChannelConfiguration } from '../../../services/channelConfigurations';
import { TwilioConfig } from '../TwilioConfig';
import { GmailConfig } from '../GmailConfig';
import { WebchatConfig } from '../WebchatConfig';
import type { TwilioConfig as TwilioConfigType, GmailConfig as GmailConfigType, WebchatConfig as WebchatConfigType } from '../../../types';

type ChannelType = 'twilio' | 'gmail' | 'webchat';

interface ChannelStatus {
  twilio: { configured: boolean; active: boolean; phoneCount: number };
  gmail: { configured: boolean; active: boolean };
  webchat: { configured: boolean; active: boolean };
}

const CHANNEL_INFO: Record<ChannelType, { label: string; description: string; icon: React.ElementType }> = {
  twilio: {
    label: 'Twilio (SMS/Voice)',
    description: 'Send and receive SMS messages and voice calls',
    icon: Phone,
  },
  gmail: {
    label: 'Gmail Organization',
    description: 'Configure OAuth credentials for email integration',
    icon: Mail,
  },
  webchat: {
    label: 'Webchat Widget',
    description: 'Embed a chat widget on your website',
    icon: MessageCircle,
  },
};

export function OrganizationChannelsTab() {
  const { user, hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [channelStatus, setChannelStatus] = useState<ChannelStatus>({
    twilio: { configured: false, active: false, phoneCount: 0 },
    gmail: { configured: false, active: false },
    webchat: { configured: false, active: false },
  });
  const [openPanel, setOpenPanel] = useState<ChannelType | null>(null);

  const isSuperAdmin = hasPermission('settings.manage');

  useEffect(() => {
    loadChannelStatus();
  }, [user?.organization_id]);

  const loadChannelStatus = async () => {
    if (!user?.organization_id) return;

    try {
      setLoading(true);
      const [twilioData, gmailData, webchatData] = await Promise.all([
        getChannelConfiguration(user.organization_id, 'twilio').catch(() => null),
        getChannelConfiguration(user.organization_id, 'gmail').catch(() => null),
        getChannelConfiguration(user.organization_id, 'webchat').catch(() => null),
      ]);

      setChannelStatus({
        twilio: {
          configured: !!(twilioData?.config as TwilioConfigType)?.account_sid,
          active: twilioData?.is_active ?? false,
          phoneCount: (twilioData?.config as TwilioConfigType)?.phone_numbers?.length ?? 0,
        },
        gmail: {
          configured: !!(gmailData?.config as GmailConfigType)?.client_id,
          active: gmailData?.is_active ?? false,
        },
        webchat: {
          configured: !!(webchatData?.config as WebchatConfigType)?.welcome_message,
          active: webchatData?.is_active ?? false,
        },
      });
    } catch (error) {
      console.error('Failed to load channel status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClosePanel = () => {
    setOpenPanel(null);
    loadChannelStatus();
  };

  if (!isSuperAdmin) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
        <Settings className="mx-auto h-12 w-12 text-amber-400" />
        <h3 className="mt-4 text-lg font-medium text-amber-900">Super Admin Required</h3>
        <p className="mt-2 text-sm text-amber-700">
          Organization channel configuration is restricted to Super Admins only.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-500">
          Configure organization-wide communication channels. These settings apply to all users.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(Object.keys(CHANNEL_INFO) as ChannelType[]).map((channel) => {
          const info = CHANNEL_INFO[channel];
          const status = channelStatus[channel];
          const Icon = info.icon;

          return (
            <button
              key={channel}
              onClick={() => setOpenPanel(channel)}
              className="group relative flex flex-col rounded-xl border border-gray-200 bg-white p-5 text-left transition-all hover:border-blue-300 hover:shadow-lg"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 text-gray-600 transition-colors group-hover:bg-blue-50 group-hover:text-blue-600">
                  <Icon className="h-6 w-6" />
                </div>
                <ChevronRight className="h-5 w-5 text-gray-300 transition-colors group-hover:text-blue-500" />
              </div>

              <h3 className="mt-4 font-semibold text-gray-900">{info.label}</h3>
              <p className="mt-1 text-sm text-gray-500">{info.description}</p>

              <div className="mt-4 flex items-center gap-3">
                {status.configured ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                    <CheckCircle className="h-3.5 w-3.5" />
                    Configured
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                    <XCircle className="h-3.5 w-3.5" />
                    Not Configured
                  </span>
                )}
                {status.configured && (
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                      status.active
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {status.active ? 'Enabled' : 'Disabled'}
                  </span>
                )}
              </div>

              {channel === 'twilio' && status.phoneCount > 0 && (
                <p className="mt-2 text-xs text-gray-400">
                  {status.phoneCount} phone number{status.phoneCount !== 1 ? 's' : ''} configured
                </p>
              )}
            </button>
          );
        })}
      </div>

      {openPanel && (
        <div className="fixed inset-0 z-50 flex items-start justify-end">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={handleClosePanel}
          />
          <div className="relative h-full w-full max-w-2xl overflow-y-auto bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {CHANNEL_INFO[openPanel].label}
              </h2>
              <button
                onClick={handleClosePanel}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              {openPanel === 'twilio' && <TwilioConfig />}
              {openPanel === 'gmail' && <GmailConfig />}
              {openPanel === 'webchat' && <WebchatConfig />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
