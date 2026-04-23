# TwinMind — Live Meeting Copilot

A real-time AI meeting assistant that listens to your mic, transcribes audio in chunks, and surfaces contextual suggestions while you talk. Built with MERN stack (MongoDB not used — stateless session design) + Groq APIs.

---

## Live Demo

Deploy yourself (see below) then paste your Groq API key in Settings.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite (CSS Modules) |
| Backend | Node.js + Express (ESM) |
| Transcription | Groq — Whisper Large V3 |
| AI | Groq — meta-llama/llama-4-maverick-17b-128e-instruct |
| Audio capture | Web MediaRecorder API |

---

## Setup

### Prerequisites
- Node.js 18+
- A [Groq API key](https://console.groq.com/keys)

### Install & Run

```bash
# Clone and install everything
git clone <repo-url>
cd twinmind
npm run install:all

# Start both server (port 3001) and client (port 5173)
npm run dev
```

Open `http://localhost:5173`, click the ⚙ gear icon, paste your Groq key, save, and start recording.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      Browser (React)                      │
│                                                           │
│  [Transcript]      [Suggestions]         [Chat]          │
│  useRecorder       useSession            ChatPanel        │
│       │                 │                    │           │
│       └─────────────────┴────────────────────┘           │
│                         │                                 │
└─────────────────────────┼─────────────────────────────────┘
                          │ fetch /api/*
┌─────────────────────────┼─────────────────────────────────┐
│            Express Server (port 3001)                      │
│                         │                                 │
│  /api/transcribe   /api/suggestions  /api/expand          │
│  /api/chat                                                │
│       │                 │                    │           │
└───────┼─────────────────┼────────────────────┼───────────┘
        │                 │                    │
   Groq Whisper      Groq LLaMA4          Groq LLaMA4
   Large V3          Maverick             Maverick
```

### Audio Flow
1. `MediaRecorder` captures mic audio continuously in 250ms slices
2. Every 30s (configurable), buffered audio is flushed to `/api/transcribe`
3. Whisper Large V3 returns text → appended to transcript panel
4. After each transcript chunk arrives, suggestions are auto-fetched
5. A manual Refresh button also flushes audio + fetches suggestions immediately

---

## Prompt Strategy

### Suggestion Prompt (the core challenge)

The suggestion system uses **typed suggestions** with 5 distinct types:

| Type | When to use |
|---|---|
| `QUESTION` | A smart follow-up the user could ask right now |
| `ANSWER` | A direct answer to a question just raised |
| `FACT_CHECK` | Verify/clarify a specific claim just made |
| `TALKING_POINT` | A key point to advance the discussion |
| `CLARIFICATION` | Define a term or concept just mentioned |

The prompt instructs the model to:
- **Vary types** — never return 3 of the same
- **Be specific** — generic suggestions are explicitly called failures
- **Preview must stand alone** — delivers value without tapping
- **Focus on recency** — base suggestions on the most recent transcript, not old context
- Return **strict JSON** only — no markdown fences, no preamble

The context window is trimmed from the **tail** of the transcript (most recent = most relevant). Default: 3,000 chars (~500 words, ~3–4 minutes of speech).

### Expand Prompt

When a suggestion is tapped, the full transcript (up to 6,000 chars) is re-sent alongside the clicked suggestion's title, type, and preview. The model is instructed to:
- Produce a structured markdown response (headers, bullets, bold)
- Be scannable — user is in a live meeting
- Ground the answer in what was actually said

### Chat Prompt

The transcript context is injected into the system prompt at every turn. The model maintains conversation continuity via rolling message history (last 20 turns). Each message has full transcript awareness without re-sending the whole history.

---

## Tradeoffs & Decisions

**Why not streaming?**
The `/api/expand` and `/api/chat` endpoints return full responses. Streaming would add complexity (SSE/chunked transfer) for modest UX gain given Groq's already low TTFT (~200–400ms). Can be added if latency becomes a concern.

**Why trim context from the tail?**
The most recent ~3 minutes of conversation is almost always more relevant for suggestions than older context. Trimming from the end rather than the beginning avoids feeding stale context to the model.

**Why typed suggestions?**
Without explicit types, models default to homogeneous suggestions (usually all questions). Typed suggestions force diversity and give the model clear decision criteria for what to surface when.

**Why no database?**
Sessions are ephemeral. The export feature handles persistence needs. Adding MongoDB would add operational overhead with no product benefit for this use case.

**Why Vite proxy instead of CORS?**
Simpler local dev experience. In production, server and client are deployed separately; the client's API base URL would need to be set via env var.

---

## Settings (all editable in UI)

| Setting | Default | Description |
|---|---|---|
| Suggestion context window | 3,000 chars | Transcript tail fed to suggestion model |
| Expand context window | 6,000 chars | Transcript fed on suggestion tap |
| Chat context window | 6,000 chars | Transcript in chat system prompt |
| Auto-refresh interval | 30s | How often suggestions auto-refresh while recording |
| Suggestion prompt | Built-in | Override the suggestion system prompt |
| Expand prompt | Built-in | Override the expand system prompt |
| Chat prompt | Built-in | Override the chat system prompt |

---

## Deployment

### Vercel (recommended)

```bash
# Deploy client
cd client && npm run build
# Upload dist/ to Vercel or use Vercel CLI

# Deploy server separately (Vercel serverless or Railway/Render)
```

Or use a monorepo setup with `vercel.json` routing `/api/*` to the Express server.

### Railway / Render

Both support Node.js servers directly. Set `PORT` env var; the server reads it automatically.

---

## File Structure

```
twinmind/
├── package.json              # Root: runs both server + client
├── README.md
├── .gitignore
│
├── server/
│   ├── package.json
│   └── index.js              # Express API routes
│
└── client/
    ├── package.json
    ├── vite.config.js        # Dev proxy: /api → localhost:3001
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx           # Layout + auto-refresh orchestration
        ├── App.module.css
        ├── index.css         # Design tokens + global styles
        ├── context/
        │   └── SettingsContext.jsx   # API key + prompt settings
        ├── hooks/
        │   ├── useRecorder.js        # MediaRecorder + chunked transcription
        │   └── useSession.js         # Suggestions, chat, export state
        └── components/
            ├── Header.jsx/.module.css
            ├── TranscriptPanel.jsx/.module.css
            ├── SuggestionsPanel.jsx/.module.css
            ├── ChatPanel.jsx/.module.css
            └── SettingsModal.jsx/.module.css
```
