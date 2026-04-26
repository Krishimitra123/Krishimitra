/**
 * Audio Recording Store — Manages mic recording state machine.
 * States: IDLE → RECORDING → STT_PROCESSING → IDLE
 *         IDLE → TTS_LOADING → PLAYING → IDLE
 */

import { create } from 'zustand';

export type AudioState =
  | 'IDLE'
  | 'RECORDING'
  | 'STT_PROCESSING'
  | 'TTS_LOADING'
  | 'PLAYING'
  | 'ERROR';

interface AudioStore {
  state: AudioState;
  transcript: string | null;
  errorMessage: string | null;
  audioUri: string | null;

  setState: (state: AudioState) => void;
  setTranscript: (transcript: string) => void;
  setError: (error: string) => void;
  setAudioUri: (uri: string | null) => void;
  reset: () => void;
}

export const useAudioStore = create<AudioStore>((set) => ({
  state: 'IDLE',
  transcript: null,
  errorMessage: null,
  audioUri: null,

  setState: (state) => set({ state, errorMessage: state === 'ERROR' ? undefined : null }),
  setTranscript: (transcript) => set({ transcript, state: 'IDLE' }),
  setError: (errorMessage) => set({ errorMessage, state: 'ERROR' }),
  setAudioUri: (audioUri) => set({ audioUri }),

  reset: () =>
    set({
      state: 'IDLE',
      transcript: null,
      errorMessage: null,
      audioUri: null,
    }),
}));
