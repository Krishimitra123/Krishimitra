/**
 * Voice Service — Audio recording using expo-av.
 * Records in WAV 16kHz mono format required by Sarvam AI STT.
 */

import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

const RECORDING_OPTIONS: Audio.RecordingOptions = {
  android: {
    extension: '.wav',
    outputFormat: Audio.AndroidOutputFormat.DEFAULT,
    audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: {
    extension: '.wav',
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
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

  // Use createAsync — the recommended API
  const { recording } = await Audio.Recording.createAsync(RECORDING_OPTIONS);
  currentRecording = recording;

  console.log('[Voice] Recording started');
}

/**
 * Stop recording and return audio as Base64 string.
 */
export async function stopRecordingAndGetBase64(): Promise<string> {
  if (!currentRecording) {
    throw new Error('No active recording');
  }

  console.log('[Voice] Stopping recording...');

  const status = await currentRecording.getStatusAsync();
  if (!status.isRecording && status.durationMillis < 500) {
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

  // Convert to base64 for API transmission
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  console.log(`[Voice] Audio base64 length: ${base64.length}`);

  if (!base64 || base64.length < 100) {
    throw new Error('Recorded audio is empty or corrupt');
  }

  return base64;
}

/**
 * Play a base64-encoded MP3 audio response (TTS output).
 */
export async function playBase64Audio(base64Audio: string): Promise<void> {
  if (!base64Audio || base64Audio.length < 50) {
    console.warn('[Voice] TTS audio is empty, skipping playback');
    return;
  }

  const fileUri = FileSystem.cacheDirectory + `tts_response_${Date.now()}.mp3`;

  await FileSystem.writeAsStringAsync(fileUri, base64Audio, {
    encoding: FileSystem.EncodingType.Base64,
  });

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
  });

  const { sound } = await Audio.Sound.createAsync({ uri: fileUri });
  await sound.playAsync();

  // Clean up after playback finishes
  sound.setOnPlaybackStatusUpdate((status) => {
    if (status.isLoaded && status.didJustFinish) {
      sound.unloadAsync();
    }
  });
}
