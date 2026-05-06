# KrishiMitra — Master Product Prompt v4.0
Voice-First | OTP Login | Zero Text UI | Human AI | Sarvam Multilingual

## What This App Is
KrishiMitra is a voice-first AI farming assistant for Karnataka organic farmers. The farmer should never need to read anything. Every interaction is spoken. The AI speaks like a helpful neighbour who knows farming deeply, not like a robot reading from a manual. The app opens, the AI speaks, the farmer speaks back. That is the entire experience.

## The Core Design Rules — Never Break These
No wall of text anywhere in the app. If something needs more than 8 words on screen, it should be spoken instead of shown. Every screen has at most one primary action. The AI always speaks first. The farmer responds. Trust is built through voice, not through UI elements. Confidence comes from the AI knowing the farmer's name, district, and crop without being asked every time.

## Section 1 — Authentication (Real OTP Login)
What to build. Phone number entry screen. Indian mobile numbers only, 10 digits, auto-prefix +91. When the farmer enters their number and taps the single large button, send a real OTP via SMS. Use Firebase Authentication with phone provider, or Twilio Verify, or MSG91 — whichever the team has credits for. Firebase is recommended because it handles the OTP delivery, verification, and session management in one SDK with a generous free tier.

Screen design. The screen shows the KrishiMitra leaf logo centred, a large phone number input below it with the +91 prefix locked, and one big green button that says "OTP ಕಳಿಸಿ" (Send OTP). Nothing else. No registration form. No email. No password. Just phone number.

OTP screen. After sending, navigate to a 6-digit OTP entry screen. Show the masked phone number at the top so the farmer knows where the OTP was sent. Six individual input boxes for the OTP digits. Auto-advance to next box on each digit entry. Auto-submit when all 6 digits are filled. A "ಮತ್ತೆ ಕಳಿಸಿ" (Resend) button that appears after 30 seconds with a countdown timer. No other text.

After verification. Check if this phone number has a profile stored. If yes, go directly to the Home screen. The app already knows this farmer. If no profile exists yet, begin the Voice Onboarding flow described in Section 2.

Session persistence. Firebase handles this automatically. The farmer stays logged in until they explicitly log out. Never ask them to log in again on the same device.

Firebase setup code.

```javascript
// mobile/services/authService.ts
import auth from '@react-native-firebase/auth';

export async function sendOTP(phoneNumber: string): Promise<string> {
  const confirmation = await auth().signInWithPhoneNumber(`+91${phoneNumber}`);
  return confirmation.verificationId;
}

export async function verifyOTP(verificationId: string, otp: string) {
  const credential = auth.PhoneAuthProvider.credential(verificationId, otp);
  return await auth().signInWithCredential(credential);
}

export function getCurrentUser() {
  return auth().currentUser;
}

export function onAuthStateChanged(callback: (user: any) => void) {
  return auth().onAuthStateChanged(callback);
}
```

## Section 2 — Voice Onboarding (First Launch Only)
The experience. The first time a new farmer logs in, the app does not show a form. It speaks to them. The AI voice asks each question one at a time and listens for the answer. The farmer never types anything during onboarding. The entire profile is built through conversation.

The conversation flow.

The app speaks: "ನಮಸ್ಕಾರ! ನಾನು ಕೃಷಿ ಮಿತ್ರ. ನಿಮ್ಮ ಹೆಸರೇನು?" (Hello! I am KrishiMitra. What is your name?)

The farmer speaks their name. The STT transcribes it. The app confirms by speaking: "ಸರಿ, [Name] ಅವರೇ! ನೀವು ಯಾವ ಜಿಲ್ಲೆಯಲ್ಲಿ ಇದ್ದೀರಿ?" (Okay, [Name]! Which district are you in?)

The farmer speaks their district. Fuzzy match it against the 31 Karnataka districts list. If there is ambiguity, the app reads back two options and the farmer says the number. The app confirms: "ತುಮಕೂರು ಜಿಲ್ಲೆ. ಸರಿ!" (Tumkur district. Correct!)

The app speaks: "ನೀವು ಮುಖ್ಯವಾಗಿ ಯಾವ ಬೆಳೆ ಬೆಳೆಯುತ್ತೀರಿ?" (What is your primary crop?)

The farmer speaks the crop name. Match against crop list. Confirm.

The app speaks: "ಧನ್ಯವಾದ [Name] ಅವರೇ! ನಾನು ಸದಾ ನಿಮ್ಮ ಜೊತೆ ಇದ್ದೇನೆ." (Thank you [Name]! I am always with you.)

Navigate to Home screen.

Implementation.

```typescript
// mobile/screens/VoiceOnboardingScreen.tsx
// Steps: ASK_NAME → ASK_DISTRICT → ASK_CROP → COMPLETE
// Each step: play TTS question → start recording → get transcript → validate → confirm → next step
// Show only a large animated listening indicator on screen — no text, no form
// Store completed profile to Supabase profiles table keyed by Firebase UID
```

