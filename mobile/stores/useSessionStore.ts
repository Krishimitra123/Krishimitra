/**
 * Session Store — Manages chat sessions and message history.
 * Keeps last 10 sessions persisted in AsyncStorage.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Message {
  id:            string;
  role:          'user' | 'assistant';
  text:          string;
  sources:       string[];
  timestamp:     number;
  is_diagnosis:  boolean;
  image_uri?:    string;
  audio_base64?: string;
}

export interface Session {
  id:          string;
  title:       string;
  messages:    Message[];
  started_at:  number;
}

interface SessionStore {
  currentSession:  Session | null;
  pastSessions:    Session[];
  isLoading:       boolean;
  error:           string | null;

  startNewSession: () => void;
  addMessage:      (msg: Message) => void;
  setLoading:      (loading: boolean) => void;
  setError:        (error: string | null) => void;
  endSession:      () => void;
  clearHistory:    () => void;
  deleteSession:   (id: string) => void;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => ({
      currentSession: null,
      pastSessions: [],
      isLoading: false,
      error: null,

      startNewSession: () => {
        const current = get().currentSession;
        const past = get().pastSessions;

        // Archive current session if it has messages
        let updatedPast = [...past];
        if (current && current.messages.length > 0) {
          updatedPast = [current, ...past].slice(0, 10); // Keep last 10
        }

        set({
          currentSession: {
            id: generateId(),
            title: '',
            messages: [],
            started_at: Date.now(),
          },
          pastSessions: updatedPast,
          isLoading: false,
          error: null,
        });
      },

      addMessage: (msg) => {
        const session = get().currentSession;
        if (!session) return;

        const messages = [...session.messages, msg];
        const title =
          session.title ||
          (msg.role === 'user' ? msg.text.substring(0, 50) : session.title);

        set({
          currentSession: { ...session, messages, title },
        });
      },

      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error, isLoading: false }),

      endSession: () => {
        const current = get().currentSession;
        const past = get().pastSessions;

        if (current && current.messages.length > 0) {
          set({
            currentSession: null,
            pastSessions: [current, ...past].slice(0, 10),
          });
        } else {
          set({ currentSession: null });
        }
      },

      clearHistory: () => set({ pastSessions: [], currentSession: null }),

      deleteSession: (id) =>
        set((s) => ({
          pastSessions: s.pastSessions.filter((sess) => sess.id !== id),
        })),
    }),
    {
      name: 'krishimitra-sessions',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
