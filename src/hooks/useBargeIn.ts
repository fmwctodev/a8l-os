import { useRef, useCallback, useEffect } from 'react';
import { useVAD } from './useVAD';
import { cancelTTS } from '../services/assistantVoice';
import { playInterruptChime } from '../utils/audioChime';

export interface BargeInOptions {
  enabled: boolean;
  stream: MediaStream | null;
  isSpeaking: boolean;
  onInterrupted: () => void;
  stopPlayer: () => void;
  currentMessageId?: string | null;
}

export interface BargeInState {
  isActive: boolean;
  rmsLevel: number;
}

export function useBargeIn(options: BargeInOptions): BargeInState {
  const { enabled, stream, isSpeaking, onInterrupted, stopPlayer, currentMessageId } = options;
  const callbackRef = useRef(onInterrupted);
  callbackRef.current = onInterrupted;
  const stopPlayerRef = useRef(stopPlayer);
  stopPlayerRef.current = stopPlayer;
  const messageIdRef = useRef(currentMessageId);
  messageIdRef.current = currentMessageId;
  const interruptedRef = useRef(false);

  const handleBargeIn = useCallback(() => {
    if (interruptedRef.current) return;
    interruptedRef.current = true;

    stopPlayerRef.current();
    playInterruptChime();

    cancelTTS(messageIdRef.current || undefined).catch(() => {});

    callbackRef.current();
  }, []);

  const vad = useVAD({
    startSpeechThreshold: 0.02,
    bargeInDelayMs: 150,
    onBargeIn: handleBargeIn,
  });

  const vadStart = vad.start;
  const vadStop = vad.stop;
  const vadSetMode = vad.setMode;

  useEffect(() => {
    if (!enabled || !stream || !isSpeaking) {
      vadStop();
      return;
    }

    interruptedRef.current = false;
    vadSetMode('speaking');
    vadStart(stream);

    return () => {
      vadStop();
    };
  }, [enabled, stream, isSpeaking, vadStart, vadStop, vadSetMode]);

  return { isActive: enabled && isSpeaking, rmsLevel: vad.rmsLevel };
}