Profile storage schema.

```sql
CREATE TABLE farmer_profiles (
  uid TEXT PRIMARY KEY,           -- Firebase UID
  phone TEXT NOT NULL,
  name TEXT NOT NULL,
  district TEXT NOT NULL,
  agro_zone INT,
  primary_crop TEXT NOT NULL,
  preferred_language TEXT DEFAULT 'kn-IN',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Section 3 — Home Screen (Voice First, Near Zero Text)
What the farmer sees. The Nivetti Systems logo top left. The farmer's name top right in large text — this is the only text on the screen and it must always be there. "ನಮಸ್ಕಾರ Ramesh" for example. Below that, a large animated pulsing circle in green — this is the mic. Below the mic, nothing. No labels, no instructions, no menus.

What happens on open. Every time the farmer opens the app, the AI speaks a greeting: "ನಮಸ್ಕಾರ [Name] ಅವರೇ! ಇಂದು ಏನು ಸಹಾಯ ಬೇಕು?" (Hello [Name]! What help do you need today?) The mic is already active after the greeting finishes. The farmer just speaks.

Bottom navigation. Four icons only, no labels: home (leaf icon), diagnose (camera icon), history (clock icon), settings (gear icon). Icons are large enough — minimum 32dp. The currently active tab has the green filled version of the icon.

Quick action icons. Between the mic and the bottom nav, show four large circular icon buttons only — no text labels under them. The icons are visual only: a flask icon for Jeevamrutha, a plant icon for mulching, a soil icon for soil health, a worm icon for vermicompost. Tapping any of these directly submits that query to the AI pipeline and the AI starts speaking the answer.

## Section 4 — Chat / Conversation Screen
The core rule. Responses are spoken, not read. The AI speaks every response immediately when it arrives. The text of the response appears on screen in large Kannada text only as a subtitle — think of it like captions on a video, not as the primary content.

Screen design. The conversation appears as a simple list. User turns show the transcript of what the farmer said, right-aligned, small text, gray background, 14sp maximum. AI turns show a large speaker icon on the left and the response as subtitle text below it, 18sp, high contrast, with the source citation in 12sp green below the response text. Every AI turn has a "🔊" button on the right side that replays the audio if the farmer missed it.

The mic button. Always visible at the bottom centre, same large pulsing circle from Home. The farmer never needs to find it.

Audio must play out loud fix. This is a critical bug. The issue is almost certainly the audio mode not being set correctly before playback. Apply this fix immediately.

```typescript
// mobile/services/audioService.ts
import { Audio } from 'expo-av';

// Call this ONCE at app startup in App.tsx or _layout.tsx
export async function configureAudioMode() {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    staysActiveInBackground: false,
    playsInSilentModeIOS: true,        // Critical for iOS — plays even on silent
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,  // Critical for Android — plays through speaker not earpiece
  });
}

// Call this before EVERY playback
export async function playAudioBase64(base64Audio: string): Promise<void> {
  // Switch mode to playback before playing
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    playThroughEarpieceAndroid: false,
  });

  const { sound } = await Audio.Sound.createAsync(
    { uri: `data:audio/mp3;base64,${base64Audio}` },
    { shouldPlay: true, volume: 1.0 }
  );

  // Wait for playback to complete
  await new Promise<void>((resolve) => {
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync();
        resolve();
      }
    });
  });

  // Switch back to recording mode after playback
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    playThroughEarpieceAndroid: false,
  });
}

