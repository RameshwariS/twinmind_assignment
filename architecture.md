# TwinMind — Architecture & Workflow

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, CSS Modules |
| Backend | Node.js, Express (ESM) |
| Transcription | Groq — Whisper Large V3 |
| Suggestions & Chat | Groq — Llama 3.1 8B Instant |
| Audio Capture | Web Audio API, MediaRecorder API, getDisplayMedia |
| State Management | React hooks + useRef (no external store) |
| Persistence | localStorage (API key + settings only) |

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                         │
│                                                                 │
│  ┌───────────────┐   ┌─────────────────┐   ┌────────────────┐  │
│  │  Transcript   │   │   Suggestions   │   │     Chat       │  │
│  │    Panel      │   │     Panel       │   │    Panel       │  │
│  └──────┬────────┘   └────────┬────────┘   └──────┬─────────┘  │
│         │                    │                    │             │
│  ┌──────┴────────────────────┴────────────────────┴─────────┐  │
│  │                        App.jsx                           │  │
│  │         (layout, auto-refresh timer, prop wiring)        │  │
│  └──────┬──────────────────────────────────────────────┬────┘  │
│         │                                              │        │
│  ┌──────┴────────┐                          ┌──────────┴─────┐  │
│  │  useRecorder  │                          │   useSession   │  │
│  │  (audio loop) │                          │  (state + API) │  │
│  └──────┬────────┘                          └──────────┬─────┘  │
│         │                                              │        │
│   MediaRecorder                                   fetch()       │
│   getUserMedia /                                               │
│   getDisplayMedia                                              │
└─────────┬──────────────────────────────────────────────┬───────┘
          │  multipart/form-data (audio blob)            │  JSON
          │                                              │
┌─────────┴──────────────────────────────────────────────┴───────┐
│                     Express Server (:3001)                      │
│                                                                 │
│   POST /api/transcribe   POST /api/suggestions                  │
│   POST /api/expand       POST /api/chat                         │
└─────────┬──────────────────────────────────────────────┬───────┘
          │                                              │
          │  Whisper Large V3                  Llama 3.1 8B Instant
          └──────────────────────┬───────────────────────┘
                                 │
                        ┌────────┴────────┐
                        │   Groq Cloud    │
                        └─────────────────┘
```

---

## Audio Capture Pipeline

The audio pipeline is the most technically precise part of the system. It is managed entirely by `useRecorder.js`.

### Source Acquisition

```
Source: "mic"
  └── navigator.mediaDevices.getUserMedia({ audio: true })
      └── MediaStream (mic tracks only)

Source: "system"
  └── navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      ├── Drop all video tracks immediately
      └── MediaStream (tab audio tracks only)

Source: "both"
  ├── getUserMedia  ──────────────────────┐
  └── getDisplayMedia (drop video) ───────┤
                                          ▼
                                   AudioContext
                                   ├── createMediaStreamSource(mic) → connect(dest)
                                   └── createMediaStreamSource(tab) → connect(dest)
                                          ▼
                                   dest.stream (mixed MediaStream)
```

Every stream regardless of source gets a `._stop()` method attached. This handles teardown uniformly — mic stops its tracks, tab stops its tracks, "both" stops all tracks and closes the AudioContext.

### Recording Loop

```
startRecording()
  │
  ▼
getAudioStream(source)
  │
  ▼
async loop: while (isRecordingRef.current)
  │
  ├── new MediaRecorder(stream)        ← fresh instance every window
  │     ondataavailable → push chunks
  │     onstop → build Blob → transcribe
  │
  ├── mr.start()
  ├── setTimeout(mr.stop, 30_000)      ← 30s window
  │
  └── await transcription complete
        │
        └── loop back to top → new MediaRecorder
```

**Why a fresh MediaRecorder per window:** A WebM file begins with an EBML header and a Tracks element. When `MediaRecorder.start(N)` is used with a timeslice, only the first `ondataavailable` event contains these headers. Subsequent events are raw Cluster data — not valid standalone files. Groq's Whisper endpoint requires a complete, decodable file. Starting a new `MediaRecorder` instance for each window guarantees the first `ondataavailable` always contains a full header.

### Manual Flush (Refresh Button)

```
flushNow()
  │
  ├── isRecordingRef.current = false   ← exits the loop after current window
  ├── stream._stop()                   ← triggers onstop on active MediaRecorder
  ├── await 400ms                      ← let transcription fire
  ├── getAudioStream(source)           ← re-acquire fresh stream
  └── restart loop
```

---

## Server Routes

The Express server is intentionally thin — no database, no sessions, no authentication layer. It exists to proxy Groq API calls server-side so the API key is never exposed in client network requests.

### POST /api/transcribe

```
Input:  multipart/form-data
        audio: Blob (WebM or OGG)
        groqApiKey: string

Processing:
  1. Re-wrap buffer as FormData for Groq's multipart endpoint
  2. POST to https://api.groq.com/openai/v1/audio/transcriptions
     model: whisper-large-v3
     response_format: json
  3. Return { text: string }
```

Note: The Groq Node SDK does not support Buffer input for Whisper. The route uses `node-fetch` + `form-data` directly to construct a proper multipart request.

### POST /api/suggestions

```
Input:  { transcript, groqApiKey, prompt?, contextWindow? }

Processing:
  1. Slice transcript to last N chars (contextWindow, default 3000)
  2. Build system prompt with 5 suggestion types, strict JSON output schema
  3. Call Llama 3.1 8B Instant (temperature 0.7, max_tokens 800)
  4. Strip markdown fences from response
  5. JSON.parse → return { suggestions: [{title, preview, type}] }

