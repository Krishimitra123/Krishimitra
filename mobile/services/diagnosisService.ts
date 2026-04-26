/**
 * Diagnosis Service — Image capture and diagnosis API calls.
 */

import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

export interface PickedDiagnosisImage {
  base64: string;
  uri: string;
  mimeType: string;
}

function inferMimeType(asset: ImagePicker.ImagePickerAsset): string {
  if (asset.mimeType?.startsWith('image/')) {
    return asset.mimeType;
  }

  const uri = asset.uri.toLowerCase();
  if (uri.endsWith('.png')) return 'image/png';
  if (uri.endsWith('.webp')) return 'image/webp';
  if (uri.endsWith('.heic') || uri.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

/**
 * Safely extract base64 from an image asset.
 * Falls back to reading from file URI if picker didn't provide base64.
 */
async function ensureBase64(asset: ImagePicker.ImagePickerAsset): Promise<string | null> {
  // If the picker returned base64, use it directly
  if (asset.base64 && asset.base64.length > 0) {
    return asset.base64;
  }

  // Fallback: read the file from URI and convert to base64
  if (asset.uri) {
    try {
      const b64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return b64 || null;
    } catch (err) {
      console.warn('[DiagnosisService] Failed to read base64 from URI:', err);
      return null;
    }
  }

  return null;
}

function getFirstImageAsset(
  result: ImagePicker.ImagePickerResult
): ImagePicker.ImagePickerAsset | null {
  if (result.canceled) {
    return null;
  }

  const asset = result.assets?.[0];
  return asset ?? null;
}

/**
 * Launch camera for crop photo.
 * Returns base64-encoded JPEG image or null if cancelled.
 */
export async function captureImage(): Promise<string | null> {
  const { granted } = await ImagePicker.requestCameraPermissionsAsync();
  if (!granted) {
    throw new Error('Camera permission not granted');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    base64: true,
    allowsEditing: false,
  });

  const asset = getFirstImageAsset(result);
  if (!asset) return null;

  return ensureBase64(asset);
}

/**
 * Pick image from gallery.
 * Returns base64-encoded JPEG image or null if cancelled.
 */
export async function pickImage(): Promise<string | null> {
  const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!granted) {
    throw new Error('Gallery permission not granted');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    base64: true,
    allowsEditing: false,
  });

  const asset = getFirstImageAsset(result);
  if (!asset) return null;

  return ensureBase64(asset);
}

/**
 * Launch camera and return image with URI for display + base64 for API.
 */
export async function captureImageWithUri(): Promise<PickedDiagnosisImage | null> {
  const { granted } = await ImagePicker.requestCameraPermissionsAsync();
  if (!granted) throw new Error('Camera permission not granted');

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    base64: true,
    allowsEditing: false,
  });

  const asset = getFirstImageAsset(result);
  if (!asset) return null;

  const base64 = await ensureBase64(asset);
  if (!base64) {
    throw new Error('Could not read image data. Please try again.');
  }

  return {
    base64,
    uri: asset.uri,
    mimeType: inferMimeType(asset),
  };
}

/**
 * Pick from gallery and return image with URI for display + base64 for API.
 */
export async function pickImageWithUri(): Promise<PickedDiagnosisImage | null> {
  const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!granted) throw new Error('Gallery permission not granted');

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    base64: true,
    allowsEditing: false,
  });

  const asset = getFirstImageAsset(result);
  if (!asset) return null;

  const base64 = await ensureBase64(asset);
  if (!base64) {
    throw new Error('Could not read image data. Please try again.');
  }

  return {
    base64,
    uri: asset.uri,
    mimeType: inferMimeType(asset),
  };
}
