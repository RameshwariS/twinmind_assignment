import { useState, useCallback, useRef } from "react";
import { useSettings } from "../context/SettingsContext";

export function useSession() {
  const { settings } = useSettings();

  // Transcript: array of { id, text, timestamp }
  const [transcriptLines, setTranscriptLines] = useState([]);
  // Suggestion batches: array of { id, timestamp, items: [{title, preview, type}] }
  const [suggestionBatches, setSuggestionBatches] = useState([]);
  // Chat messages: array of { id, role, content, timestamp }
  const [chatMessages, setChatMessages] = useState([]);

  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [isFetchingChat, setIsFetchingChat] = useState(false);
  const [suggestionError, setSuggestionError] = useState(null);
  const [chatError, setChatError] = useState(null);

  const idRef = useRef(0);
  const nextId = () => ++idRef.current;

  // Full transcript as a single string
  const getFullTranscript = useCallback(
    () => transcriptLines.map((l) => l.text).join("\n"),
    [transcriptLines]
  );

  // Append a new transcript chunk
  const addTranscriptChunk = useCallback((text) => {
    setTranscriptLines((prev) => [
      ...prev,
      { id: nextId(), text, timestamp: Date.now() },
    ]);
  }, []);

  // Fetch suggestions from backend
  const fetchSuggestions = useCallback(
    async (transcript) => {
      if (!settings.groqApiKey) {
        setSuggestionError("No API key — open Settings first.");
        return;
      }
      if (!transcript.trim()) return;

      setIsFetchingSuggestions(true);
      setSuggestionError(null);

      try {
        const res = await fetch("/api/suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript,
            groqApiKey: settings.groqApiKey,
            prompt: settings.suggestionPrompt || undefined,
            contextWindow: settings.suggestionContextWindow,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Suggestion fetch failed");

        const batch = {
          id: nextId(),
          timestamp: Date.now(),
          items: data.suggestions || [],
        };
        setSuggestionBatches((prev) => [batch, ...prev]);
      } catch (err) {
        setSuggestionError(err.message);
      } finally {
        setIsFetchingSuggestions(false);
      }
    },
    [settings]
  );

  // Expand a suggestion into full chat answer
  const expandSuggestion = useCallback(
    async (suggestion) => {
      const transcript = getFullTranscript();

      // Add suggestion as a user message
      const userMsg = {
        id: nextId(),
        role: "user",
        content: `**${suggestion.title}**\n\n${suggestion.preview}`,
        timestamp: Date.now(),
        isSuggestionClick: true,
      };
      setChatMessages((prev) => [...prev, userMsg]);
      setIsFetchingChat(true);
      setChatError(null);

      try {
        const res = await fetch("/api/expand", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            suggestion,
            transcript,
            groqApiKey: settings.groqApiKey,
            prompt: settings.expandPrompt || undefined,
            contextWindow: settings.expandContextWindow,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Expand failed");

        const aiMsg = {
          id: nextId(),
          role: "assistant",
          content: data.answer,
          timestamp: Date.now(),
        };
        setChatMessages((prev) => [...prev, aiMsg]);
      } catch (err) {
        setChatError(err.message);
      } finally {
        setIsFetchingChat(false);
      }
    },
    [getFullTranscript, settings]
  );

  // Send a typed chat message
  const sendChatMessage = useCallback(
    async (text) => {
      const transcript = getFullTranscript();

      const userMsg = {
        id: nextId(),
        role: "user",
        content: text,
        timestamp: Date.now(),
      };
      setChatMessages((prev) => [...prev, userMsg]);
      setIsFetchingChat(true);
      setChatError(null);

      try {
        // Build message history for the API (last 20 turns)
        const history = [...chatMessages, userMsg]
          .slice(-20)
          .map(({ role, content }) => ({ role, content }));

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            transcript,
            groqApiKey: settings.groqApiKey,
            prompt: settings.chatPrompt || undefined,
            contextWindow: settings.chatContextWindow,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Chat failed");

        const aiMsg = {
          id: nextId(),
          role: "assistant",
          content: data.answer,
          timestamp: Date.now(),
        };
        setChatMessages((prev) => [...prev, aiMsg]);
      } catch (err) {
        setChatError(err.message);
      } finally {
        setIsFetchingChat(false);
      }
    },
    [getFullTranscript, chatMessages, settings]
  );

  // Export session as JSON
  const exportSession = useCallback(() => {
    const session = {
      exportedAt: new Date().toISOString(),
      transcript: transcriptLines.map((l) => ({
        timestamp: new Date(l.timestamp).toISOString(),
        text: l.text,
      })),
      suggestionBatches: suggestionBatches.map((b) => ({
        timestamp: new Date(b.timestamp).toISOString(),
        suggestions: b.items,
      })),
      chat: chatMessages.map((m) => ({
        timestamp: new Date(m.timestamp).toISOString(),
        role: m.role,
        content: m.content,
      })),
    };

    const blob = new Blob([JSON.stringify(session, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `twinmind-session-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [transcriptLines, suggestionBatches, chatMessages]);

  return {
    transcriptLines,
    suggestionBatches,
    chatMessages,
    isFetchingSuggestions,
    isFetchingChat,
    suggestionError,
    chatError,
    addTranscriptChunk,
    fetchSuggestions,
    expandSuggestion,
    sendChatMessage,
    getFullTranscript,
    exportSession,
  };
}
