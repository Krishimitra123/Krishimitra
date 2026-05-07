/**
 * Voice Service — Recording and TTS playback.
 * FIXES:
 * - Uses DoNotMix (not DuckOthers) so recording mode never ducks our own TTS
 * - Keeps playback mode active until recording actually starts
 * - Volume set to maximum (1.0) on every play
 */

import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as Speech from 'expo-speech';

// ── Recording state ───────────────────────────────────────────────
let _recording: Audio.Recording | null = null;
let _isStarting = false;
let _isStopping = false;

// ── Playback state — only ONE sound plays at a time ───────────────
let _activeSound: Audio.Sound | null = null;
let _playbackResolve: (() => void) | null = null;

/**
 * PLAYBACK MODE — speaker output, max volume, does NOT duck our own audio.
 * Using DoNotMix ensures the full OS audio volume goes to speaker.
 */
async function _setPlaybackMode(): Promise<void> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    interruptionModeIOS: InterruptionModeIOS.DoNotMix,
    interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
    shouldDuckAndroid: false,
    playThroughEarpieceAndroid: false,
  });
}

/**
 * RECORDING MODE — set right before recording starts.
 * We keep the mode as playback as long as possible
 * to avoid volume dips from unnecessary mode switches.
 */
async function _setRecordingMode(): Promise<void> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    interruptionModeIOS: InterruptionModeIOS.DoNotMix,
    interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
    shouldDuckAndroid: false,
    playThroughEarpieceAndroid: false,
  });
}

export async function startRecording(): Promise<void> {
  if (_isStarting) {
    console.warn('[Voice] Already starting — ignoring');
    return;
  }
  _isStarting = true;

  try {
    // Stop any audio playing first
    await stopPlayback();

    if (_recording) {
      try { await _recording.stopAndUnloadAsync(); } catch {}
      _recording = null;
    }

    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) throw new Error('Microphone permission denied');

    // Switch to recording mode RIGHT before recording — minimises time in this mode
    await _setRecordingMode();

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

    // Immediately restore playback mode after recording stops
    await _setPlaybackMode();

    const ext = uri.split('.').pop()?.toLowerCase() ?? 'wav';
    const mimeType = ext === 'm4a' ? 'audio/mp4' : ext === '3gp' ? 'audio/3gpp' : 'audio/wav';

    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
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
 */
export async function stopPlayback(): Promise<void> {
  if (_activeSound) {
    try {
      await _activeSound.stopAsync();
      await _activeSound.unloadAsync();
    } catch {}
    _activeSound = null;
  }
  if (_playbackResolve) {
    _playbackResolve();
    _playbackResolve = null;
  }
}

export function isPlaying(): boolean {
  return _activeSound !== null;
}

/**
 * Play TTS audio LOUD through the speaker.
 * Always forces DoNotMix playback mode before playing.
 */
export async function playBase64Audio(base64Audio: string): Promise<void> {
  if (!base64Audio || base64Audio.length < 100) {
    console.warn('[Voice] TTS audio empty — skipping');
    return;
  }

  await stopPlayback();

  if (!(FileSystem as any).cacheDirectory) {
    throw new Error('Cache directory unavailable for audio playback');
  }

  const fileUri = `${(FileSystem as any).cacheDirectory}tts_${Date.now()}.wav`;
  await FileSystem.writeAsStringAsync(fileUri, base64Audio, {
    encoding: 'base64',
  });

  // CRITICAL: Force speaker + DoNotMix BEFORE creating sound
  await _setPlaybackMode();

  console.log('[Voice] Playing TTS audio through SPEAKER (DoNotMix)...');

  try {
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
        // Stay in playback mode — don't switch to recording unnecessarily
      };

      const TIMEOUT = setTimeout(async () => {
        await cleanup();
        resolve();
      }, 60000);

      sound.setOnPlaybackStatusUpdate(async (s) => {
        if (!s.isLoaded) return;
        if (s.didJustFinish) {
          clearTimeout(TIMEOUT);
          await cleanup();
          resolve();
        }
      });
    });
  } catch (err: any) {
    console.error('[Voice] Playback error:', err.message);
    try { await FileSystem.deleteAsync(fileUri, { idempotent: true }); } catch {}
    _activeSound = null;
    _playbackResolve = null;
  }
}

export async function speakText(text: string, language: string = 'kn-IN'): Promise<void> {
  const cleanText = text.trim();
  if (!cleanText) return;

  await stopPlayback();
  // Ensure we're in speaker mode before expo-speech speaks
  await _setPlaybackMode();

  await new Promise<void>((resolve) => {
    Speech.speak(cleanText, {
      language,
      rate: 0.9,
      pitch: 1.0,
      onDone: resolve,
      onStopped: resolve,
      onError: () => resolve(),
    });
  });
}
