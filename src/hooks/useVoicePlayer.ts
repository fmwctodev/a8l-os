import { useState, useRef, useCallback, useEffect } from 'react';

export function useVoicePlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const callbackRef = useRef<(() => void) | null>(null);
  const rafRef = useRef<number>(0);

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    cancelAnimationFrame(rafRef.current);
    setIsPlaying(false);
    setProgress(0);
    setDuration(0);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const tick = useCallback(() => {
    if (audioRef.current) {
      setProgress(audioRef.current.currentTime);
      if (!audioRef.current.paused) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }
  }, []);

  const play = useCallback((source: Blob | string, onEnd?: () => void) => {
    cleanup();
    callbackRef.current = onEnd || null;

    const audio = new Audio();
    audioRef.current = audio;

    if (source instanceof Blob) {
      urlRef.current = URL.createObjectURL(source);
      audio.src = urlRef.current;
    } else {
      audio.src = source;
    }

    audio.onloadedmetadata = () => {
      setDuration(audio.duration);
    };

    audio.onplay = () => {
      setIsPlaying(true);
      rafRef.current = requestAnimationFrame(tick);
    };

    audio.onended = () => {
      setIsPlaying(false);
      callbackRef.current?.();
      callbackRef.current = null;
    };

    audio.onerror = () => {
      setIsPlaying(false);
      callbackRef.current?.();
      callbackRef.current = null;
    };

    audio.play().catch(() => {
      setIsPlaying(false);
    });
  }, [cleanup, tick]);

  const stop = useCallback(() => {
    cleanup();
    callbackRef.current?.();
    callbackRef.current = null;
  }, [cleanup]);

  const setPlaybackRate = useCallback((rate: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  }, []);

  return {
    isPlaying,
    progress,
    duration,
    play,
    stop,
    setPlaybackRate,
  };
}
