import { useState, useEffect, useRef } from 'react';
import { Volume2, RefreshCw, Loader2, Play, Pause, Search, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import * as elevenlabsService from '../../services/elevenlabs';
import type { ElevenLabsVoice } from '../../types';

const OPENAI_VOICES = [
  { id: 'alloy', name: 'Alloy', description: 'Neutral, balanced tone' },
  { id: 'ash', name: 'Ash', description: 'Soft, conversational tone' },
  { id: 'ballad', name: 'Ballad', description: 'Warm, expressive tone' },
  { id: 'coral', name: 'Coral', description: 'Clear, articulate tone' },
  { id: 'echo', name: 'Echo', description: 'Warm, resonant male voice' },
  { id: 'fable', name: 'Fable', description: 'Expressive British accent' },
  { id: 'nova', name: 'Nova', description: 'Energetic, youthful female voice' },
  { id: 'onyx', name: 'Onyx', description: 'Deep, authoritative male voice' },
  { id: 'sage', name: 'Sage', description: 'Calm, wise tone' },
  { id: 'shimmer', name: 'Shimmer', description: 'Bright, cheerful female voice' },
  { id: 'verse', name: 'Verse', description: 'Versatile, dynamic tone' },
];

const VOICE_PROVIDERS = [
  { value: 'elevenlabs', label: 'ElevenLabs' },
  { value: 'openai', label: 'OpenAI' },
];

interface VoiceTabPanelProps {
  voiceProvider: string;
  voiceId: string;
  onProviderChange: (provider: string) => void;
  onVoiceChange: (voiceId: string) => void;
}

export function VoiceTabPanel({ voiceProvider, voiceId, onProviderChange, onVoiceChange }: VoiceTabPanelProps) {
  const { user } = useAuth();
  const orgId = user?.organization_id;

  const [elVoices, setElVoices] = useState<ElevenLabsVoice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [playingId, setPlayingId] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (voiceProvider === 'elevenlabs' && orgId) {
      loadElevenLabsVoices();
    }
  }, [voiceProvider, orgId]);

  const loadElevenLabsVoices = async () => {
    if (!orgId) return;
    setLoadingVoices(true);
    setError(null);
    try {
      const voices = await elevenlabsService.getVoices(orgId);
      setElVoices(voices);
      if (voices.length === 0) {
        setError('No voices synced yet. Click "Sync Voices" to pull voices from your ElevenLabs account.');
      }
    } catch (err) {
      setError('Failed to load voices. Check your ElevenLabs connection in Settings.');
    } finally {
      setLoadingVoices(false);
    }
  };

  const handleSync = async () => {
    if (!orgId) return;
    setSyncing(true);
    setError(null);
    try {
      const result = await elevenlabsService.syncVoices(orgId);
      if (result.success) {
        await loadElevenLabsVoices();
      } else {
        setError(result.error || 'Failed to sync voices');
      }
    } catch (err) {
      setError('Failed to sync. Check your ElevenLabs API key in Settings > AI Agents > Voices.');
    } finally {
      setSyncing(false);
    }
  };

  const handlePreview = async (voiceIdToPreview: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (playingId === voiceIdToPreview) {
      setPlayingId(null);
      return;
    }

    if (voiceProvider === 'elevenlabs' && orgId) {
      const voice = elVoices.find(v => v.voice_id === voiceIdToPreview);
      const previewUrl = voice?.metadata?.preview_url;

      if (previewUrl) {
        playAudio(previewUrl, voiceIdToPreview);
        return;
      }

      setPreviewLoading(voiceIdToPreview);
      try {
        const result = await elevenlabsService.previewVoice(orgId, voiceIdToPreview, 'Hello, this is a preview of my voice.');
        if (result.audioUrl) {
          playAudio(result.audioUrl, voiceIdToPreview);
        }
      } catch {
        // silent fail
      } finally {
        setPreviewLoading(null);
      }
    }
  };

  const playAudio = (url: string, id: string) => {
    const audio = new Audio(url);
    audioRef.current = audio;
    setPlayingId(id);
    audio.onended = () => {
      setPlayingId(null);
      audioRef.current = null;
    };
    audio.onerror = () => {
      setPlayingId(null);
      audioRef.current = null;
    };
    audio.play().catch(() => {
      setPlayingId(null);
      audioRef.current = null;
    });
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const filteredElVoices = elVoices.filter(v => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      v.voice_name.toLowerCase().includes(q) ||
      v.metadata?.gender?.toLowerCase().includes(q) ||
      v.metadata?.accent?.toLowerCase().includes(q) ||
      v.metadata?.use_case?.toLowerCase().includes(q) ||
      v.metadata?.description?.toLowerCase().includes(q)
    );
  });

  const filteredOpenAIVoices = OPENAI_VOICES.filter(v => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return v.name.toLowerCase().includes(q) || v.description.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Voice Provider</label>
        <div className="flex gap-2">
          {VOICE_PROVIDERS.map(p => (
            <button
              key={p.value}
              onClick={() => {
                onProviderChange(p.value);
                onVoiceChange('');
                setSearchQuery('');
              }}
              className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border transition-all ${
                voiceProvider === p.value
                  ? 'bg-cyan-600/10 border-cyan-500/40 text-cyan-400'
                  : 'bg-slate-900 border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300'
              }`}
            >
              <Volume2 className="w-4 h-4 inline-block mr-2 -mt-0.5" />
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-slate-300">
            {voiceProvider === 'elevenlabs' ? 'Select Voice' : 'Select Voice'}
          </label>
          {voiceProvider === 'elevenlabs' && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-cyan-400 hover:text-cyan-300 bg-cyan-500/5 hover:bg-cyan-500/10 border border-cyan-500/20 rounded-md transition-all disabled:opacity-50"
            >
              {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Sync Voices
            </button>
          )}
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={`Search ${voiceProvider === 'elevenlabs' ? 'ElevenLabs' : 'OpenAI'} voices...`}
            className="w-full pl-9 pr-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 mb-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
            <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-300">{error}</p>
          </div>
        )}

        {loadingVoices ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
          </div>
        ) : voiceProvider === 'elevenlabs' ? (
          <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
            {filteredElVoices.length === 0 && !error ? (
              <p className="text-sm text-slate-500 py-4 text-center">No voices match your search.</p>
            ) : (
              filteredElVoices.map(voice => {
                const isSelected = voiceId === voice.voice_id;
                const isPlaying = playingId === voice.voice_id;
                const isLoading = previewLoading === voice.voice_id;
                return (
                  <button
                    key={voice.id}
                    onClick={() => onVoiceChange(voice.voice_id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'bg-cyan-600/10 border-cyan-500/40'
                        : 'bg-slate-900/50 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-cyan-600/20' : 'bg-slate-800'
                    }`}>
                      <Volume2 className={`w-4 h-4 ${isSelected ? 'text-cyan-400' : 'text-slate-500'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{voice.voice_name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {voice.metadata?.gender && (
                          <span className="text-xs text-slate-500">{voice.metadata.gender}</span>
                        )}
                        {voice.metadata?.accent && (
                          <span className="text-xs text-slate-500">{voice.metadata.accent}</span>
                        )}
                        {voice.metadata?.use_case && (
                          <span className="text-xs text-slate-600">{voice.metadata.use_case}</span>
                        )}
                      </div>
                    </div>
                    {(voice.metadata?.preview_url || orgId) && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          handlePreview(voice.voice_id);
                        }}
                        className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-colors shrink-0"
                      >
                        {isLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : isPlaying ? (
                          <Pause className="w-3.5 h-3.5" />
                        ) : (
                          <Play className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
            {filteredOpenAIVoices.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">No voices match your search.</p>
            ) : (
              filteredOpenAIVoices.map(voice => {
                const isSelected = voiceId === voice.id;
                return (
                  <button
                    key={voice.id}
                    onClick={() => onVoiceChange(voice.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'bg-cyan-600/10 border-cyan-500/40'
                        : 'bg-slate-900/50 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-cyan-600/20' : 'bg-slate-800'
                    }`}>
                      <Volume2 className={`w-4 h-4 ${isSelected ? 'text-cyan-400' : 'text-slate-500'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white">{voice.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{voice.description}</div>
                    </div>
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}

        {voiceId && (
          <div className="mt-3 px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg">
            <span className="text-xs text-slate-500">Selected: </span>
            <span className="text-xs text-cyan-400 font-mono">{voiceId}</span>
          </div>
        )}
      </div>
    </div>
  );
}
