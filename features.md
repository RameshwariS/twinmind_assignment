# TwinMind — Feature Overview

TwinMind is a real-time AI meeting copilot that listens to live conversations and continuously surfaces useful, context-aware suggestions while you talk. It works across online meetings, YouTube lectures, and in-person conversations.

---

## Core Features

### Live Audio Capture with Three Source Modes

TwinMind captures audio from three distinct sources selectable from the header — and unlike most tools it is not limited to just the microphone.

**Mic** captures only the local microphone. Best for in-person meetings or phone calls where the remote audio is playing through speakers.

**Tab** uses the browser's `getDisplayMedia` API to tap directly into the audio pipeline of any open browser tab — YouTube, Google Meet, Zoom web, Microsoft Teams, or any other web-based audio source. This is a digital capture at the source, completely independent of whether headphones are plugged in or not. The audio is captured before it ever reaches the output device.

**Both** mixes the microphone stream and the tab audio stream together using the Web Audio API's `AudioContext`. This means your voice and the other participants' voices are captured simultaneously and sent as a single merged audio blob for transcription. This is the recommended mode for online meetings where you are also speaking.

---

### Chunked Transcription via Whisper Large V3

Audio is not streamed continuously. Instead, TwinMind records a complete, self-contained audio file every 30 seconds and sends it to Groq's Whisper Large V3 model for transcription. Each recording window is handled by a fresh `MediaRecorder` instance, which guarantees that every blob has proper WebM container headers and is a valid standalone audio file — a common source of failure in audio apps that concatenate incremental chunks.

The transcript appears in the left panel with timestamps, auto-scrolling to the latest line. A loading indicator shows when transcription is in progress.

---

### Contextual Live Suggestions

Every 30 seconds (auto) or on demand (manual refresh button), TwinMind analyses the most recent portion of the transcript and generates exactly three suggestions. These are not generic prompts — they are typed, grounded in what was actually said, and varied by design.

**Five suggestion types:**

| Type | When it appears |
|---|---|
| QUESTION | A smart follow-up the user could ask right now |
| ANSWER | A direct response to a question raised in the conversation |
| FACT_CHECK | Verification or pushback on a specific claim that was made |
| TALKING_POINT | A perspective or argument the user could introduce |
| CLARIFICATION | A definition or explanation of a term just used |

The model is instructed to pick the most useful mix for the current moment — so a batch might be one ANSWER, one QUESTION, and one FACT_CHECK depending on what the conversation needs. Returning three of the same type is explicitly penalised in the prompt.

Each suggestion card has a **preview** — one or two sentences that deliver standalone value even without clicking. The preview is not a teaser. You can read the card and already have something useful.

---

### One-Click Expanded Answers

Clicking any suggestion card sends it to the chat panel with the full transcript as context. A separate, longer-form prompt is used for expanded answers, producing a structured markdown response with headers, bullets, and bold text sized for quick scanning during a live meeting. Typical response length is 150–400 words.

The expanded answer is grounded in the actual transcript — the model is given the full conversation history, not just the suggestion text.

---

### Persistent Chat Panel

The right panel is a continuous chat for the entire session. You can:

- Click any suggestion to open a detailed answer
- Type freeform questions at any point
- Ask follow-ups on previous answers

The chat maintains a rolling 20-message history sent to the model on every turn, so it can reference earlier answers in the same session. Every response is injected with the latest transcript context as a system message, keeping the model grounded in what was actually discussed.

---

### Manual Refresh

The refresh button in the suggestions panel does two things atomically: it stops the current audio recording window early (triggering an immediate transcription of whatever has been captured so far), waits for that transcription to land, then fetches fresh suggestions based on the updated transcript. This is useful when something important was just said and you do not want to wait for the 30-second cycle.

---

### Fully Configurable via Settings

A settings modal (gear icon, top right) exposes every parameter that affects quality:

- **Groq API key** — stored in localStorage, never sent anywhere except Groq's API
- **Suggestion prompt** — override the system prompt used for generating suggestion cards
- **Expand prompt** — override the prompt used when a card is clicked
- **Chat prompt** — override the base system prompt for the freeform chat
- **Suggestion context window** — how many characters of recent transcript are sent for suggestions (default 3000)
- **Expand context window** — how many characters are sent when expanding a suggestion (default 6000)
- **Chat context window** — transcript context injected into every chat turn (default 6000)
- **Refresh interval** — how often auto-refresh fires in seconds (default 30)

All defaults are pre-filled with the values that produced the best results during development.

---

### Session Export

A download button (top right) exports the entire session as a structured JSON file containing:

- Full transcript with per-chunk timestamps
- Every suggestion batch with its timestamp and all three suggestion objects
- Full chat history with timestamps and roles

This file is the primary deliverable for session review and is the format used to evaluate the quality of suggestions after a meeting.

---

## What Makes It Different

**Audio source flexibility.** Most browser-based transcription tools only support microphone input. TwinMind's Tab and Both modes capture system audio digitally, making it work correctly with headphones and eliminating the need for loopback software on macOS or Windows.

**Valid audio blobs every time.** The MediaRecorder restart pattern (one instance per 30-second window rather than one long-running instance with sliced chunks) eliminates the corrupt-file errors that affect most browser audio implementations. Every blob sent to Whisper is a complete, decodable file.

**Suggestions that vary by context.** The prompt is engineered to produce a typed mix rather than three questions or three talking points. The model picks the types — ANSWER when a question was just asked, FACT_CHECK when a claim was made, QUESTION when exploration would be useful. This mirrors how a knowledgeable colleague would intervene.

**Previews that deliver value unclicked.** Each suggestion card's preview is constrained by the prompt to be immediately useful — not a "click to find out" teaser. The card should be worth reading even if you never tap it.

**Everything is overridable.** Every prompt, every context window, the refresh interval — all configurable at runtime without touching code. This makes it possible to tune the system for different meeting types (technical, sales, academic, 1:1s) without a redeploy.

**No login, no backend storage.** The API key lives in the browser's localStorage. No session data is persisted server-side. The Express server is stateless — it receives a request, calls Groq, returns the result, and forgets everything.
