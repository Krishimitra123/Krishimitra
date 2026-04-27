/**
 * Voice Service — Audio recording and TTS playback.
 *
 * Recording: Uses expo-av (still functional in SDK 54, migration to expo-audio
 * planned for SDK 55+ when imperative API is available).
 * Records in M4A/AAC at 16kHz mono — optimal for Sarvam saarika:v2.5 STT.
 *
 * Playback: Uses expo-audio AudioModule directly (non-hook path).
 */

import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

// ── Recording instance ────────────────────────────────────────────
let _activeRecording: Audio.Recording | null = null;

/**
 * iOS records M4A/AAC natively.
 * 16kHz mono 64kbps — exact spec Sarvam saarika:v2.5 expects.
 */
const RECORDING_OPTIONS: Audio.RecordingOptions = {
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
  },
  ios: {
    extension: '.m4a',
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
  },
  web: {},
};

/**
 * Start recording microphone input.
 */
export async function startRecording(): Promise<void> {
  // Clean up stale session
  if (_activeRecording) {
    try {
      await _activeRecording.stopAndUnloadAsync();
    } catch {}
    _activeRecording = null;
  }

  const { granted } = await Audio.requestPermissionsAsync();
  if (!granted) {
    throw new Error('Microphone permission denied');
  }

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });

  console.log('[Voice] Starting recording (M4A 16kHz)...');
  const { recording } = await Audio.Recording.createAsync(RECORDING_OPTIONS);
  _activeRecording = recording;
  console.log('[Voice] Recording started');
}

/**
 * Stop recording and return { base64, mimeType }.
 */
export async function stopRecordingAndGetBase64(): Promise<{ base64: string; mimeType: string }> {
  if (!_activeRecording) {
    throw new Error('No active recording session');
  }

  console.log('[Voice] Stopping recording...');

  // Check minimum duration
  const status = await _activeRecording.getStatusAsync();
  const duration = (status as any).durationMillis ?? 0;
  if (duration < 800) {
    _activeRecording = null;
    throw new Error('Recording too short — speak for at least 1 second');
  }

  await _activeRecording.stopAndUnloadAsync();
  const uri = _activeRecording.getURI();
  _activeRecording = null;

  if (!uri) {
    throw new Error('Recording URI is null — try again');
  }

  console.log('[Voice] Saved to:', uri);

  // Reset audio mode for playback
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
  });

  // Determine MIME type from actual file extension
  const ext = uri.split('.').pop()?.toLowerCase() ?? 'm4a';
  const mimeType = ext === 'wav' ? 'audio/wav' : 'audio/mp4';

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  console.log(`[Voice] Audio: ${base64.length} chars, .${ext}, ${mimeType}`);

  if (!base64 || base64.length < 500) {
    throw new Error('Audio data too small — recording failed');
  }

  // Clean up temp file
  try { await FileSystem.deleteAsync(uri, { idempotent: true }); } catch {}

  return { base64, mimeType };
}

/**
 * Play a base64 WAV audio string (Sarvam bulbul:v3 TTS output).
 * bulbul:v3 returns 8kHz WAV.
 */
export async function playBase64Audio(base64Audio: string): Promise<void> {
  if (!base64Audio || base64Audio.length < 100) {
    console.warn('[Voice] TTS audio empty — skipping playback');
    return;
  }

  const fileUri = `${FileSystem.cacheDirectory}tts_${Date.now()}.wav`;

  await FileSystem.writeAsStringAsync(fileUri, base64Audio, {
    encoding: FileSystem.EncodingType.Base64,
  });

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
  });

  console.log('[Voice] Playing TTS audio from:', fileUri);

  const { sound } = await Audio.Sound.createAsync(
    { uri: fileUri },
    { shouldPlay: true, volume: 1.0 }
  );

  return new Promise<void>((resolve) => {
    sound.setOnPlaybackStatusUpdate((playStatus) => {
      if (playStatus.isLoaded && playStatus.didJustFinish) {
        sound.unloadAsync();
        FileSystem.deleteAsync(fileUri, { idempotent: true });
        resolve();
      }
    });

    // Safety timeout — resolve after 30 seconds regardless
    setTimeout(() => {
      sound.unloadAsync().catch(() => {});
      resolve();
    }, 30000);
  });
}
