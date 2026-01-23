import { useState, useEffect, useRef } from 'react';
import { Mic, RefreshCw, Check, AlertCircle, Loader2, Star, Play, Pause, Volume2 } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import * as elevenlabsService from '../../../services/elevenlabs';
import type { ElevenLabsConnection, ElevenLabsVoice } from '../../../types';

export function VoicesSettingsTab() {
  const { user } = useAuth();
  const orgId = user?.organization_id;

  const [connection, setConnection] = useState<ElevenLabsConnection | null>(null);
  const [voices, setVoices] = useState<ElevenLabsVoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState('Hello, this is a sample of my voice.');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (orgId) {
      loadData();
    }
  }, [orgId]);

  const loadData = async () => {
    if (!orgId) return;
    try {
      setLoading(true);
      const [conn, voiceList] = await Promise.all([
        elevenlabsService.getConnection(orgId),
        elevenlabsService.getVoices(orgId),
      ]);
      setConnection(conn);
      setVoices(voiceList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!orgId) return;
    try {
      setTesting(true);
      setTestResult(null);

      if (!connection && apiKey) {
        await elevenlabsService.saveConnection(orgId, apiKey, false);
      } else if (apiKey && connection) {
        await elevenlabsService.saveConnection(orgId, apiKey, connection.enabled);
      }

      const result = await elevenlabsService.testConnection(orgId);
      setTestResult(result);

      if (result.success) {
        await loadData();
      }
    } catch (err) {
      setTestResult({ success: false, error: err instanceof Error ? err.message : 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveConnection = async () => {
    if (!orgId || !apiKey) return;
    try {
      setSaving(true);
      await elevenlabsService.saveConnection(orgId, apiKey, true);
      await loadData();
      setApiKey('');
      setTestResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save connection');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async () => {
    if (!orgId || !connection) return;
    try {
      await elevenlabsService.updateConnectionEnabled(orgId, !connection.enabled);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update connection');
    }
  };

  const handleSyncVoices = async () => {
    if (!orgId) return;
    try {
      setSyncing(true);
      const result = await elevenlabsService.syncVoices(orgId);
      if (result.success) {
        await loadData();
      } else {
        setError(result.error || 'Failed to sync voices');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync voices');
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleVoiceEnabled = async (voiceId: string, enabled: boolean) => {
    try {
      await elevenlabsService.toggleVoiceEnabled(voiceId, enabled);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update voice');
    }
  };

  const handleSetDefaultVoice = async (voiceId: string) => {
    if (!orgId) return;
    try {
      await elevenlabsService.setDefaultVoice(orgId, voiceId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set default voice');
    }
  };

  const handlePreviewVoice = async (voice: ElevenLabsVoice) => {
    if (!orgId) return;

    if (playingVoiceId === voice.id) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingVoiceId(null);
      return;
    }

    try {
      setPlayingVoiceId(voice.id);

      if (voice.metadata.preview_url) {
        const audio = new Audio(voice.metadata.preview_url);
        audioRef.current = audio;
        audio.onended = () => setPlayingVoiceId(null);
        audio.onerror = () => setPlayingVoiceId(null);
        await audio.play();
      } else {
        const result = await elevenlabsService.previewVoice(orgId, voice.voice_id, previewText);
        if (result.audioUrl) {
          const audio = new Audio(result.audioUrl);
          audioRef.current = audio;
          audio.onended = () => setPlayingVoiceId(null);
          audio.onerror = () => setPlayingVoiceId(null);
          await audio.play();
        } else {
          setPlayingVoiceId(null);
          setError(result.error || 'Failed to preview voice');
        }
      }
    } catch (err) {
      setPlayingVoiceId(null);
      setError(err instanceof Error ? err.message : 'Failed to preview voice');
    }
  };

  const formatLabels = (metadata: ElevenLabsVoice['metadata']) => {
    const labels: string[] = [];
    if (metadata.gender) labels.push(metadata.gender);
    if (metadata.age) labels.push(metadata.age);
    if (metadata.accent) labels.push(metadata.accent);
    if (metadata.use_case) labels.push(metadata.use_case);
    return labels.join(' / ');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      <section>
        <h2 className="text-lg font-medium text-white mb-4">ElevenLabs Connection</h2>
        <p className="text-sm text-slate-400 mb-4">
          Connect your ElevenLabs account to enable AI voice synthesis
        </p>

        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-slate-700 flex items-center justify-center">
                <Mic className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h3 className="font-medium text-white">ElevenLabs</h3>
                <p className="text-sm text-slate-400">AI Voice Generation</p>
              </div>
            </div>
            {connection && (
              <span
                className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                  connection.enabled
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-slate-500/10 text-slate-400'
                }`}
              >
                {connection.enabled ? 'Connected' : 'Disabled'}
              </span>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">API Key</label>
              <div className="flex gap-2">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={connection ? '••••••••••••••••' : 'Enter API key'}
                  className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="px-3 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600"
                >
                  {showApiKey ? 'Hide' : 'Show'}
                </button>
              </div>
              <a
                href="https://elevenlabs.io/app/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-cyan-400 hover:underline mt-1 inline-block"
              >
                Get API key from ElevenLabs
              </a>
            </div>

            {testResult && (
              <div
                className={`flex items-center gap-2 p-3 rounded-lg ${
                  testResult.success
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-red-500/10 text-red-400'
                }`}
              >
                {testResult.success ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <AlertCircle className="w-5 h-5" />
                )}
                <span>{testResult.success ? 'Connection successful!' : testResult.error}</span>
              </div>
            )}

            {connection?.last_synced_at && (
              <p className="text-xs text-slate-400">
                Last synced: {new Date(connection.last_synced_at).toLocaleString()}
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleTestConnection}
                disabled={testing || (!apiKey && !connection)}
                className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50"
              >
                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Test Connection'}
              </button>
              {apiKey && (
                <button
                  onClick={handleSaveConnection}
                  disabled={saving}
                  className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save & Enable'}
                </button>
              )}
              {connection && (
                <button
                  onClick={handleToggleEnabled}
                  className={`px-4 py-2 rounded-lg ${
                    connection.enabled
                      ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  {connection.enabled ? 'Disable' : 'Enable'}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {connection?.enabled && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-medium text-white">Voice Catalog</h2>
              <p className="text-sm text-slate-400">
                {voices.length} voices available
              </p>
            </div>
            <button
              onClick={handleSyncVoices}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Voices'}
            </button>
          </div>

          {voices.length === 0 ? (
            <div className="text-center py-8 bg-slate-800/50 rounded-lg border border-slate-700">
              <Volume2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 mb-4">No voices synced yet</p>
              <button
                onClick={handleSyncVoices}
                disabled={syncing}
                className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                Sync Voices
              </button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {voices.map((voice) => (
                <div
                  key={voice.id}
                  className="bg-slate-800 border border-slate-700 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-white">{voice.voice_name}</h3>
                        {voice.is_default && (
                          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {formatLabels(voice.metadata) || 'No labels'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleToggleVoiceEnabled(voice.id, !voice.enabled)}
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        voice.enabled
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-slate-500/10 text-slate-400'
                      }`}
                    >
                      {voice.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>

                  {voice.metadata.description && (
                    <p className="text-sm text-slate-400 mb-3 line-clamp-2">
                      {voice.metadata.description}
                    </p>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePreviewVoice(voice)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 text-sm"
                    >
                      {playingVoiceId === voice.id ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      {playingVoiceId === voice.id ? 'Stop' : 'Preview'}
                    </button>
                    {voice.enabled && !voice.is_default && (
                      <button
                        onClick={() => handleSetDefaultVoice(voice.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-slate-400 hover:text-yellow-400 text-sm"
                      >
                        <Star className="w-4 h-4" />
                        Set Default
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