// Call this before EVERY recording
export async function configureForRecording() {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    playThroughEarpieceAndroid: false,
  });
}
```

Why this fixes it. On Android, playThroughEarpieceAndroid: false forces playback through the loudspeaker instead of the earpiece. On iOS, playsInSilentModeIOS: true ensures audio plays even when the phone is on silent. The mode must be switched between recording mode and playback mode or both fail.

## Section 5 — Crop Disease Detection Screen
The entire flow is voice and visual only. Zero text response shown.

The farmer opens this screen. The camera viewfinder takes up 80% of the screen. One large round shutter button at the bottom. That is it. No instructions, no labels.

The farmer points the camera at the diseased crop and taps the shutter. The image captures. A loading animation plays — the Nivetti logo gently pulsing with a sound waveform animation underneath it. Then the AI speaks the diagnosis out loud immediately. No text response is displayed. The only text that appears is the disease name in Kannada in large bold text at the bottom of the screen, for 3 seconds, then it fades.

The spoken response is formatted like this: "ನಿಮ್ಮ ಟೊಮ್ಯಾಟೊ ಗೆ ಆರಂಭಿಕ ರೋಗ ಇದೆ. ಟ್ರೈಕೋಡರ್ಮ ಔಷಧಿ ಪ್ರತಿ ಲೀಟರ್ ನೀರಿಗೆ 5 ಗ್ರಾಂ ಬೆರೆಸಿ ಸಿಂಪಡಿಸಿ. ಮೂಲ: NIPHM IPM." Short. Spoken clearly. Action-oriented.

Backend change for diagnosis endpoint. The response must include audio_base64 and the mobile must auto-play it. The text fields are still in the response for logging purposes but the mobile ignores them for display.

```typescript
// mobile/screens/DiagnoseScreen.tsx
const handleDiagnosis = async (imageBase64: string) => {
  setLoading(true);
  const result = await sendDiagnosis(imageBase64);
  setLoading(false);
  
  // Play audio IMMEDIATELY — do not wait for UI to update
  if (result.audio_base64) {
    await playAudioBase64(result.audio_base64);
  }
  
  // Show disease name overlay briefly, then fade
  if (result.finding?.disease_name_kn) {
    setDiseaseOverlay(result.finding.disease_name_kn);
    setTimeout(() => setDiseaseOverlay(null), 3000);
  }
  // Do NOT display full text response
};
```

## Section 6 — Settings Screen (Language Selection)
What this screen does. Allows the farmer to change the app language and voice playback language. All AI responses will be delivered in the selected language. The interface of the app itself switches language for all spoken prompts.

Supported languages via Sarvam AI. Kannada (kn-IN) is default. Other options: Hindi (hi-IN), Tamil (ta-IN), Telugu (te-IN), Malayalam (ml-IN), Marathi (mr-IN), Bengali (bn-IN), Gujarati (gu-IN), Punjabi (pa-IN), Odia (or-IN). Show each language in its own script — ಕನ್ನಡ, हिंदी, தமிழ், తెలుగు, മലയാളം, मराठी, বাংলা, ਪੰਜਾਬੀ, ଓଡ଼ିଆ.

Screen design. Large radio button list. Each option is one row — the language name in its own script on the left, a checkmark on the right for the selected one. Current selection has a green background. One "ಉಳಿಸಿ" (Save) button at the bottom. Nothing else on this screen.

Store the language preference.

```typescript
// Add to useUserStore
preferred_language: string; // default 'kn-IN'
setLanguage: (lang: string) => void;
```

Pass language to backend on every request.

```typescript
// Every API call body includes:
user_context: {
  farmer_name: string,
  district: string,
  primary_crop: string,
  preferred_language: string  // 'kn-IN' | 'hi-IN' | 'ta-IN' etc.
}
```

Backend change. In m1_voice.py, the TTS call uses preferred_language from the request instead of hardcoded kn-IN.

```python
async def text_to_audio(text: str, api_key: str, language_code: str = "kn-IN") -> str:
    response = await client.post(
        SARVAM_TTS_URL,
        headers={"api-subscription-key": api_key},
        json={
            "inputs": [text],
            "target_language_code": language_code,  # Dynamic
            "speaker": LANGUAGE_SPEAKER_MAP.get(language_code, "meera"),
            "pace": 0.95,
            "loudness": 1.5,
            "model": "bulbul:v1",
        }
    )
    return response.json()["audios"][0]

# Speaker map per language
LANGUAGE_SPEAKER_MAP = {
    "kn-IN": "meera",
    "hi-IN": "arvind",
    "ta-IN": "anitha", 
    "te-IN": "vijay",
    "ml-IN": "neel",
    "mr-IN": "meera",
    "bn-IN": "meera",
    "gu-IN": "meera",
    "pa-IN": "meera",
    "or-IN": "meera",
}
```

The system prompt to Mistral must also know the language. Add the target language to the user message so Mistral generates the response in the right language.

```python
user_message = f"""...
TARGET LANGUAGE: {user_context.preferred_language}
Generate the response in this language. If Kannada (kn-IN), respond in Kannada script.
If Hindi (hi-IN), respond in Devanagari. Match the language to the farmer's preference.
..."""
```

## Section 7 — The Human-Like AI Voice Behaviour
How the AI should sound and feel.

The AI must sound like a trusted friend who is a farming expert, not like Siri or a customer service bot. Achieve this through the system prompt wording and the response format rules.

The response must always start with the farmer's name. "Ramesh ಅವರೇ" or "Ramesh ji" depending on language. This alone makes it feel human.

Responses are maximum 3 sentences when spoken. Farmers do not listen to long answers. They will shake the phone or walk away. Three sentences: one for what the problem is, one for what to do, one for when to do it. Source cited at the end.

The AI acknowledges the farmer's situation before giving advice. "ನಿಮ್ಮ ರಾಗಿ ಎಲೆ ಹಳದಿ ಆಗಿದೆ ಅಂತ ತಿಳಿಯಿತು" (I understand your ragi leaves are yellowing) before saying what to do. This warmth is not cosmetic — it builds trust.

Add to M5 system prompt:

VOICE FORMATTING RULES:
- Always start with farmer's name: "[Name] ಅವರೇ,"
- Maximum 3 sentences total
- Sentence 1: Acknowledge the issue
- Sentence 2: What to do (exact action, exact quantity)
- Sentence 3: When to do it
- End with: ಮೂಲ: [source]
- No lists, no bullet points, no headings — this is spoken word
- Use simple words a 60-year-old with no schooling can understand
- Speak as a trusted neighbour, not as a textbook

## Section 8 — Fix the API Errors
The errors in the screenshot are most likely one of these four things. First, the backend is returning the answer inside a nested object but the mobile is trying to read it from the wrong field. Check that the mobile reads response.data.answer_text_kn and that the backend actually sends answer_text_kn at the top level of the response JSON.

Second, the Mistral API call is failing silently and the error is not being caught and returned properly. Add this to every Mistral call:

```python
try:
    response = _mistral.chat.complete(
        model=MISTRAL_MODEL,
        messages=[...],
        temperature=0.1,
        max_tokens=400,
    )
    answer = response.choices[0].message.content.strip()
