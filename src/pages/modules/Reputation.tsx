import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Send } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../contexts/ToastContext';
import { OverviewTab } from '../../components/reputation/OverviewTab';
import { RequestsTab } from '../../components/reputation/RequestsTab';
import { ReviewsInbox } from '../../components/reputation/ReviewsInbox';
import { ReputationSettingsTab } from '../../components/reputation/ReputationSettingsTab';
import { RequestReviewModal } from '../../components/reputation/RequestReviewModal';

type TabType = 'overview' | 'requests' | 'reviews' | 'settings';

export function Reputation() {
  const canRequest = usePermission('reputation.request');
  const canManageProviders = usePermission('reputation.providers.manage');
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showRequestModal, setShowRequestModal] = useState(false);

  useEffect(() => {
    const late = searchParams.get('late');
    const error = searchParams.get('error');
    const provider = searchParams.get('provider');

    if (late === 'success') {
      const count = searchParams.get('count') || '0';
      const label = provider === 'google_business' ? 'Google Business Profile' : provider === 'facebook' ? 'Facebook' : 'Account';
      showToast('success', `${label} connected`, `${count} account(s) synced successfully.`);
      setActiveTab('settings');
    } else if (error) {
      const friendlyError = error === 'no_google_locations'
        ? 'No Google Business locations found. Make sure your Google account manages at least one business location.'
        : error;
      showToast('warning', 'Connection issue', friendlyError);
      setActiveTab('settings');
    }

    if (late || error) {
      setSearchParams({}, { replace: true });
    }
  }, []);

  const tabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'requests' as const, label: 'Requests' },
    { id: 'reviews' as const, label: 'Reviews Inbox' },
    { id: 'settings' as const, label: 'Settings', requiresPermission: true },
  ];

  function handleRequestReview() {
    setShowRequestModal(true);
  }

  function handleConfigureLink() {
    setActiveTab('settings');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Reputation</h1>
        {canRequest && (
          <button
            onClick={handleRequestReview}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            <Send className="w-4 h-4" />
            Send Review Request
          </button>
        )}
      </div>

      <div className="bg-slate-800 rounded-xl p-1 inline-flex">
        {tabs.map((tab) => {
          if (tab.requiresPermission && !canManageProviders) return null;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-gray-900'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'overview' && (
        <OverviewTab onRequestReview={handleRequestReview} />
      )}

      {activeTab === 'requests' && (
        <RequestsTab
          onRequestReview={handleRequestReview}
          onConfigureLink={handleConfigureLink}
        />
      )}

      {activeTab === 'reviews' && <ReviewsInbox />}

      {activeTab === 'settings' && canManageProviders && (
        <ReputationSettingsTab />
      )}

      {showRequestModal && (
        <RequestReviewModal
          onClose={() => setShowRequestModal(false)}
          onSuccess={() => {
            setShowRequestModal(false);
          }}
        />
      )}
    </div>
  );
}
