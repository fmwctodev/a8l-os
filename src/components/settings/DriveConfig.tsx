import { useState, useEffect } from 'react';
import { HardDrive, Check, X, RefreshCw, AlertCircle, Unlink } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getConnectionStatus, disconnectDrive } from '../../services/googleDrive';
import { signInWithGoogle } from '../../services/auth';
import type { DriveConnectionStatus } from '../../types';

export default function DriveConfig() {
  const { user, refreshUser } = useAuth();
  const [status, setStatus] = useState<DriveConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const userId = user?.id || '';

  useEffect(() => {
    loadStatus();
  }, [userId]);

  const loadStatus = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await getConnectionStatus(userId);
      setStatus(data);
    } catch (err) {
      console.error('Failed to load Drive status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Failed to initiate Google sign-in:', err);
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Google Drive? Your files will remain in Drive but will no longer be accessible from this CRM.')) {
      return;
    }

    setDisconnecting(true);
    try {
      await disconnectDrive(userId);
      await refreshUser();
      await loadStatus();
    } catch (err) {
      console.error('Failed to disconnect:', err);
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-slate-700 rounded w-1/3" />
          <div className="h-4 bg-slate-700 rounded w-2/3" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <HardDrive className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="font-medium text-white">Google Drive</h3>
            <p className="text-sm text-slate-400">
              Store and manage files from your Google Drive
            </p>
          </div>
        </div>
        {status?.connected ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs">
            <Check className="w-3 h-3" />
            Connected
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-600 text-slate-300 text-xs">
            <X className="w-3 h-3" />
            Not Connected
          </span>
        )}
      </div>

      {status?.connected ? (
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
            <div>
              <p className="text-sm text-white">{status.email}</p>
              <p className="text-xs text-slate-400">Connected Google Account</p>
            </div>
            {status.tokenExpired && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-500/20 text-amber-400 text-xs">
                <AlertCircle className="w-3 h-3" />
                Token Expired
              </span>
            )}
          </div>

          {status.lastSyncAt && (
            <p className="text-xs text-slate-500">
              Last synced: {new Date(status.lastSyncAt).toLocaleString()}
            </p>
          )}

          <div className="flex items-center gap-2">
            {status.tokenExpired && (
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="inline-flex items-center gap-2 px-3 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${connecting ? 'animate-spin' : ''}`} />
                Reconnect
              </button>
            )}
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="inline-flex items-center gap-2 px-3 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 text-sm disabled:opacity-50"
            >
              {disconnecting ? (
                <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Unlink className="w-4 h-4" />
              )}
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {connecting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <HardDrive className="w-4 h-4" />
            )}
            Connect Google Drive
          </button>
          <p className="mt-2 text-xs text-slate-500">
            Connect your Google Drive to upload and manage files directly from the CRM.
          </p>
        </div>
      )}
    </div>
  );
}
