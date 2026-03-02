import { useRef, useCallback } from 'react';

export interface SegmentRecorderState {
  isRecording: boolean;
  startSegment: (stream: MediaStream) => void;
  stopSegment: () => Promise<Blob>;
  cancelSegment: () => void;
  getPartialBlob: () => Blob | null;
}

export function useSegmentRecorder(): SegmentRecorderState {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const isRecordingRef = useRef(false);
  const resolveRef = useRef<((blob: Blob) => void) | null>(null);

  const getMimeType = (): string => {
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      return 'audio/webm;codecs=opus';
    }
    return 'audio/webm';
  };

  const startSegment = useCallback((stream: MediaStream) => {
    if (isRecordingRef.current) return;

    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType: getMimeType() });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
      isRecordingRef.current = false;
      if (resolveRef.current) {
        resolveRef.current(blob);
        resolveRef.current = null;
      }
    };

    recorderRef.current = recorder;
    isRecordingRef.current = true;
    recorder.start(250);
  }, []);

  const stopSegment = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state !== 'recording') {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        isRecordingRef.current = false;
        resolve(blob);
        return;
      }

      resolveRef.current = resolve;
      recorder.stop();
    });
  }, []);

  const cancelSegment = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state === 'recording') {
      recorder.onstop = null;
      recorder.stop();
    }
    chunksRef.current = [];
    isRecordingRef.current = false;
    resolveRef.current = null;
    recorderRef.current = null;
  }, []);

  const getPartialBlob = useCallback((): Blob | null => {
    if (chunksRef.current.length === 0) return null;
    return new Blob(chunksRef.current, { type: getMimeType() });
  }, []);

  return {
    isRecording: isRecordingRef.current,
    startSegment,
    stopSegment,
    cancelSegment,
    getPartialBlob,
  };
}
