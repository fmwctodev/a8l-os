import { useRef, useState, useCallback, useEffect } from 'react';

export type MicPermissionStatus = 'prompt' | 'granted' | 'denied';

export interface PersistentMicState {
  stream: MediaStream | null;
  permissionStatus: MicPermissionStatus;
  requestMic: () => Promise<MediaStream | null>;
  releaseMic: () => void;
}

export function usePersistentMic(): PersistentMicState {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<MicPermissionStatus>('prompt');
  const streamRef = useRef<MediaStream | null>(null);

  const requestMic = useCallback(async (): Promise<MediaStream | null> => {
    if (streamRef.current && streamRef.current.active) {
      return streamRef.current;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setPermissionStatus('granted');
      return mediaStream;
    } catch {
      setPermissionStatus('denied');
      return null;
    }
  }, []);

  const releaseMic = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      setStream(null);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  return { stream, permissionStatus, requestMic, releaseMic };
}
