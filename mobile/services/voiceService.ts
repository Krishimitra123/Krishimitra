/**
 * Voice Service — Recording and TTS playback.
 * Uses Audio.RecordingOptionsPresets.HIGH_QUALITY (works in Expo Go).
 * TTS: stops any currently playing audio before starting new playback.
 * NEW: stopPlayback() can be called to interrupt TTS at any time.
 */

import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

// ── Recording state ───────────────────────────────────────────────
let _recording: Audio.Recording | null = null;
let _isStarting = false;
let _isStopping = false;

// ── Playback state — only ONE sound plays at a time ───────────────
let _activeSound: Audio.Sound | null = null;
let _playbackResolve: (() => void) | null = null;

export async function startRecording(): Promise<void> {
  if (_isStarting) {
    console.warn('[Voice] Already starting — ignoring');
    return;
  }
  _isStarting = true;

  try {
    // Stop any playing TTS first so recording audio session can take over
    await stopPlayback();

    if (_recording) {
      try { await _recording.stopAndUnloadAsync(); } catch {}
      _recording = null;
    }

    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) throw new Error('Microphone permission denied');

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      interruptionModeIOS: 1,
      shouldDuckAndroid: true,
      interruptionModeAndroid: 1,
    });

    console.log('[Voice] Starting recording...');
    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    _recording = recording;
    console.log('[Voice] Recording started ✓');
  } finally {
    _isStarting = false;
  }
}

export async function stopRecordingAndGetBase64(): Promise<{ base64: string; mimeType: string }> {
  if (_isStopping) throw new Error('Already stopping');
  if (!_recording) throw new Error('No active recording');

  _isStopping = true;
  try {
    const status = await _recording.getStatusAsync();
    const durationMs = (status as any).durationMillis ?? 0;
    console.log(`[Voice] Duration: ${durationMs}ms`);

    if (durationMs < 800) {
      throw new Error('Too short — hold mic and speak for at least 1 second');
    }

    await _recording.stopAndUnloadAsync();
    const uri = _recording.getURI();
    _recording = null;

    if (!uri) throw new Error('Recording URI is null');
    console.log('[Voice] Saved to:', uri);

    // Switch audio session back to playback mode
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });

    const ext = uri.split('.').pop()?.toLowerCase() ?? 'wav';
    const mimeType = ext === 'm4a' ? 'audio/mp4' : ext === '3gp' ? 'audio/3gpp' : 'audio/wav';

    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    console.log(`[Voice] Audio: ${base64.length} chars, .${ext}, ${mimeType}`);
    if (!base64 || base64.length < 500) throw new Error('Audio data empty');

    try { await FileSystem.deleteAsync(uri, { idempotent: true }); } catch {}

    return { base64, mimeType };
  } finally {
    _isStopping = false;
  }
}

/**
 * Stop any currently playing TTS audio immediately.
 * Can be called at any time — safe to call even when nothing is playing.
 */
export async function stopPlayback(): Promise<void> {
  if (_activeSound) {
    try {
      await _activeSound.stopAsync();
      await _activeSound.unloadAsync();
    } catch {}
    _activeSound = null;
  }
  // Resolve any pending playback promise
  if (_playbackResolve) {
    _playbackResolve();
    _playbackResolve = null;
  }
}

/**
 * Check if audio is currently playing.
 */
export function isPlaying(): boolean {
  return _activeSound !== null;
}

/**
 * Play TTS audio. Stops any currently playing audio first.
 * Sarvam bulbul:v3 returns 22050Hz WAV — crisp and clear.
 * Can be interrupted at any time by calling stopPlayback().
 */
export async function playBase64Audio(base64Audio: string): Promise<void> {
  if (!base64Audio || base64Audio.length < 100) {
    console.warn('[Voice] TTS audio empty — skipping');
    return;
  }

  // Stop any currently playing audio
  await stopPlayback();

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

  _activeSound = sound;

  await new Promise<void>((resolve) => {
    _playbackResolve = resolve;

    const cleanup = async () => {
      if (_activeSound === sound) _activeSound = null;
      _playbackResolve = null;
      try { await sound.unloadAsync(); } catch {}
      try { await FileSystem.deleteAsync(fileUri, { idempotent: true }); } catch {}
    };

    const TIMEOUT = setTimeout(async () => {
      await cleanup();
      resolve();
    }, 60000); // 60s max for long answers

    sound.setOnPlaybackStatusUpdate(async (s) => {
      if (!s.isLoaded) return;
      if (s.didJustFinish) {
        clearTimeout(TIMEOUT);
        await cleanup();
        resolve();
      }
    });
  });
}
