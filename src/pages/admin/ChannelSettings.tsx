import { useState } from 'react';
import { Phone, Mail, MessageCircle } from 'lucide-react';
import { TwilioConfig } from '../../components/settings/TwilioConfig';
import { GmailConfig } from '../../components/settings/GmailConfig';
import { WebchatConfig } from '../../components/settings/WebchatConfig';

type TabType = 'twilio' | 'gmail' | 'webchat';

const TABS: { id: TabType; label: string; icon: React.ReactNode }[] = [
  { id: 'twilio', label: 'Twilio (SMS/Voice)', icon: <Phone size={18} /> },
  { id: 'gmail', label: 'Gmail', icon: <Mail size={18} /> },
  { id: 'webchat', label: 'Webchat Widget', icon: <MessageCircle size={18} /> },
];

export function ChannelSettings() {
  const [activeTab, setActiveTab] = useState<TabType>('twilio');

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Channel Settings</h1>
        <p className="text-gray-500 mt-1">
          Configure your communication channels for SMS, email, and webchat
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'twilio' && <TwilioConfig />}
          {activeTab === 'gmail' && <GmailConfig />}
          {activeTab === 'webchat' && <WebchatConfig />}
        </div>
      </div>
    </div>
  );
}
