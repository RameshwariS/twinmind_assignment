import { useState, useRef, useCallback } from "react";
import { useSettings } from "../context/SettingsContext";

const CHUNK_INTERVAL_MS = 30_000; // 30s per spec

export function useRecorder({ onTranscriptChunk }) {
  const { settings } = useSettings();
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const intervalRef = useRef(null);

  // Send buffered audio to /api/transcribe
  const flushChunks = useCallback(async () => {
    if (chunksRef.current.length === 0) return;
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    chunksRef.current = [];

    if (blob.size < 1000) return; // skip silence / tiny blobs

    setIsTranscribing(true);
    try {
      const form = new FormData();
      form.append("audio", blob, "chunk.webm");
      form.append("groqApiKey", settings.groqApiKey);

      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transcription failed");
      if (data.text?.trim()) onTranscriptChunk(data.text.trim());
    } catch (err) {
      setError(err.message);
    } finally {
      setIsTranscribing(false);
    }
  }, [settings.groqApiKey, onTranscriptChunk]);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mr = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      // Collect audio continuously in 250ms slices
      mr.start(250);
      mediaRecorderRef.current = mr;
      setIsRecording(true);

      // Flush every CHUNK_INTERVAL_MS
      intervalRef.current = setInterval(flushChunks, CHUNK_INTERVAL_MS);
    } catch (err) {
      setError(err.message || "Microphone access denied");
    }
  }, [flushChunks]);

  const stopRecording = useCallback(async () => {
    clearInterval(intervalRef.current);

    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      mr.stop();
    }

    streamRef.current?.getTracks().forEach((t) => t.stop());
    setIsRecording(false);

    // Final flush
    await flushChunks();
  }, [flushChunks]);

  // Manual flush (used by refresh button)
  const flushNow = useCallback(async () => {
    // Briefly pause/resume recorder to get current data
    const mr = mediaRecorderRef.current;
    if (mr && mr.state === "recording") {
      mr.requestData();
      // small delay to let ondataavailable fire
      await new Promise((r) => setTimeout(r, 150));
    }
    await flushChunks();
  }, [flushChunks]);

  return {
    isRecording,
    isTranscribing,
    error,
    startRecording,
    stopRecording,
    flushNow,
  };
}
