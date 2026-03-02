import { useState, useCallback, useRef, useEffect } from 'react';
import { Mic, MicOff, Square, Volume2, Trash2, Radio, Hand } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useAssistant } from '../../../contexts/AssistantContext';
import { usePersistentMic } from '../../../hooks/usePersistentMic';
import { useVAD } from '../../../hooks/useVAD';
import { useSegmentRecorder } from '../../../hooks/useSegmentRecorder';
import { useVoicePlayer } from '../../../hooks/useVoicePlayer';
import { transcribeWake, transcribeFinal, textToSpeech, cancelTTS } from '../../../services/assistantVoice';
import { sendMessage, createThread } from '../../../services/assistantChat';
import { logVoiceEvent } from '../../../services/claraVoiceEvents';
import { playWakeChime, playInterruptChime } from '../../../utils/audioChime';
import { VoiceOrb } from './VoiceOrb';
import type { ClaraVoiceMode } from '../../../types/assistant';

export function AssistantVoiceView() {
  const { user } = useAuth();
  const {
    activeThreadId,
    setActiveThread,
    pageContext,
    profile,
    setVoiceActive,
    voiceMode,
    setVoiceMode,
    micEnabled,
    setMicEnabled,
    voiceHistory,
    addVoiceExchange,
    clearVoiceHistory,
  } = useAssistant();

  const mic = usePersistentMic();
  const player = useVoicePlayer();
  const commandRecorder = useSegmentRecorder();
  const wakeRecorder = useSegmentRecorder();

  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [holdActive, setHoldActive] = useState(false);

  const abortRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentMessageIdRef = useRef<string | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);

  const wakeEnabled = profile?.wake_word_enabled ?? true;
  const bargeInEnabled = profile?.barge_in_enabled ?? true;
  const wakePhrase = (profile?.wake_word || 'clara').toLowerCase();

  useEffect(() => {
    setVoiceActive(voiceMode !== 'idle');
  }, [voiceMode, setVoiceActive]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [voiceHistory.length, transcript, response]);

  const defaultMode = useCallback((): ClaraVoiceMode => {
    return micEnabled && wakeEnabled ? 'passive_listening' : 'idle';
  }, [micEnabled, wakeEnabled]);

  const processCommand = useCallback(async (audioBlob: Blob, prefillText?: string) => {
    if (!user) return;
    setVoiceMode('processing');
    setError(null);

    try {
      let text = prefillText;
      if (!text) {
        const result = await transcribeFinal(audioBlob);
        text = result.text?.trim();
      }

      if (!text) {
        setVoiceMode(defaultMode());
        return;
      }

      setTranscript(text);
      if (profile) {
        logVoiceEvent(user.id, profile.org_id, 'command_sent');
      }

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

      const chatResult = await sendMessage(threadId, text, pageContext);
      if (abortRef.current) {
        setVoiceMode('idle');
        return;
      }

      setResponse(chatResult.response);
      addVoiceExchange(text, chatResult.response);

      if (profile?.voice_enabled && profile.elevenlabs_voice_id) {
        setVoiceMode('speaking');
        if (profile) {
          logVoiceEvent(user.id, profile.org_id, 'tts_started');
        }

        const controller = new AbortController();
        ttsAbortRef.current = controller;

        const ttsBlob = await textToSpeech(
          chatResult.response,
          profile.elevenlabs_voice_id,
          profile.speech_rate
        );

        if (controller.signal.aborted || abortRef.current) {
          setVoiceMode('idle');
          return;
        }

        player.play(ttsBlob, () => {
          if (profile) {
            logVoiceEvent(user.id, profile.org_id, 'tts_finished');
          }
          setVoiceMode(defaultMode());
        }, profile.output_volume);
      } else {
        setVoiceMode(defaultMode());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Voice processing failed');
      setVoiceMode(defaultMode());
    }
  }, [user, profile, activeThreadId, setActiveThread, pageContext, player, addVoiceExchange, setVoiceMode, defaultMode]);

  const handleCommandSpeechEnd = useCallback(async () => {
    try {
      const blob = await commandRecorder.stopSegment();
      if (blob.size < 500) {
        setVoiceMode(defaultMode());
        return;
      }
      processCommand(blob);
    } catch {
      setVoiceMode(defaultMode());
    }
  }, [commandRecorder, processCommand, setVoiceMode, defaultMode]);

  const commandVad = useVAD({
    startSpeechThreshold: 0.015,
    endSpeechSilenceMs: 700,
    onSpeechEnd: handleCommandSpeechEnd,
  });

  const startActiveListening = useCallback((stream: MediaStream) => {
    setVoiceMode('active_listening');
    commandRecorder.startSegment(stream);
    commandVad.setMode('active');
    commandVad.start(stream);
  }, [commandRecorder, commandVad, setVoiceMode]);

  const handleBargeIn = useCallback(() => {
    if (!bargeInEnabled) return;
    player.stop();
    ttsAbortRef.current?.abort();
    playInterruptChime();
    if (user && profile) {
      cancelTTS(currentMessageIdRef.current || undefined).catch(() => {});
      logVoiceEvent(user.id, profile.org_id, 'tts_interrupted', currentMessageIdRef.current);
    }
    setVoiceMode('interrupted');
    setTimeout(() => {
      if (mic.stream) {
        startActiveListening(mic.stream);
      }
    }, 100);
  }, [bargeInEnabled, player, mic.stream, user, profile, setVoiceMode, startActiveListening]);

  const speakingVad = useVAD({
    startSpeechThreshold: 0.02,
    bargeInDelayMs: 150,
    onBargeIn: handleBargeIn,
  });

  useEffect(() => {
    if (voiceMode === 'speaking' && bargeInEnabled && mic.stream) {
      speakingVad.setMode('speaking');
      speakingVad.start(mic.stream);
      return () => speakingVad.stop();
    }
  }, [voiceMode, bargeInEnabled, mic.stream]);

  const handleWakeSpeechStart = useCallback(() => {
    if (voiceMode !== 'passive_listening' || !mic.stream) return;
    wakeRecorder.startSegment(mic.stream);
  }, [voiceMode, mic.stream, wakeRecorder]);

  const handleWakeSpeechEnd = useCallback(async () => {
    try {
      const blob = await wakeRecorder.stopSegment();
      if (blob.size < 500) return;

      const result = await transcribeWake(blob);
      const text = (result.text || '').toLowerCase().trim();
      if (!text) return;

      const idx = text.indexOf(wakePhrase);
      if (idx === -1) return;

      playWakeChime();
      if (user && profile) {
        logVoiceEvent(user.id, profile.org_id, 'wake_detected');
      }

      const afterWake = text.slice(idx + wakePhrase.length).trim();

      if (afterWake.length > 2) {
        processCommand(new Blob([], { type: 'audio/webm' }), afterWake);
        return;
      }

      if (mic.stream) {
        startActiveListening(mic.stream);
      }
    } catch {
      // Swallow wake detection errors
    }
  }, [wakePhrase, user, profile, mic.stream, wakeRecorder, processCommand, startActiveListening]);

  const wakeVad = useVAD({
    startSpeechThreshold: 0.015,
    endSpeechSilenceMs: 700,
    onSpeechStart: handleWakeSpeechStart,
    onSpeechEnd: handleWakeSpeechEnd,
  });

  useEffect(() => {
    if (voiceMode === 'passive_listening' && mic.stream) {
      wakeVad.setMode('passive');
      wakeVad.start(mic.stream);
      return () => wakeVad.stop();
    }
  }, [voiceMode, mic.stream]);

  const rmsLevel = voiceMode === 'active_listening' ? commandVad.rmsLevel : wakeVad.rmsLevel;

  const toggleMic = useCallback(async () => {
    if (micEnabled) {
      abortRef.current = true;
      player.stop();
      commandVad.stop();
      wakeVad.stop();
      speakingVad.stop();
      commandRecorder.cancelSegment();
      wakeRecorder.cancelSegment();
      mic.releaseMic();
      setMicEnabled(false);
      setVoiceMode('idle');
      abortRef.current = false;
      return;
    }

    const stream = await mic.requestMic();
    if (!stream) {
      if (user && profile) {
        logVoiceEvent(user.id, profile.org_id, 'mic_denied');
      }
      setError('Microphone access denied. Please check browser permissions.');
      return;
    }

    setMicEnabled(true);
    setError(null);
    abortRef.current = false;

    if (wakeEnabled) {
      setVoiceMode('passive_listening');
    }
  }, [micEnabled, mic, player, commandVad, wakeVad, speakingVad, commandRecorder, wakeRecorder, setMicEnabled, wakeEnabled, user, profile, setVoiceMode]);

  const handleHoldStart = useCallback(async () => {
    if (!user) return;
    setHoldActive(true);
    setError(null);
    setTranscript('');
    setResponse('');
    abortRef.current = false;

    let stream = mic.stream;
    if (!stream) {
      stream = await mic.requestMic();
      if (!stream) {
        setHoldActive(false);
        setError('Microphone access denied.');
        return;
      }
    }

    startActiveListening(stream);
  }, [user, mic, startActiveListening]);

  const handleHoldEnd = useCallback(() => {
    if (!holdActive) return;
    setHoldActive(false);
    commandVad.stop();
    handleCommandSpeechEnd();
  }, [holdActive, commandVad, handleCommandSpeechEnd]);

  const handleCancel = useCallback(() => {
    abortRef.current = true;
    player.stop();
    commandVad.stop();
    speakingVad.stop();
    commandRecorder.cancelSegment();
    ttsAbortRef.current?.abort();
    setTranscript('');
    setResponse('');
    setVoiceMode(defaultMode());
  }, [player, commandVad, speakingVad, commandRecorder, setVoiceMode, defaultMode]);

  if (!profile?.voice_enabled) {
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

  if (mic.permissionStatus === 'denied') {
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

  const stateLabels: Record<ClaraVoiceMode, string> = {
    idle: 'Mic off',
    passive_listening: 'Listening for "Clara"...',
    active_listening: 'Listening...',
    processing: 'Processing...',
    speaking: 'Speaking...',
    interrupted: 'Interrupted',
  };

  const hasHistory = voiceHistory.length > 0;
  const showCurrentExchange = (transcript || response) && voiceMode !== 'idle' && voiceMode !== 'passive_listening';

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/40">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMic}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
              micEnabled
                ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                : 'bg-slate-700/50 text-slate-400 border border-slate-600/50 hover:border-slate-500'
            }`}
          >
            {micEnabled ? <Radio className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
            {micEnabled ? 'Mic On' : 'Mic Off'}
          </button>
          {micEnabled && voiceMode === 'passive_listening' && (
            <span className="flex items-center gap-1 text-[10px] text-teal-400/70">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400/60 animate-pulse" />
              Wake word active
            </span>
          )}
        </div>
        {hasHistory && (
          <button
            onClick={clearVoiceHistory}
            className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      <div
        ref={scrollRef}
        className={`overflow-y-auto px-3 scrollbar-thin ${hasHistory || showCurrentExchange ? 'flex-1 py-3 space-y-3' : ''}`}
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
          <VoiceOrb state={voiceMode} rmsLevel={rmsLevel} />

          {(voiceMode === 'idle' || voiceMode === 'passive_listening') && (
            <button
              onMouseDown={handleHoldStart}
              onMouseUp={handleHoldEnd}
              onMouseLeave={handleHoldEnd}
              onTouchStart={handleHoldStart}
              onTouchEnd={handleHoldEnd}
              className="absolute inset-0 flex items-center justify-center cursor-pointer"
            >
              <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${
                holdActive
                  ? 'bg-cyan-500/30 border-2 border-cyan-400 animate-pulse'
                  : 'bg-cyan-600/20 border-2 border-cyan-500/40 hover:bg-cyan-600/30'
              }`}>
                {holdActive ? (
                  <Mic className="w-6 h-6 text-white" />
                ) : (
                  <Hand className="w-5 h-5 text-cyan-400" />
                )}
              </div>
            </button>
          )}

          {voiceMode === 'active_listening' && !holdActive && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-cyan-500/30 border-2 border-cyan-400 flex items-center justify-center animate-pulse">
                <Mic className="w-6 h-6 text-white" />
              </div>
            </div>
          )}

          {(voiceMode === 'processing' || voiceMode === 'speaking') && (
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

        <p className="text-xs text-slate-400 font-medium">{stateLabels[voiceMode]}</p>
        {voiceMode === 'idle' && !micEnabled && (
          <p className="text-[10px] text-slate-500 mt-1">Hold to talk, or toggle mic for wake word</p>
        )}
        {voiceMode === 'passive_listening' && (
          <p className="text-[10px] text-slate-500 mt-1">Say "Clara" or hold button to talk</p>
        )}

        {error && (
          <p className="text-[10px] text-red-400 mt-2 text-center max-w-[280px]">{error}</p>
        )}
      </div>
    </div>
  );
}
