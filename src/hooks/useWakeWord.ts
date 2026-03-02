import { useRef, useCallback, useEffect } from 'react';
import { useVAD } from './useVAD';
import { useSegmentRecorder } from './useSegmentRecorder';
import { transcribeWake } from '../services/assistantVoice';
import { playWakeChime } from '../utils/audioChime';

export interface WakeWordOptions {
  enabled: boolean;
  wakePhrase?: string;
  stream: MediaStream | null;
  onWakeDetected: (commandPrefix?: string) => void;
}

export interface WakeWordState {
  isListening: boolean;
  start: () => void;
  stop: () => void;
}

export function useWakeWord(options: WakeWordOptions): WakeWordState {
  const { enabled, wakePhrase = 'clara', stream, onWakeDetected } = options;
  const processingRef = useRef(false);
  const activeRef = useRef(false);
  const callbackRef = useRef(onWakeDetected);
  callbackRef.current = onWakeDetected;
  const wakePhraseRef = useRef(wakePhrase.toLowerCase());
  wakePhraseRef.current = wakePhrase.toLowerCase();

  const segmentRecorder = useSegmentRecorder();

  const handleSpeechStart = useCallback(() => {
    if (!activeRef.current || processingRef.current || !stream) return;
    segmentRecorder.startSegment(stream);
  }, [stream, segmentRecorder]);

  const handleSpeechEnd = useCallback(async () => {
    if (!activeRef.current || processingRef.current) return;
    processingRef.current = true;

    try {
      const blob = await segmentRecorder.stopSegment();
      if (blob.size < 500) {
        processingRef.current = false;
        return;
      }

      const result = await transcribeWake(blob);
      const text = (result.text || '').toLowerCase().trim();

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
      // Swallow STT errors silently, return to passive listening
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

  const start = useCallback(() => {
    if (!enabled || !stream) return;
    activeRef.current = true;
    vad.setMode('passive');
    vad.start(stream);
  }, [enabled, stream, vad]);

  const stop = useCallback(() => {
    activeRef.current = false;
    vad.stop();
    segmentRecorder.cancelSegment();
  }, [vad, segmentRecorder]);

  useEffect(() => {
    return () => {
      activeRef.current = false;
    };
  }, []);

  return {
    isListening: activeRef.current && enabled,
    start,
    stop,
  };
}
