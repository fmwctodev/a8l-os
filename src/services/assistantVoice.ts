import { fetchEdge, callEdgeFunction, streamEdgeFunction, parseSSEStream } from '../lib/edgeFunction';
import type { ClaraPageContext, ClaraVoiceResponse } from '../types/assistant';

export async function transcribeAndRespond(
  threadId: string,
  audioBlob: Blob,
  context: ClaraPageContext
): Promise<ClaraVoiceResponse> {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');
  formData.append('thread_id', threadId);
  formData.append('context', JSON.stringify(context));

  const response = await fetchEdge('assistant-voice', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Voice processing failed');
  }

  return response.json();
}

export async function textToSpeech(
  text: string,
  voiceId: string,
  speechRate: number = 1.0
): Promise<Blob> {
  const response = await callEdgeFunction('assistant-tts', {
    text,
    voice_id: voiceId,
    speech_rate: speechRate,
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Text-to-speech failed');
  }

  return response.blob();
}

export async function transcribeWake(audioBlob: Blob): Promise<{ text: string }> {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'wake-segment.webm');

  const response = await fetchEdge('assistant-stt-wake', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Wake STT failed: ${response.status}`);
  }

  return response.json();
}

export async function transcribeFinal(audioBlob: Blob): Promise<{ text: string; confidence?: number }> {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'command.webm');

  const response = await fetchEdge('assistant-stt-final', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Transcription failed');
  }

  return response.json();
}

export interface StreamingTTSController {
  start: (chunks: string[]) => Promise<void>;
  onAudioChunk: (cb: (chunk: ArrayBuffer) => void) => void;
  onDone: (cb: () => void) => void;
  onError: (cb: (msg: string) => void) => void;
  cancel: () => void;
}

export function createStreamingTTS(
  voiceId: string,
  speechRate: number = 1.0
): StreamingTTSController {
  let audioCb: ((chunk: ArrayBuffer) => void) | null = null;
  let doneCb: (() => void) | null = null;
  let errorCb: ((msg: string) => void) | null = null;
  let aborted = false;
  let abortReader: (() => void) | null = null;

  return {
    onAudioChunk(cb) { audioCb = cb; },
    onDone(cb) { doneCb = cb; },
    onError(cb) { errorCb = cb; },

    cancel() {
      aborted = true;
      abortReader?.();
    },

    async start(chunks: string[]) {
      if (aborted || chunks.length === 0) {
        doneCb?.();
        return;
      }

      try {
        const response = await streamEdgeFunction('assistant-tts-stream', {
          voice_id: voiceId,
          speech_rate: speechRate,
          text_chunks: chunks,
        });

        if (!response.ok) {
          let errMsg = 'TTS streaming failed';
          try {
            const err = await response.json();
            if (typeof err.error === 'string') errMsg = err.error;
          } catch { /* not JSON */ }
          errorCb?.(errMsg);
          doneCb?.();
          return;
        }

        const reader = response.body!.getReader();
        abortReader = () => reader.cancel();

        for await (const evt of parseSSEStream(reader)) {
          if (aborted) break;

          if (evt.type === 'audio' && typeof evt.chunk === 'string') {
            const binary = atob(evt.chunk as string);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
              bytes[i] = binary.charCodeAt(i);
            }
            audioCb?.(bytes.buffer);
          } else if (evt.type === 'error') {
            errorCb?.(evt.message as string);
          } else if (evt.type === 'done') {
            break;
          }
        }
      } catch (err) {
        if (!aborted) {
          errorCb?.(err instanceof Error ? err.message : 'TTS error');
        }
      }

      if (!aborted) {
        doneCb?.();
      }
    },
  };
}

export async function cancelTTS(messageId?: string): Promise<{ canceled: boolean }> {
  const response = await fetchEdge('assistant-tts', {
    method: 'POST',
    path: '/cancel',
    body: { message_id: messageId || null },
  });

  if (!response.ok) {
    return { canceled: false };
  }

  return response.json();
}
