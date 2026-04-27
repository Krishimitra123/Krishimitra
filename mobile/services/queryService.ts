/**
 * Query Service — API calls for text/voice queries and diagnosis.
 */

import { apiClient } from './api';

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
}

/**
 * Send a voice query (base64 M4A/WAV audio).
 */
export async function sendVoiceQuery(audioBase64: string, mimeType: string = 'audio/mp4'): Promise<QueryResponse> {
  if (!audioBase64 || audioBase64.length < 100) {
    throw new Error('Audio recording too short or empty');
  }

  console.log(`[QueryService] Sending voice query, audio size: ${audioBase64.length} chars, mime: ${mimeType}`);

  const res = await apiClient.post('/api/query', {
    audio_base64: audioBase64,
    audio_mime: mimeType,
  }, {
    timeout: 60000,
  });
  return res.data;
}

/**
 * Send a text query.
 */
export async function sendTextQuery(text: string): Promise<QueryResponse> {
  if (!text || !text.trim()) {
    throw new Error('Empty text query');
  }

  console.log(`[QueryService] Sending text query: "${text.slice(0, 50)}"`);

  const res = await apiClient.post('/api/query', {
    text_query: text,
  }, {
    timeout: 60000,
  });
  return res.data;
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
  }, {
    timeout: 120000,
  });
  return res.data;
}
