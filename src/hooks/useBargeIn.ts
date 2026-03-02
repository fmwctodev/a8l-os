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

  useEffect(() => {
    if (!enabled || !stream || !isSpeaking) {
      vad.stop();
      return;
    }

    interruptedRef.current = false;
    vad.setMode('speaking');
    vad.start(stream);

    return () => {
      vad.stop();
    };
  }, [enabled, stream, isSpeaking, vad]);

  return { isActive: enabled && isSpeaking };
}
