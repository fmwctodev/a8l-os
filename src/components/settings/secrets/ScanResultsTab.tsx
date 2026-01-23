import { useState } from 'react';
import {
  Shield, Play, AlertTriangle, Clock, XCircle, Key, CheckCircle,
  ChevronDown, ChevronRight, RefreshCw
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import * as secretsService from '../../../services/secrets';

interface ScanResult {
  org_id: string;
  org_name: string;
  expiring_soon: Array<{ id: string; key: string; name: string; days_until_expiry?: number; category?: string }>;
  expired: Array<{ id: string; key: string; name: string; category?: string }>;
  unused: Array<{ id: string; key: string; name: string; days_since_last_use?: number; category?: string }>;
  no_value: Array<{ id: string; key: string; name: string; category?: string }>;
  scan_timestamp: string;
}

export function ScanResultsTab() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    expired: true,
    expiring_soon: true,
    unused: false,
    no_value: false,
  });

  const runScan = async () => {
    if (!user?.organization_id) return;

    setLoading(true);
    setError(null);

    try {
      const scanResults = await secretsService.runSecretsScan(user.organization_id, false);
      const orgResult = scanResults.results.find(r => r.org_id === user.organization_id);

      if (orgResult) {
        setResults(orgResult);
      } else {
        setResults({
          org_id: user.organization_id,
          org_name: '',
          expiring_soon: [],
          expired: [],
          unused: [],
          no_value: [],
          scan_timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const renderSecretsList = (
    secrets: Array<{ id: string; key: string; name: string; days_until_expiry?: number; days_since_last_use?: number; category?: string }>,
    type: 'expired' | 'expiring_soon' | 'unused' | 'no_value'
  ) => {
    if (secrets.length === 0) return null;

    const icons: Record<string, React.ReactNode> = {
      expired: <XCircle className="h-4 w-4 text-red-500" />,
      expiring_soon: <Clock className="h-4 w-4 text-amber-500" />,
      unused: <RefreshCw className="h-4 w-4 text-gray-400" />,
      no_value: <AlertTriangle className="h-4 w-4 text-orange-500" />,
    };

    return (
      <div className="divide-y divide-gray-100">
        {secrets.map((secret) => (
          <div key={secret.id} className="flex items-center gap-3 py-3 px-4 hover:bg-gray-50">
            {icons[type]}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 text-sm">{secret.name}</div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <code className="px-1.5 py-0.5 bg-gray-100 rounded">{secret.key}</code>
                {secret.category && <span>in {secret.category}</span>}
              </div>
            </div>
            {secret.days_until_expiry !== undefined && (
              <span className="text-sm text-amber-600 font-medium">
                {secret.days_until_expiry}d left
              </span>
            )}
            {secret.days_since_last_use !== undefined && (
              <span className="text-sm text-gray-500">
                {secret.days_since_last_use}d unused
              </span>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderSection = (
    title: string,
    icon: React.ReactNode,
    secrets: Array<{ id: string; key: string; name: string; days_until_expiry?: number; days_since_last_use?: number; category?: string }>,
    type: 'expired' | 'expiring_soon' | 'unused' | 'no_value',
    colorClass: string
  ) => {
    const isExpanded = expandedSections[type];
    const count = secrets.length;

    return (
      <div className={`rounded-lg border ${count > 0 ? colorClass : 'border-gray-200'}`}>
        <button
          onClick={() => toggleSection(type)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
        >
          <div className="flex items-center gap-3">
            {icon}
            <span className="font-medium text-gray-900">{title}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              count > 0 ? colorClass.replace('border-', 'bg-').replace('-200', '-100') + ' ' + colorClass.replace('border-', 'text-').replace('-200', '-700') : 'bg-gray-100 text-gray-600'
            }`}>
              {count}
            </span>
          </div>
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronRight className="h-5 w-5 text-gray-400" />
          )}
        </button>
        {isExpanded && count > 0 && (
          <div className="border-t border-gray-100">
            {renderSecretsList(secrets, type)}
          </div>
        )}
        {isExpanded && count === 0 && (
          <div className="px-4 py-6 text-center text-sm text-gray-500 border-t border-gray-100">
            <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
            No issues found
          </div>
        )}
      </div>
    );
  };

  const hasIssues = results && (
    results.expired.length > 0 ||
    results.expiring_soon.length > 0 ||
    results.unused.length > 0 ||
    results.no_value.length > 0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Security Scan</h3>
          <p className="text-sm text-gray-500">
            Check for expired, expiring, or unused secrets
          </p>
        </div>
        <button
          onClick={runScan}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              Scanning...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Run Scan
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {!results && !loading && !error && (
        <div className="text-center py-16 bg-gray-50 rounded-xl border border-gray-200">
          <Shield className="mx-auto h-16 w-16 text-gray-300" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">Run a Security Scan</h3>
          <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
            Scan your secrets to identify expired credentials, upcoming expirations,
            and unused keys that may need attention.
          </p>
          <button
            onClick={runScan}
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            <Play className="h-5 w-5" />
            Start Scan
          </button>
        </div>
      )}

      {results && (
        <div className="space-y-4">
          <div className={`flex items-center gap-3 p-4 rounded-lg ${
            hasIssues ? 'bg-amber-50 border border-amber-200' : 'bg-emerald-50 border border-emerald-200'
          }`}>
            {hasIssues ? (
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            ) : (
              <CheckCircle className="h-6 w-6 text-emerald-600" />
            )}
            <div>
              <h4 className={`font-medium ${hasIssues ? 'text-amber-900' : 'text-emerald-900'}`}>
                {hasIssues ? 'Issues Found' : 'All Clear'}
              </h4>
              <p className={`text-sm ${hasIssues ? 'text-amber-700' : 'text-emerald-700'}`}>
                {hasIssues
                  ? `Found ${results.expired.length + results.expiring_soon.length + results.unused.length + results.no_value.length} issue(s) requiring attention`
                  : 'No security issues detected with your secrets'
                }
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Last scanned: {new Date(results.scan_timestamp).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {renderSection(
              'Expired Secrets',
              <XCircle className="h-5 w-5 text-red-500" />,
              results.expired,
              'expired',
              'border-red-200'
            )}

            {renderSection(
              'Expiring Soon',
              <Clock className="h-5 w-5 text-amber-500" />,
              results.expiring_soon,
              'expiring_soon',
              'border-amber-200'
            )}

            {renderSection(
              'Unused Secrets',
              <RefreshCw className="h-5 w-5 text-gray-400" />,
              results.unused,
              'unused',
              'border-gray-200'
            )}

            {renderSection(
              'Missing Values',
              <AlertTriangle className="h-5 w-5 text-orange-500" />,
              results.no_value,
              'no_value',
              'border-orange-200'
            )}
          </div>

          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-2">Automatic Scanning</h4>
            <p className="text-sm text-gray-600">
              Security scans run automatically every 6 hours. Administrators are notified
              when expired or expiring secrets are detected.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