except Exception as e:
    print(f"Mistral API error: {e}")
    return KVK_REDIRECT_KN, []
```

Third, if the RAG is returning empty results and the confidence guard is blocking everything, the farmer gets the KVK redirect for every single question. Test this by temporarily lowering RAG_SIMILARITY_THRESHOLD to 0.40 in your .env and seeing if answers start coming through. If yes, your documents are not ingested correctly or the embedding model is not matching well.

Fourth, CORS is blocking the mobile from reaching the backend. Add this to FastAPI:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Section 9 — Complete Tech Stack Reference
Authentication:     Firebase Phone Auth (OTP)
Mobile:            React Native + Expo SDK 51
Styling:           NativeWind (Tailwind for RN)
State:             Zustand + AsyncStorage
Navigation:        Expo Router 3
Audio Recording:   expo-av (16kHz mono WAV)
Audio Playback:    expo-av (force loudspeaker)
Image:             expo-image-picker + expo-image-manipulator
Backend:           FastAPI (Python 3.11)
STT:               Sarvam AI Bulbul-v1 (saarika:v2)
TTS:               Sarvam AI Bulbul TTS (bulbul:v1)
Text LLM:          Mistral (mistral-small-latest)
Vision LLM:        Gemini 2.0 Flash (image diagnosis only)
Vision Fallback:   Mistral Pixtral-12b
RAG Embeddings:    sentence-transformers multilingual-mpnet-base-v2 (local)
Vector DB:         Supabase pgvector
Structured KB:     Supabase PostgreSQL
Knowledge Graph:   Supabase relational tables (Phase 1), Neo4j (Phase 2)
Deployment:        Vercel (backend), Expo EAS (mobile APK)

## Section 10 — Screen List and What Each Shows
Splash Screen. Nivetti logo centred on green background. 2 seconds. No text.

Phone Auth Screen. Logo top. Phone input centre. One button. No text except the button label.

OTP Screen. Masked phone number. Six OTP boxes. Countdown timer. Resend button after 30s.

Voice Onboarding Screen. Animated waveform showing AI is speaking. Animated microphone showing AI is listening. Farmer name shown on completion. No forms.

Home Screen. Farmer name greeting top right. Large mic circle centre. Four quick-action icons below mic. Four tab icons at bottom. AI speaks greeting on every open.

Conversation Screen. Simple message list. AI responses shown as large subtitle text only. Mic button fixed at bottom. Replay button on each AI message.

Diagnose Screen. Full-screen camera viewfinder. Single capture button. Loading animation while processing. Disease name overlay fades in then out. AI speaks diagnosis. No text response displayed.

History Screen. List of past conversations. Each row shows: crop icon, first thing farmer asked, date. Tap to replay the AI's spoken answer. No long text.

Settings Screen. Language selection list in native scripts. Profile edit option. Logout button. Nothing else.

## Section 11 — What Must Be True Before Demo to CEO
The app opens and speaks to the farmer without the farmer tapping anything. OTP login works on a real phone. Farmer name is always visible and always used in responses. Audio plays through the speaker loudly on both Android and iOS. Diagnose screen speaks the diagnosis and shows zero text response body. Language can be changed in settings and the next response comes in the new language. A farmer with no tech experience can complete a full interaction — login, ask a question, get a spoken answer — without reading a single piece of text. Nivetti Systems logo visible on every primary screen.

Give this document to every team member, every AI coding assistant, and attach it to your GitHub repository as MASTER_PROMPT.md. This is your single source of truth.
