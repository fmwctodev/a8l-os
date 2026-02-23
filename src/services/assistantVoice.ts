import { fetchEdge, callEdgeFunction } from '../lib/edgeFunction';
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