Context window is tail-trimmed (most recent content kept) because
recency is more important than full history for live suggestions.
```

### POST /api/expand

```
Input:  { suggestion, transcript, groqApiKey, prompt?, contextWindow? }

Processing:
  1. Slice transcript to last N chars (contextWindow, default 6000)
  2. Inject suggestion title, type, and preview into user message
  3. Call Llama 3.1 8B Instant (temperature 0.5, max_tokens 1000)
  4. Return { answer: markdown string }

Lower temperature than suggestions (0.5 vs 0.7) because expanded
answers should be precise and grounded, not creative.
```

### POST /api/chat

```
Input:  { messages[], transcript, groqApiKey, prompt?, contextWindow? }

Processing:
  1. Slice transcript to last N chars (contextWindow, default 6000)
  2. Prepend system message containing base prompt + transcript context
  3. Append full message history (last 20 turns from client)
  4. Call Llama 3.1 8B Instant (temperature 0.6, max_tokens 1200)
  5. Return { answer: markdown string }

The transcript context is re-injected on every turn so the model
always has the latest conversation state, even mid-session.
```

---

## Frontend State Architecture

State is split across two custom hooks with no shared store.

### useRecorder

Owns all audio state: `isRecording`, `isTranscribing`, `error`, `audioSource`. Calls `onTranscriptChunk` callback (passed from App) when a transcription lands. Knows nothing about suggestions or chat.

### useSession

Owns all session data: `transcriptLines[]`, `suggestionBatches[]`, `chatMessages[]`. Exposes async methods (`fetchSuggestions`, `expandSuggestion`, `sendChatMessage`, `exportSession`). Knows nothing about audio.

### App.jsx — Orchestration Layer

```
App.jsx
  │
  ├── useRecorder({ onTranscriptChunk: addTranscriptChunk })
  │     ↓ fires on each 30s transcription
  │     addTranscriptChunk(text)
  │
  ├── useEffect([isRecording])
  │     setInterval(doRefresh, refreshInterval * 1000)
  │     ↓ every N seconds while recording
  │     fetchSuggestions(getFullTranscript())
  │
  └── handleManualRefresh()
        ├── flushNow()              ← end current audio window early
        └── fetchSuggestions(...)   ← generate suggestions immediately
```

The auto-refresh timer and the audio loop are intentionally decoupled. The timer fires on a wall-clock interval; the audio loop fires on audio chunk boundaries. They do not need to be synchronised.

---

## Prompt Engineering Strategy

### Suggestion Prompt

The suggestion prompt enforces three constraints that most implementations miss:

**Type variety:** The model is explicitly told to vary types across the three suggestions. A batch of three QUESTION cards is considered a failure. The prompt names five types and instructs the model to pick the most contextually appropriate mix.

**Recency bias:** The instruction "base suggestions on the MOST RECENT part of the transcript" is explicit. The context window is tail-trimmed so the most recent content is always included even when the transcript is long.

**Preview quality:** The preview is required to deliver standalone value — not act as a click teaser. This is enforced in the prompt: "The preview must be immediately useful on its own." Generic previews like "Click to learn more" are explicitly out of scope.

**Strict JSON output:** The model is told to return only valid JSON with no markdown fences, no preamble, no explanation. The server strips fences defensively anyway.

### Expand Prompt

Lower temperature (0.5) and a longer context window (6000 chars) than suggestions. The user has clicked a card, which means they want depth. The model is told to use markdown formatting and structure the answer for fast scanning — the user is still in a live meeting.

### Chat Prompt

Medium temperature (0.6). The full message history is sent so the model can reference earlier answers. The transcript is re-injected every turn so "what did they say about X?" questions work correctly even if X was mentioned 10 minutes ago and is now outside the history window.

---

## Data Flow — End to End

```
User speaks / YouTube plays
         │
         ▼
MediaRecorder captures 30s of audio
         │
         ▼
POST /api/transcribe (Whisper Large V3)
         │
         ▼
transcript chunk appended to transcriptLines[]
         │
    (every 30s or on manual refresh)
         ▼
POST /api/suggestions (Llama 3.1 8B)
  context = transcript.slice(-3000)
         │
         ▼
new batch prepended to suggestionBatches[]
  shown at top of middle panel
         │
    (user clicks a card)
         ▼
POST /api/expand (Llama 3.1 8B)
  context = transcript.slice(-6000)
  suggestion = { title, preview, type }
         │
         ▼
answer appended to chatMessages[]
  rendered as markdown in right panel
         │
    (user types a follow-up)
         ▼
POST /api/chat (Llama 3.1 8B)
  system = base prompt + transcript.slice(-6000)
  messages = last 20 turns
         │
         ▼
answer appended to chatMessages[]
```

---

## Security Model

The Groq API key is stored in `localStorage` and sent with every request to the Express server inside the request body. The server reads it, uses it for the Groq call, and discards it. The key is never logged server-side and never persisted. No session tokens, no cookies, no server-side state of any kind.

The server is CORS-open (`*`) for development. For production deployment the CORS origin should be locked to the client's domain.

---

## Deployment

```
Client (Vite build → static files)
  └── Vercel / Netlify / any static host
      └── Proxies /api/* → Express server URL

Server (Node.js ESM)
  └── Railway / Render / Fly.io / any Node host
      └── PORT env var (default 3001)
```

The Vite dev server proxies `/api` to `localhost:3001` during development. For production, either configure the client's hosting platform to proxy `/api`, or set `VITE_API_BASE` to the server URL and prefix all `fetch()` calls with it.
