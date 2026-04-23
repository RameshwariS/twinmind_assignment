import express from "express";
import cors from "cors";
import multer from "multer";
import Groq from "groq-sdk";
import FormData from "form-data";
import fetch from "node-fetch";

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGroq(apiKey) {
  if (!apiKey) throw new Error("Missing Groq API key");
  return new Groq({ apiKey });
}

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * POST /api/transcribe
 * Accepts a webm/opus audio blob + groqApiKey, returns { text }
 */
app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  try {
    const apiKey = req.body.groqApiKey;
    if (!apiKey) return res.status(400).json({ error: "groqApiKey required" });
    if (!req.file) return res.status(400).json({ error: "audio file required" });

    // Groq SDK doesn't support Buffer directly for whisper — use raw fetch
    const form = new FormData();
    form.append("file", req.file.buffer, {
      filename: "audio.webm",
      contentType: req.file.mimetype || "audio/webm",
    });
    form.append("model", "whisper-large-v3");
    form.append("response_format", "json");

    const response = await fetch(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, ...form.getHeaders() },
        body: form,
      }
    );

    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || "Transcription failed");

    res.json({ text: data.text || "" });
  } catch (err) {
    console.error("[transcribe]", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/suggestions
 * Body: { transcript, groqApiKey, prompt, contextWindow }
 * Returns: { suggestions: [{title, preview, type}] }
 */
app.post("/api/suggestions", async (req, res) => {
  try {
    const {
      transcript,
      groqApiKey,
      prompt: customPrompt,
      contextWindow = 3000,
    } = req.body;

    const groq = getGroq(groqApiKey);

    // Trim transcript to contextWindow chars from the end
    const context = transcript.slice(-contextWindow);

    const systemPrompt =
      customPrompt ||
      `You are TwinMind, a real-time AI meeting copilot. Your job is to surface exactly 3 highly useful, context-aware suggestions to the user WHILE a conversation is happening.

SUGGESTION TYPES — pick the most useful mix for the current moment:
- QUESTION: A smart follow-up question the user could ask right now
- ANSWER: A direct answer to a question that was just raised in the conversation
- FACT_CHECK: Verify or clarify a specific claim made in the conversation
- TALKING_POINT: A key point or perspective the user could bring up to advance the discussion
- CLARIFICATION: Define or explain a term/concept just mentioned

RULES:
1. Return ONLY valid JSON — no markdown, no code fences.
2. Return exactly 3 suggestions.
3. Each suggestion must have: title (≤12 words, action-oriented), preview (1–2 crisp sentences that deliver standalone value even unclicked), type (one of: QUESTION|ANSWER|FACT_CHECK|TALKING_POINT|CLARIFICATION).
4. Vary the types — don't return 3 of the same.
5. Base suggestions on the MOST RECENT part of the transcript; ignore old context unless directly relevant.
6. Be specific to what was actually said — generic suggestions are failures.
7. The preview must be immediately useful on its own — not a teaser.

Output format (strict JSON, no other text):
{
  "suggestions": [
    {"title": "...", "preview": "...", "type": "QUESTION"},
    {"title": "...", "preview": "...", "type": "ANSWER"},
    {"title": "...", "preview": "...", "type": "TALKING_POINT"}
  ]
}`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Here is the conversation transcript (most recent at the bottom):\n\n${context}\n\nGenerate 3 suggestions now.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 800,
    });

    const raw = completion.choices[0]?.message?.content || "{}";

    // Strip possible markdown fences
    const cleaned = raw.replace(/```json\n?|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    res.json({ suggestions: parsed.suggestions || [] });
  } catch (err) {
    console.error("[suggestions]", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/expand
 * Body: { suggestion, transcript, groqApiKey, prompt, contextWindow }
 * Returns: { answer }
 */
app.post("/api/expand", async (req, res) => {
  try {
    const {
      suggestion,
      transcript,
      groqApiKey,
      prompt: customPrompt,
      contextWindow = 6000,
    } = req.body;

    const groq = getGroq(groqApiKey);
    const context = transcript.slice(-contextWindow);

    const systemPrompt =
      customPrompt ||
      `You are TwinMind, an AI meeting copilot providing detailed, actionable answers to help the user during a live conversation.

When given a suggestion card and transcript context, provide:
- A thorough, well-structured answer (use markdown: headers, bullets, bold as needed)
- Specific, concrete details relevant to what was discussed
- Practical next steps or talking points when relevant
- Keep it scannable — the user is in a live meeting
- Length: 150–400 words depending on complexity`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `CONVERSATION TRANSCRIPT:\n${context}\n\n---\nSUGGESTION CLICKED:\nTitle: ${suggestion.title}\nType: ${suggestion.type}\nPreview: ${suggestion.preview}\n\nProvide a detailed, helpful response.`,
        },
      ],
      temperature: 0.5,
      max_tokens: 1000,
    });

    res.json({ answer: completion.choices[0]?.message?.content || "" });
  } catch (err) {
    console.error("[expand]", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/chat
 * Body: { messages, transcript, groqApiKey, prompt, contextWindow }
 * Returns: { answer } (streaming not supported here; single response)
 */
app.post("/api/chat", async (req, res) => {
  try {
    const {
      messages,
      transcript,
      groqApiKey,
      prompt: customPrompt,
      contextWindow = 6000,
    } = req.body;

    const groq = getGroq(groqApiKey);
    const context = transcript.slice(-contextWindow);

    const systemPrompt =
      customPrompt ||
      `You are TwinMind, an AI meeting copilot. You have access to the live conversation transcript and help the user in real time.

Guidelines:
- Be direct, specific, and immediately useful
- Reference what was actually said in the meeting when relevant
- Use markdown formatting for clarity
- Keep answers focused — the user is in a live meeting
- If asked about something in the conversation, ground your answer in the transcript`;

    const systemMessage = {
      role: "system",
      content: `${systemPrompt}\n\nCURRENT TRANSCRIPT CONTEXT:\n${context}`,
    };

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [systemMessage, ...messages],
      temperature: 0.6,
      max_tokens: 1200,
    });

    res.json({ answer: completion.choices[0]?.message?.content || "" });
  } catch (err) {
    console.error("[chat]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`TwinMind server running on :${PORT}`));
