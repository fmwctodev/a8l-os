import { useState, useRef, useCallback, useEffect } from 'react';

interface StreamingPlayerState {
  isPlaying: boolean;
  enqueue: (chunk: ArrayBuffer) => void;
  finalize: () => void;
  stop: () => void;
  setVolume: (v: number) => void;
}

export function useStreamingPlayer(onFinished?: () => void): StreamingPlayerState {
  const [isPlaying, setIsPlaying] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const queueRef = useRef<AudioBuffer[]>([]);
  const scheduledEndRef = useRef(0);
  const playingCountRef = useRef(0);
  const finalizedRef = useRef(false);
  const stoppedRef = useRef(false);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  const getContext = useCallback(() => {
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new AudioContext();
      gainRef.current = ctxRef.current.createGain();
      gainRef.current.connect(ctxRef.current.destination);
    }
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  const checkDone = useCallback(() => {
    if (finalizedRef.current && playingCountRef.current <= 0 && queueRef.current.length === 0) {
      setIsPlaying(false);
      onFinishedRef.current?.();
    }
  }, []);

  const scheduleNext = useCallback(() => {
    if (stoppedRef.current) return;
    const ctx = getContext();
    const gain = gainRef.current;
    if (!gain) return;

    while (queueRef.current.length > 0) {
      const buffer = queueRef.current.shift()!;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(gain);

      const startAt = Math.max(ctx.currentTime, scheduledEndRef.current);
      source.start(startAt);
      scheduledEndRef.current = startAt + buffer.duration;
      playingCountRef.current++;
      setIsPlaying(true);

      source.onended = () => {
        playingCountRef.current--;
        checkDone();
      };
    }
  }, [getContext, checkDone]);

  const enqueue = useCallback((chunk: ArrayBuffer) => {
    if (stoppedRef.current) return;
    const ctx = getContext();
    ctx.decodeAudioData(chunk.slice(0))
      .then((decoded) => {
        if (stoppedRef.current) return;
        queueRef.current.push(decoded);
        scheduleNext();
      })
      .catch(() => {});
  }, [getContext, scheduleNext]);

  const finalize = useCallback(() => {
    finalizedRef.current = true;
    if (playingCountRef.current <= 0 && queueRef.current.length === 0) {
      setIsPlaying(false);
      onFinishedRef.current?.();
    }
  }, []);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    queueRef.current = [];
    playingCountRef.current = 0;
    finalizedRef.current = false;
    scheduledEndRef.current = 0;
    if (ctxRef.current && ctxRef.current.state !== 'closed') {
      ctxRef.current.close().catch(() => {});
      ctxRef.current = null;
      gainRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const reset = useCallback(() => {
    stoppedRef.current = false;
    finalizedRef.current = false;
    scheduledEndRef.current = 0;
    playingCountRef.current = 0;
    queueRef.current = [];
  }, []);

  const setVolume = useCallback((v: number) => {
    if (gainRef.current) {
      gainRef.current.gain.value = Math.max(0, Math.min(1, v));
    }
  }, []);

  useEffect(() => {
    return () => {
      if (ctxRef.current && ctxRef.current.state !== 'closed') {
        ctxRef.current.close().catch(() => {});
      }
    };
  }, []);

  const enqueueWithReset = useCallback((chunk: ArrayBuffer) => {
    if (stoppedRef.current) {
      reset();
    }
    enqueue(chunk);
  }, [enqueue, reset]);

  return { isPlaying, enqueue: enqueueWithReset, finalize, stop, setVolume };
}
