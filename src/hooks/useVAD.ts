import { useRef, useCallback, useState } from 'react';

export type VADMode = 'passive' | 'active' | 'speaking';

export interface VADOptions {
  startSpeechThreshold?: number;
  endSpeechSilenceMs?: number;
  bargeInDelayMs?: number;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  onBargeIn?: () => void;
}

export interface VADState {
  isSpeaking: boolean;
  rmsLevel: number;
  start: (stream: MediaStream) => void;
  stop: () => void;
  setMode: (mode: VADMode) => void;
}

export function useVAD(options: VADOptions = {}): VADState {
  const {
    startSpeechThreshold = 0.015,
    endSpeechSilenceMs = 700,
    bargeInDelayMs = 150,
    onSpeechStart,
    onSpeechEnd,
    onBargeIn,
  } = options;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [rmsLevel, setRmsLevel] = useState(0);

  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);
  const modeRef = useRef<VADMode>('passive');
  const speechActiveRef = useRef(false);
  const speechStartTimeRef = useRef(0);
  const silenceStartRef = useRef(0);
  const callbacksRef = useRef({ onSpeechStart, onSpeechEnd, onBargeIn });
  callbacksRef.current = { onSpeechStart, onSpeechEnd, onBargeIn };

  const thresholdRef = useRef(startSpeechThreshold);
  const silenceMsRef = useRef(endSpeechSilenceMs);
  const bargeInMsRef = useRef(bargeInDelayMs);
  thresholdRef.current = startSpeechThreshold;
  silenceMsRef.current = endSpeechSilenceMs;
  bargeInMsRef.current = bargeInDelayMs;

  const tick = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const buffer = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buffer);

    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    const rms = Math.sqrt(sum / buffer.length);
    setRmsLevel(rms);

    const now = performance.now();
    const aboveThreshold = rms > thresholdRef.current;
    const mode = modeRef.current;

    if (mode === 'speaking') {
      if (aboveThreshold) {
        if (!speechActiveRef.current) {
          speechActiveRef.current = true;
          speechStartTimeRef.current = now;
        } else if (now - speechStartTimeRef.current > bargeInMsRef.current) {
          callbacksRef.current.onBargeIn?.();
          speechActiveRef.current = false;
        }
      } else {
        speechActiveRef.current = false;
      }
    } else {
      if (aboveThreshold) {
        if (!speechActiveRef.current) {
          speechActiveRef.current = true;
          speechStartTimeRef.current = now;
          silenceStartRef.current = 0;
          setIsSpeaking(true);
          callbacksRef.current.onSpeechStart?.();
        }
        silenceStartRef.current = 0;
      } else if (speechActiveRef.current) {
        if (silenceStartRef.current === 0) {
          silenceStartRef.current = now;
        } else if (now - silenceStartRef.current > silenceMsRef.current) {
          speechActiveRef.current = false;
          silenceStartRef.current = 0;
          setIsSpeaking(false);
          callbacksRef.current.onSpeechEnd?.();
        }
      }
    }

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const start = useCallback((stream: MediaStream) => {
    if (ctxRef.current) return;

    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);

    ctxRef.current = ctx;
    sourceRef.current = source;
    analyserRef.current = analyser;

    speechActiveRef.current = false;
    silenceStartRef.current = 0;

    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const stop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }

    sourceRef.current?.disconnect();
    sourceRef.current = null;
    analyserRef.current = null;

    if (ctxRef.current && ctxRef.current.state !== 'closed') {
      ctxRef.current.close();
    }
    ctxRef.current = null;

    speechActiveRef.current = false;
    silenceStartRef.current = 0;
    setIsSpeaking(false);
    setRmsLevel(0);
  }, []);

  const setMode = useCallback((mode: VADMode) => {
    modeRef.current = mode;
    speechActiveRef.current = false;
    silenceStartRef.current = 0;
  }, []);

  return { isSpeaking, rmsLevel, start, stop, setMode };
}
