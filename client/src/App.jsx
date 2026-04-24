import React, { useState, useEffect, useCallback, useRef } from "react";
import { SettingsProvider, useSettings } from "./context/SettingsContext";
import { useRecorder } from "./hooks/useRecorder";
import { useSession } from "./hooks/useSession";
import TranscriptPanel from "./components/TranscriptPanel";
import SuggestionsPanel from "./components/SuggestionsPanel";
import ChatPanel from "./components/ChatPanel";
import SettingsModal from "./components/SettingsModal";
import Header from "./components/Header";
import styles from "./App.module.css";

function AppInner() {
  const { settings } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(!settings.groqApiKey);

  const {
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
  } = useSession();

  const autoRefreshRef = useRef(null);

  const doRefresh = useCallback(async () => {
    const t = getFullTranscript();
    if (t.trim()) await fetchSuggestions(t);
  }, [getFullTranscript, fetchSuggestions]);

  const handleTranscriptChunk = useCallback(
    (text) => addTranscriptChunk(text),
    [addTranscriptChunk]
  );

  const {
    isRecording,
    isTranscribing,
    error: recorderError,
    audioSource,
    setAudioSource,
    startRecording,
    stopRecording,
    flushNow,
  } = useRecorder({ onTranscriptChunk: handleTranscriptChunk });

  useEffect(() => {
    if (isRecording) {
      autoRefreshRef.current = setInterval(
        doRefresh,
        (settings.refreshInterval || 30) * 1000
      );
    } else {
      clearInterval(autoRefreshRef.current);
    }
    return () => clearInterval(autoRefreshRef.current);
  }, [isRecording, doRefresh, settings.refreshInterval]);

  const handleManualRefresh = useCallback(async () => {
    if (isRecording) await flushNow();
    await doRefresh();
  }, [isRecording, flushNow, doRefresh]);

  return (
    <div className={styles.app}>
      <Header
        isRecording={isRecording}
        isTranscribing={isTranscribing}
        audioSource={audioSource}
        onSourceChange={setAudioSource}
        onStart={startRecording}
        onStop={stopRecording}
        onSettings={() => setSettingsOpen(true)}
        onExport={exportSession}
        hasKey={!!settings.groqApiKey}
      />

      <div className={styles.columns}>
        <TranscriptPanel
          lines={transcriptLines}
          isRecording={isRecording}
          isTranscribing={isTranscribing}
          error={recorderError}
        />

        <SuggestionsPanel
          batches={suggestionBatches}
          isLoading={isFetchingSuggestions}
          error={suggestionError}
          onRefresh={handleManualRefresh}
          onSuggestionClick={expandSuggestion}
          isRecording={isRecording}
        />

        <ChatPanel
          messages={chatMessages}
          isLoading={isFetchingChat}
          error={chatError}
          onSend={sendChatMessage}
        />
      </div>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <AppInner />
    </SettingsProvider>
  );
}
