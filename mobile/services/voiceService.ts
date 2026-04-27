/**
 * Voice Service — Audio recording using expo-av.
 * iOS records in M4A/AAC format natively — we send that directly to Sarvam.
 * Android uses AMR-NB which Sarvam also accepts.
 */

import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

/**
 * iOS: Use HIGH_QUALITY preset — records as M4A/AAC which Sarvam accepts.
 * Android: Use AMR_NB which is widely supported.
 */
const RECORDING_OPTIONS: Audio.RecordingOptions = Platform.OS === 'ios'
  ? {
      ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
      ios: {
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY.ios,
        extension: '.m4a',
        outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
        audioQuality: Audio.IOSAudioQuality.HIGH,
        sampleRate: 16000,
        numberOfChannels: 1,
        bitRate: 64000,
      },
      android: {
        extension: '.m4a',
        outputFormat: Audio.AndroidOutputFormat.MPEG_4,
        audioEncoder: Audio.AndroidAudioEncoder.AAC,
        sampleRate: 16000,
        numberOfChannels: 1,
        bitRate: 64000,
      },
      web: {},
    }
  : {
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

let currentRecording: Audio.Recording | null = null;

/**
 * Request permissions and start recording.
 */
export async function startRecording(): Promise<void> {
  // Clean up any stale recording first
  if (currentRecording) {
    try {
      await currentRecording.stopAndUnloadAsync();
    } catch {
      // ignore — might already be stopped
    }
    currentRecording = null;
  }

  const { granted } = await Audio.requestPermissionsAsync();
  if (!granted) {
    throw new Error('Microphone permission not granted');
  }

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });

  console.log('[Voice] Starting recording...');

  const { recording } = await Audio.Recording.createAsync(RECORDING_OPTIONS);
  currentRecording = recording;

  console.log('[Voice] Recording started');
}

/**
 * Stop recording and return audio as Base64 string.
 * Also returns the file extension so the backend knows the format.
 */
export async function stopRecordingAndGetBase64(): Promise<{ base64: string; mimeType: string }> {
  if (!currentRecording) {
    throw new Error('No active recording');
  }

  console.log('[Voice] Stopping recording...');

  const status = await currentRecording.getStatusAsync();
  if (!status.isRecording && (status as any).durationMillis < 500) {
    currentRecording = null;
    throw new Error('Recording too short');
  }

  await currentRecording.stopAndUnloadAsync();
  const uri = currentRecording.getURI();
  currentRecording = null;

  if (!uri) {
    throw new Error('Recording URI is null — recording may have failed');
  }

  console.log(`[Voice] Recording saved to: ${uri}`);

  // Reset audio mode for playback
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
  });

  // Determine MIME type from extension
  const ext = uri.split('.').pop()?.toLowerCase() || 'm4a';
  const mimeType = ext === 'wav' ? 'audio/wav' : 'audio/mp4';

  // Convert to base64 for API transmission
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  console.log(`[Voice] Audio base64 length: ${base64.length}, format: ${ext}, mime: ${mimeType}`);

  if (!base64 || base64.length < 100) {
    throw new Error('Recorded audio is empty or corrupt');
  }

  return { base64, mimeType };
}

/**
 * Play a base64-encoded WAV or MP3 audio response (TTS output from Sarvam bulbul:v3).
 * bulbul:v3 returns WAV by default at 8000Hz.
 */
export async function playBase64Audio(base64Audio: string): Promise<void> {
  if (!base64Audio || base64Audio.length < 50) {
    console.warn('[Voice] TTS audio is empty, skipping playback');
    return;
  }

  // bulbul:v3 returns WAV
  const fileUri = FileSystem.cacheDirectory + `tts_response_${Date.now()}.wav`;

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

  // Clean up after playback finishes
  sound.setOnPlaybackStatusUpdate((status) => {
    if (status.isLoaded && status.didJustFinish) {
      sound.unloadAsync();
      FileSystem.deleteAsync(fileUri, { idempotent: true });
    }
  });
}
