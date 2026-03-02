import { useState, useCallback, useRef, useEffect } from 'react';
import { Mic, MicOff, Square, Volume2, Trash2 } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useAssistant } from '../../../contexts/AssistantContext';
import { useVoiceRecorder } from '../../../hooks/useVoiceRecorder';
import { useVoicePlayer } from '../../../hooks/useVoicePlayer';
import { transcribeAndRespond } from '../../../services/assistantVoice';
import { textToSpeech } from '../../../services/assistantVoice';
import { createThread } from '../../../services/assistantChat';
import { VoiceOrb } from './VoiceOrb';

type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking';

export function AssistantVoiceView() {
  const { user } = useAuth();
  const {
    activeThreadId,
    setActiveThread,
    pageContext,
    profile,
    setVoiceActive,
    voiceHistory,
    addVoiceExchange,
    clearVoiceHistory,
  } = useAssistant();
  const recorder = useVoiceRecorder();
  const player = useVoicePlayer();

  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVoiceActive(voiceState !== 'idle');
  }, [voiceState, setVoiceActive]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [voiceHistory.length, transcript, response]);

  const handlePush = useCallback(async () => {
    if (voiceState !== 'idle' || !user) return;
    setError(null);
    setTranscript('');
    setResponse('');
    abortRef.current = false;

    await recorder.startRecording();
    setVoiceState('listening');
  }, [voiceState, user, recorder]);

  const handleRelease = useCallback(async () => {
    if (voiceState !== 'listening' || !user) return;
    setVoiceState('processing');

    const blob = await recorder.stopRecording();
    if (!blob || abortRef.current) {
      setVoiceState('idle');
      return;
    }

    try {
      let threadId = activeThreadId;
      if (!threadId) {
        const thread = await createThread(
          user.id,
          user.organization_id,
          pageContext.current_module,
          pageContext.current_record_id
        );
        threadId = thread.id;
        setActiveThread(thread.id);
      }

      const result = await transcribeAndRespond(threadId, blob, pageContext);
      if (abortRef.current) { setVoiceState('idle'); return; }

      setTranscript(result.transcription);
      setResponse(result.response);
      addVoiceExchange(result.transcription, result.response);

      if (profile?.voice_enabled && profile.elevenlabs_voice_id) {
        setVoiceState('speaking');
        const audioBlob = await textToSpeech(
          result.response,
          profile.elevenlabs_voice_id,
          profile.speech_rate
        );
        if (!abortRef.current) {
          player.play(audioBlob, () => setVoiceState('idle'), profile.output_volume);
        } else {
          setVoiceState('idle');
        }
      } else {
        setVoiceState('idle');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Voice processing failed');
      setVoiceState('idle');
    }
  }, [voiceState, user, recorder, activeThreadId, setActiveThread, pageContext, profile, player, addVoiceExchange]);

  const handleCancel = useCallback(() => {
    abortRef.current = true;
    recorder.cancelRecording();
    player.stop();
    setVoiceState('idle');
  }, [recorder, player]);

  const voiceEnabled = profile?.voice_enabled;

  if (!voiceEnabled) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <Volume2 className="w-8 h-8 text-slate-600 mb-3" />
        <h4 className="text-sm font-medium text-slate-300 mb-1">Voice Disabled</h4>
        <p className="text-xs text-slate-500 max-w-[240px]">
          Enable voice in Settings tab and configure an ElevenLabs voice to use voice mode.
        </p>
      </div>
    );
  }

  if (recorder.permissionStatus === 'denied') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <MicOff className="w-8 h-8 text-red-400/60 mb-3" />
        <h4 className="text-sm font-medium text-slate-300 mb-1">Microphone Blocked</h4>
        <p className="text-xs text-slate-500 max-w-[240px]">
          Please allow microphone access in your browser settings to use voice mode.
        </p>
      </div>
    );
  }

  const stateLabels: Record<VoiceState, string> = {
    idle: 'Hold to speak',
    listening: 'Listening...',
    processing: 'Processing...',
    speaking: 'Speaking...',
  };

  const hasHistory = voiceHistory.length > 0;
  const showCurrentExchange = (transcript || response) && voiceState !== 'idle';

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {hasHistory && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-700/40">
          <span className="text-[10px] text-slate-500 font-medium">
            {voiceHistory.length} exchange{voiceHistory.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={clearVoiceHistory}
            className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            Clear
          </button>
        </div>
      )}

      <div
        ref={scrollRef}
        className={`overflow-y-auto px-3 scrollbar-thin ${hasHistory ? 'flex-1 py-3 space-y-3' : ''}`}
      >
        {voiceHistory.map((exchange) => (
          <div key={exchange.id} className="space-y-1.5">
            <div className="ml-auto max-w-[280px] px-3 py-2 bg-cyan-600/10 border border-cyan-500/20 rounded-lg">
              <p className="text-[10px] text-cyan-400/70 font-medium mb-0.5">You</p>
              <p className="text-xs text-slate-300">{exchange.transcript}</p>
            </div>
            <div className="mr-auto max-w-[280px] px-3 py-2 bg-slate-800 border border-slate-700/50 rounded-lg">
              <p className="text-[10px] text-teal-400/70 font-medium mb-0.5">Clara</p>
              <p className="text-xs text-slate-300 whitespace-pre-wrap">{exchange.response}</p>
            </div>
          </div>
        ))}

        {showCurrentExchange && (
          <div className="space-y-1.5">
            {transcript && (
              <div className="ml-auto max-w-[280px] px-3 py-2 bg-cyan-600/10 border border-cyan-500/20 rounded-lg">
                <p className="text-[10px] text-cyan-400/70 font-medium mb-0.5">You</p>
                <p className="text-xs text-slate-300">{transcript}</p>
              </div>
            )}
            {response && (
              <div className="mr-auto max-w-[280px] px-3 py-2 bg-slate-800 border border-slate-700/50 rounded-lg">
                <p className="text-[10px] text-teal-400/70 font-medium mb-0.5">Clara</p>
                <p className="text-xs text-slate-300 whitespace-pre-wrap">{response}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col items-center py-4 px-4 border-t border-slate-700/40 bg-slate-900/60">
        <div className="relative flex items-center justify-center mb-3">
          <VoiceOrb state={voiceState} />

          {voiceState === 'idle' && (
            <button
              onMouseDown={handlePush}
              onMouseUp={handleRelease}
              onTouchStart={handlePush}
              onTouchEnd={handleRelease}
              className="absolute inset-0 flex items-center justify-center cursor-pointer"
            >
              <div className="w-16 h-16 rounded-full bg-cyan-600/20 border-2 border-cyan-500/40 flex items-center justify-center hover:bg-cyan-600/30 transition-colors">
                <Mic className="w-6 h-6 text-cyan-400" />
              </div>
            </button>
          )}

          {voiceState === 'listening' && (
            <button
              onMouseUp={handleRelease}
              onTouchEnd={handleRelease}
              className="absolute inset-0 flex items-center justify-center cursor-pointer"
            >
              <div className="w-16 h-16 rounded-full bg-cyan-500/30 border-2 border-cyan-400 flex items-center justify-center animate-pulse">
                <Mic className="w-6 h-6 text-white" />
              </div>
            </button>
          )}

          {(voiceState === 'processing' || voiceState === 'speaking') && (
            <button
              onClick={handleCancel}
              className="absolute inset-0 flex items-center justify-center cursor-pointer"
            >
              <div className="w-12 h-12 rounded-full bg-slate-700/60 border border-slate-600 flex items-center justify-center hover:bg-slate-700 transition-colors">
                <Square className="w-4 h-4 text-slate-300" />
              </div>
            </button>
          )}
        </div>

        <p className="text-xs text-slate-400 font-medium">{stateLabels[voiceState]}</p>

        {error && (
          <p className="text-[10px] text-red-400 mt-2 text-center max-w-[280px]">{error}</p>
        )}
      </div>
    </div>
  );
}
