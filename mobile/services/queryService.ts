/**
 * Query Service — API calls for text/voice queries and diagnosis.
 * Sends conversation_history for follow-up question support.
 * Passes preferred_language preference from user settings.
 */

import { apiClient } from './api';
import { useUserStore } from '@/stores/useUserStore';

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface QueryResponse {
  transcript:      string | null;
  answer_text_kn:  string;
  audio_base64:    string | null;
  sources:         string[];
  intent:          string | null;
  diagnosis:       any | null;
  is_kvk_redirect: boolean;
  error:           string | null;
}

export interface DiagnosisResponse {
  plant_health_status: string;
  disease_name:        string;
  disease_name_kn:     string;
  confidence_pct:      number;
  visual_symptoms:     string[];
  probable_cause:      string;
  organic_treatments:  string[];
  prevention_measures: string[];
  needs_retake:        boolean;
  sources:             string[];
  is_reliable:         boolean;
  summary_kn?:         string;
  audio_base64?:       string;
}

function getPreferredLanguage(): string {
  try {
    const state = useUserStore.getState();
    return state.preferred_language || state.tts_language || 'kn-IN';
  } catch {
    return 'kn-IN';
  }
}

export interface TranscribeResponse {
  transcript: string;
  language: string;
  success: boolean;
}

/**
 * Lightweight STT-only transcription — used by onboarding.
 * Does NOT run Mistral or TTS. No 422 risk.
 * Respects user's selected language.
 */
export async function transcribeAudio(
  audioBase64: string,
  mimeType: string = 'audio/mp4',
  languageCode: string = 'kn-IN',
): Promise<TranscribeResponse> {
  if (!audioBase64 || audioBase64.length < 100) {
    return { transcript: '', language: languageCode, success: false };
  }
  try {
    const res = await apiClient.post('/api/transcribe', {
      audio_base64: audioBase64,
      audio_mime: mimeType,
      language_code: languageCode,
    }, { timeout: 30000 });
    return res.data;
  } catch (err: any) {
    console.error('[QueryService] Transcribe failed:', err?.message);
    return { transcript: '', language: languageCode, success: false };
  }
}

/**
 * Send a voice query (base64 M4A/WAV audio).
 * Pass last N conversation turns for follow-up support.
 */
export async function sendVoiceQuery(
  audioBase64: string,
  mimeType: string = 'audio/mp4',
  conversationHistory?: ConversationTurn[],
): Promise<QueryResponse> {
  if (!audioBase64 || audioBase64.length < 100) {
    throw new Error('Audio recording too short or empty');
  }

  const audioSizeKB = Math.round(audioBase64.length / 1024);
  console.log(`[QueryService] Sending voice query - Size: ${audioSizeKB}KB, Mime: ${mimeType}`);

  try {
    const res = await apiClient.post('/api/query', {
      audio_base64: audioBase64,
      audio_mime: mimeType,
      conversation_history: conversationHistory?.slice(-6) ?? [],
      tts_language: getPreferredLanguage(),
      preferred_language: getPreferredLanguage(),
    }, {
      timeout: 120000,  // 120s to match backend timeout
    });
    console.log('[QueryService] Voice query succeeded ✓', { intent: res.data.intent, answerLen: res.data.answer_text_kn?.length });
    return res.data;
  } catch (error: any) {
    console.error('[QueryService] Voice query FAILED:', {
      status: error?.response?.status,
      message: error?.message,
      code: error?.code,
      url: error?.config?.url,
      baseURL: error?.config?.baseURL,
    });
    throw error;
  }
}

/**
 * Send a text query.
 * Pass last N conversation turns for follow-up support.
 */
export async function sendTextQuery(
  text: string,
  conversationHistory?: ConversationTurn[],
): Promise<QueryResponse> {
  if (!text || !text.trim()) {
    throw new Error('Empty text query');
  }

  console.log(`[QueryService] Sending text query: "${text.slice(0, 50)}"`);

  try {
    const res = await apiClient.post('/api/query', {
      text_query: text,
      conversation_history: conversationHistory?.slice(-6) ?? [],
      tts_language: getPreferredLanguage(),
      preferred_language: getPreferredLanguage(),
    }, {
      timeout: 120000,  // 120s to match backend timeout
    });
    console.log('[QueryService] Text query succeeded ✓', { intent: res.data.intent, answerLen: res.data.answer_text_kn?.length });
    return res.data;
  } catch (error: any) {
    console.error('[QueryService] Text query FAILED:', {
      status: error?.response?.status,
      message: error?.message,
      code: error?.code,
      url: error?.config?.url,
      baseURL: error?.config?.baseURL,
    });
    throw error;
  }
}

/**
 * Send a diagnosis query with image and optional text.
 */
export async function sendDiagnosis(
  imageBase64: string,
  imageMime: string,
  optionalText?: string
): Promise<DiagnosisResponse> {
  if (!imageBase64 || imageBase64.length < 100) {
    throw new Error('Image data is empty or corrupt');
  }

  console.log(`[QueryService] Sending diagnosis, image size: ${imageBase64.length} chars, mime: ${imageMime}`);

  const res = await apiClient.post('/api/diagnose', {
    image_base64: imageBase64,
    image_mime: imageMime,
    optional_text: optionalText || undefined,
    tts_language: getPreferredLanguage(),
    preferred_language: getPreferredLanguage(),
  }, {
    timeout: 120000,
  });
  return res.data;
}
