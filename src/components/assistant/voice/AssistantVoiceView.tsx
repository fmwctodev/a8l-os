import { useState, useCallback, useRef } from 'react';
import { Mic, MicOff, Square, Volume2 } from 'lucide-react';
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
  const { activeThreadId, setActiveThread, pageContext, profile } = useAssistant();
  const recorder = useVoiceRecorder();
  const player = useVoicePlayer();

  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

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

      if (profile?.voice_enabled && profile.elevenlabs_voice_id) {
        setVoiceState('speaking');
        const audioBlob = await textToSpeech(
          result.response,
          profile.elevenlabs_voice_id,
          profile.speech_rate
        );
        if (!abortRef.current) {
          player.play(audioBlob, () => setVoiceState('idle'));
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
  }, [voiceState, user, recorder, activeThreadId, setActiveThread, pageContext, profile, player]);

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

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 min-h-0">
      <div className="relative flex items-center justify-center mb-4">
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

      <p className="text-xs text-slate-400 font-medium mb-4">{stateLabels[voiceState]}</p>

      {transcript && (
        <div className="w-full max-w-[320px] mb-2 px-3 py-2 bg-cyan-600/10 border border-cyan-500/20 rounded-lg">
          <p className="text-[10px] text-cyan-400 uppercase font-medium mb-0.5">You said</p>
          <p className="text-xs text-slate-300">{transcript}</p>
        </div>
      )}

      {response && (
        <div className="w-full max-w-[320px] px-3 py-2 bg-slate-800 border border-slate-700/50 rounded-lg">
          <p className="text-[10px] text-teal-400 uppercase font-medium mb-0.5">Clara</p>
          <p className="text-xs text-slate-300 whitespace-pre-wrap">{response}</p>
        </div>
      )}

      {error && (
        <p className="text-[10px] text-red-400 mt-2 text-center max-w-[280px]">{error}</p>
      )}
    </div>
  );
}
