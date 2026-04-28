/**
 * Root Layout — KrishiMitra
 * Handles font loading, splash screen, and onboarding redirect.
 */

import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { LogBox, StatusBar } from 'react-native';
import 'react-native-reanimated';
import { useUserStore } from '@/stores/useUserStore';
import { Colors } from '@/constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

/**
 * One-time migration: strip audio_base64 from existing AsyncStorage data
 * to fix SQLITE_FULL errors caused by large base64 blobs being persisted.
 */
async function migrateAsyncStorage() {
  try {
    const raw = await AsyncStorage.getItem('krishimitra-sessions');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const state = parsed?.state;
    if (!state) return;

    let changed = false;

    const stripAudio = (messages: any[]) =>
      messages.map((m: any) => {
        if (m.audio_base64) {
          const { audio_base64, ...rest } = m;
          changed = true;
          return rest;
        }
        return m;
      });

    if (state.currentSession?.messages) {
      state.currentSession.messages = stripAudio(state.currentSession.messages);
    }
    if (Array.isArray(state.pastSessions)) {
      state.pastSessions = state.pastSessions.map((s: any) => ({
        ...s,
        messages: stripAudio(s.messages || []),
      }));
    }

    if (changed) {
      await AsyncStorage.setItem('krishimitra-sessions', JSON.stringify(parsed));
      console.log('[Migration] Stripped audio_base64 from AsyncStorage ✓');
    }
  } catch (e) {
    // If migration fails, clear the whole key to prevent ongoing errors
    try {
      await AsyncStorage.removeItem('krishimitra-sessions');
      console.log('[Migration] Cleared corrupt session data from AsyncStorage ✓');
    } catch {}
  }
}

LogBox.ignoreLogs([
  '[expo-av]: Expo AV has been deprecated',
  '[expo-image-picker] `ImagePicker.MediaTypeOptions` have been deprecated',
]);

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      migrateAsyncStorage().finally(() => {
        SplashScreen.hideAsync();
      });
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const router = useRouter();
  const segments = useSegments();
  const isOnboarded = useUserStore((s) => s.is_onboarded);

  // Redirect to onboarding if not yet completed
  useEffect(() => {
    if (!isOnboarded) {
      router.replace('/onboarding');
    }
  }, [isOnboarded]);

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="onboarding"
          options={{
            presentation: 'fullScreenModal',
            animation: 'fade',
          }}
        />
      </Stack>
    </>
  );
}
