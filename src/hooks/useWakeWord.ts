import { useRef, useCallback, useEffect, useState } from 'react';
import { useVAD } from './useVAD';
import { useSegmentRecorder } from './useSegmentRecorder';
import { transcribeWake } from '../services/assistantVoice';
import { playWakeChime } from '../utils/audioChime';

const MAX_CONSECUTIVE_FAILURES = 3;
const BACKOFF_PAUSE_MS = 15_000;

export interface WakeWordOptions {
  enabled: boolean;
  wakePhrase?: string;
  stream: MediaStream | null;
  onWakeDetected: (commandPrefix?: string) => void;
  onError?: (message: string) => void;
  onErrorCleared?: () => void;
}

export interface WakeWordState {
  isListening: boolean;
  rmsLevel: number;
  isPaused: boolean;
}

export function useWakeWord(options: WakeWordOptions): WakeWordState {
  const { enabled, wakePhrase = 'clara', stream, onWakeDetected, onError, onErrorCleared } = options;
  const processingRef = useRef(false);
  const callbackRef = useRef(onWakeDetected);
  callbackRef.current = onWakeDetected;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onErrorClearedRef = useRef(onErrorCleared);
  onErrorClearedRef.current = onErrorCleared;
  const wakePhraseRef = useRef(wakePhrase.toLowerCase());
  wakePhraseRef.current = wakePhrase.toLowerCase();

  const failureCountRef = useRef(0);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const segmentRecorder = useSegmentRecorder();

  const handleSpeechStart = useCallback(() => {
    if (processingRef.current || !stream) return;
    segmentRecorder.startSegment(stream);
  }, [stream, segmentRecorder]);

  const handleSpeechEnd = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      const blob = await segmentRecorder.stopSegment();
      if (blob.size < 500) {
        processingRef.current = false;
        return;
      }

      const result = await transcribeWake(blob);
      const text = (result.text || '').toLowerCase().trim();

      failureCountRef.current = 0;

      if (!text) {
        processingRef.current = false;
        return;
      }

      const phrase = wakePhraseRef.current;
      const idx = text.indexOf(phrase);

      if (idx === -1) {
        processingRef.current = false;
        return;
      }

      playWakeChime();

      const afterWake = text.slice(idx + phrase.length).trim();
      const commandPrefix = afterWake.length > 2 ? afterWake : undefined;
      callbackRef.current(commandPrefix);
    } catch {
      failureCountRef.current += 1;

      if (failureCountRef.current >= MAX_CONSECUTIVE_FAILURES) {
        setIsPaused(true);
        onErrorRef.current?.('Wake word temporarily unavailable, retrying...');

        pauseTimerRef.current = setTimeout(() => {
          failureCountRef.current = 0;
          setIsPaused(false);
          onErrorClearedRef.current?.();
        }, BACKOFF_PAUSE_MS);
      }
    } finally {
      processingRef.current = false;
    }
  }, [segmentRecorder]);

  const vad = useVAD({
    startSpeechThreshold: 0.015,
    endSpeechSilenceMs: 700,
    onSpeechStart: handleSpeechStart,
    onSpeechEnd: handleSpeechEnd,
  });

  useEffect(() => {
    if (enabled && stream && !isPaused) {
      vad.setMode('passive');
      vad.start(stream);
      return () => vad.stop();
    }
    vad.stop();
  }, [enabled, stream, isPaused, vad]);

  useEffect(() => {
    return () => {
      if (pauseTimerRef.current) {
        clearTimeout(pauseTimerRef.current);
      }
    };
  }, []);

  return {
    isListening: enabled && !!stream && !isPaused,
    rmsLevel: vad.rmsLevel,
    isPaused,
  };
}
