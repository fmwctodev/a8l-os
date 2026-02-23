import { useState, useRef, useCallback } from 'react';

type PermissionStatus = 'prompt' | 'granted' | 'denied';

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('prompt');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const resolveRef = useRef<((blob: Blob | null) => void) | null>(null);

  const requestMicPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setPermissionStatus('granted');
      return true;
    } catch {
      setPermissionStatus('denied');
      return false;
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      setPermissionStatus('granted');

      chunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        resolveRef.current?.(blob);
        resolveRef.current = null;
      };

      recorderRef.current = recorder;
      recorder.start(250);
      setIsRecording(true);
    } catch {
      setPermissionStatus('denied');
    }
  }, []);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!recorderRef.current || recorderRef.current.state !== 'recording') {
        resolve(null);
        return;
      }
      resolveRef.current = resolve;
      recorderRef.current.stop();
      setIsRecording(false);
    });
  }, []);

  const cancelRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stream.getTracks().forEach((t) => t.stop());
      recorderRef.current.stop();
    }
    resolveRef.current?.(null);
    resolveRef.current = null;
    chunksRef.current = [];
    setIsRecording(false);
  }, []);

  return {
    isRecording,
    permissionStatus,
    startRecording,
    stopRecording,
    cancelRecording,
    requestMicPermission,
  };
}
