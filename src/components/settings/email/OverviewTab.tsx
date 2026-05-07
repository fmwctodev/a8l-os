import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Mail, Globe, AtSign, Send, ArrowRight } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { getEmailSetupStatus, getTestEmailLogs } from '../../../services/emailSend';
import { getProviderStatus } from '../../../services/emailProviders';
import type { EmailSetupStatus, EmailTestLog } from '../../../types';

interface OverviewTabProps {
  onNavigate: (tab: 'providers' | 'domains' | 'from-addresses' | 'test') => void;
}

export function OverviewTab({ onNavigate }: OverviewTabProps) {
  const { user, hasPermission } = useAuth();
  const [status, setStatus] = useState<EmailSetupStatus | null>(null);
  const [providerNickname, setProviderNickname] = useState<string | null>(null);
  const [lastTestLog, setLastTestLog] = useState<EmailTestLog | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = hasPermission('email.settings.manage');
  const canTest = hasPermission('email.send.test');

  useEffect(() => {
    loadData();
  }, [user?.organization_id]);

  const loadData = async () => {
    if (!user?.organization_id) return;
    try {
      const [statusData, providerStatus, testLogs] = await Promise.all([
        getEmailSetupStatus(),
        getProviderStatus(user.organization_id),
        getTestEmailLogs(user.organization_id, 1),
      ]);
      setStatus(statusData);
      setProviderNickname(providerStatus?.nickname || null);
      setLastTestLog(testLogs[0] || null);
    } catch (error) {
      console.error('Failed to load email status:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
      </div>
    );
  }

  if (!status) {
    return (
      <div className="text-center py-12 text-slate-400">
        Unable to load email configuration status
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!status.isConfigured && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-400 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-red-400">Email Sending Blocked</h3>
              <div className="mt-2 text-sm text-red-300/80">
                <p>The following issues are preventing email sending:</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  {status.blockingReasons.map((reason, index) => (
                    <li key={index}>{reason}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                {status.providerConnected ? (
                  <CheckCircle className="h-8 w-8 text-emerald-400" />
                ) : (
                  <XCircle className="h-8 w-8 text-red-400" />
                )}
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-slate-400 truncate">Provider</dt>
                  <dd className="flex items-baseline">
                    <div className="text-lg font-semibold text-white">
                      {status.providerConnected ? 'Connected' : 'Not Connected'}
                    </div>
                  </dd>
                  {providerNickname && (
                    <dd className="text-sm text-slate-500">{providerNickname}</dd>
                  )}
                </dl>
              </div>
            </div>
          </div>
          {isAdmin && !status.providerConnected && (
            <div className="bg-slate-700/50 px-5 py-3">
              <button
                onClick={() => onNavigate('providers')}
                className="text-sm font-medium text-cyan-400 hover:text-cyan-300 flex items-center"
              >
                Connect Mailgun <ArrowRight className="ml-1 h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Globe className={`h-8 w-8 ${status.verifiedDomainsCount > 0 ? 'text-emerald-400' : 'text-slate-500'}`} />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-slate-400 truncate">Verified Domains</dt>
                  <dd className="text-lg font-semibold text-white">
                    {status.verifiedDomainsCount}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          {isAdmin && status.verifiedDomainsCount === 0 && (
            <div className="bg-slate-700/50 px-5 py-3">
              <button
                onClick={() => onNavigate('domains')}
                className="text-sm font-medium text-cyan-400 hover:text-cyan-300 flex items-center"
              >
                Add Domain <ArrowRight className="ml-1 h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AtSign className={`h-8 w-8 ${status.activeFromAddressesCount > 0 ? 'text-emerald-400' : 'text-slate-500'}`} />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-slate-400 truncate">From Addresses</dt>
                  <dd className="text-lg font-semibold text-white">
                    {status.activeFromAddressesCount}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          {isAdmin && status.activeFromAddressesCount === 0 && (
            <div className="bg-slate-700/50 px-5 py-3">
              <button
                onClick={() => onNavigate('from-addresses')}
                className="text-sm font-medium text-cyan-400 hover:text-cyan-300 flex items-center"
              >
                Add Address <ArrowRight className="ml-1 h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Send className={`h-8 w-8 ${status.isConfigured ? 'text-emerald-400' : 'text-slate-500'}`} />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-slate-400 truncate">Ready to Send</dt>
                  <dd className="text-lg font-semibold text-white">
                    {status.isConfigured ? 'Yes' : 'No'}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          {canTest && status.isConfigured && (
            <div className="bg-slate-700/50 px-5 py-3">
              <button
                onClick={() => onNavigate('test')}
                className="text-sm font-medium text-cyan-400 hover:text-cyan-300 flex items-center"
              >
                Send Test <ArrowRight className="ml-1 h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {lastTestLog && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h3 className="text-lg font-medium text-white mb-4">Last Test Email</h3>
          <div className="flex items-center space-x-4">
            {lastTestLog.status === 'success' ? (
              <CheckCircle className="h-5 w-5 text-emerald-400" />
            ) : (
              <XCircle className="h-5 w-5 text-red-400" />
            )}
            <div>
              <p className="text-sm text-white">
                Sent to <span className="font-medium">{lastTestLog.to_email}</span>
              </p>
              <p className="text-sm text-slate-400">
                {new Date(lastTestLog.sent_at).toLocaleString()}
                {lastTestLog.status === 'failed' && lastTestLog.error_message && (
                  <span className="text-red-400 ml-2">- {lastTestLog.error_message}</span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
        <h3 className="text-lg font-medium text-white mb-4">Email Integration Usage</h3>
        <p className="text-sm text-slate-400 mb-4">
          Once configured, email sending is used by the following features:
        </p>
        <ul className="space-y-3">
          <li className="flex items-center text-sm text-slate-300">
            <Mail className="h-5 w-5 mr-3 text-slate-500" />
            <span><strong className="text-white">Conversations</strong> - Send emails directly to contacts</span>
          </li>
          <li className="flex items-center text-sm text-slate-300">
            <Mail className="h-5 w-5 mr-3 text-slate-500" />
            <span><strong className="text-white">Workflows</strong> - Automated email actions in workflows</span>
          </li>
          <li className="flex items-center text-sm text-slate-300">
            <Mail className="h-5 w-5 mr-3 text-slate-500" />
            <span><strong className="text-white">AI Agents</strong> - Send emails via AI agent tools</span>
          </li>
          <li className="flex items-center text-sm text-slate-300">
            <Mail className="h-5 w-5 mr-3 text-slate-500" />
            <span><strong className="text-white">Reputation</strong> - Send review request emails</span>
          </li>
          <li className="flex items-center text-sm text-slate-300">
            <Mail className="h-5 w-5 mr-3 text-slate-500" />
            <span><strong className="text-white">Reports</strong> - Scheduled report delivery</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
