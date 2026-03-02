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

export async function transcribeWake(audioBlob: Blob): Promise<{ text: string }> {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'wake-segment.webm');

  const response = await fetchEdge('assistant-stt-wake', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    return { text: '' };
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
