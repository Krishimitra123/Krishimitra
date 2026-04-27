/**
 * Voice Service — Audio recording and TTS playback for KrishiMitra.
 *
 * IMPORTANT: Uses Audio.RecordingOptionsPresets.HIGH_QUALITY which is the
 * ONLY preset guaranteed to work in Expo Go on iOS without a native build.
 * Custom formats (MPEG4AAC, etc.) require a development build.
 *
 * The iOS HIGH_QUALITY preset records WAV at 44.1kHz — Sarvam STT accepts this.
 */

import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

// ── State flags — prevent concurrent recording sessions ───────────
let _recording: Audio.Recording | null = null;
let _isStarting = false;      // guard against concurrent startRecording calls
let _isStopping = false;      // guard against concurrent stop calls

/**
 * Start recording. Uses HIGH_QUALITY preset (WAV — works in Expo Go).
 * Silently stops any previous session before starting a new one.
 */
export async function startRecording(): Promise<void> {
  // Prevent multiple concurrent start calls
  if (_isStarting) {
    console.warn('[Voice] Already starting — ignoring duplicate call');
    return;
  }
  _isStarting = true;

  try {
    // Clean up any stale recording
    if (_recording) {
      console.log('[Voice] Cleaning up stale recording...');
      try {
        await _recording.stopAndUnloadAsync();
      } catch {}
      _recording = null;
    }

    // Request permission
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) {
      throw new Error('Microphone permission denied — go to Settings and allow KrishiMitra mic access');
    }

    // Configure audio session for recording
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      interruptionModeIOS: 1,         // DO_NOT_MIX
      shouldDuckAndroid: true,
      interruptionModeAndroid: 1,     // DO_NOT_MIX
    });

    console.log('[Voice] Starting recording...');

    // HIGH_QUALITY: the ONLY preset that reliably works in Expo Go.
    // iOS → WAV/CAF at 44.1kHz, Android → AMR-NB/AAC
    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );

    _recording = recording;
    console.log('[Voice] Recording started ✓');
  } finally {
    _isStarting = false;
  }
}

/**
 * Stop recording and return { base64, mimeType } for the backend.
 */
export async function stopRecordingAndGetBase64(): Promise<{ base64: string; mimeType: string }> {
  if (_isStopping) {
    throw new Error('Already stopping — wait a moment');
  }
  if (!_recording) {
    throw new Error('No active recording');
  }

  _isStopping = true;
  try {
    // Check we recorded for at least 1 second
    const status = await _recording.getStatusAsync();
    const durationMs = (status as any).durationMillis ?? 0;
    console.log(`[Voice] Duration: ${durationMs}ms`);
    if (durationMs < 800) {
      throw new Error('Recording too short — please hold the mic button and speak');
    }

    await _recording.stopAndUnloadAsync();
    const uri = _recording.getURI();
    _recording = null;

    if (!uri) {
      throw new Error('Recording URI is null');
    }

    console.log('[Voice] Saved to:', uri);

    // Reset audio session for playback
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });

    // Detect format from file extension
    const ext = uri.split('.').pop()?.toLowerCase() ?? 'wav';
    // iOS Expo Go records .wav (WAV/PCM), Android records .3gp or .m4a
    const mimeType = ext === 'm4a' ? 'audio/mp4'
      : ext === '3gp' ? 'audio/3gpp'
      : 'audio/wav';

    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    console.log(`[Voice] Audio: ${base64.length} chars, .${ext}, mime: ${mimeType}`);

    if (!base64 || base64.length < 500) {
      throw new Error('Audio data is empty or corrupt');
    }

    // Clean up temp file
    try { await FileSystem.deleteAsync(uri, { idempotent: true }); } catch {}

    return { base64, mimeType };
  } finally {
    _isStopping = false;
  }
}

/**
 * Play a base64-encoded WAV audio (Sarvam bulbul:v3 TTS output).
 */
export async function playBase64Audio(base64Audio: string): Promise<void> {
  if (!base64Audio || base64Audio.length < 100) {
    console.warn('[Voice] TTS audio is empty — skipping');
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

  console.log('[Voice] Playing TTS audio...');

  const { sound } = await Audio.Sound.createAsync(
    { uri: fileUri },
    { shouldPlay: true, volume: 1.0 }
  );

  await new Promise<void>((resolve) => {
    const TIMEOUT = setTimeout(() => {
      sound.unloadAsync().catch(() => {});
      resolve();
    }, 30000);

    sound.setOnPlaybackStatusUpdate((s) => {
      if (s.isLoaded && s.didJustFinish) {
        clearTimeout(TIMEOUT);
        sound.unloadAsync();
        FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => {});
        resolve();
      }
    });
  });
}
