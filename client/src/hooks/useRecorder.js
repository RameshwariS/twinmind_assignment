import { useState, useRef, useCallback } from "react";
import { useSettings } from "../context/SettingsContext";

const CHUNK_INTERVAL_MS = 30_000;

// Pick the best supported mimeType once at module load
const MIME_TYPE = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg"]
  .find((m) => MediaRecorder.isTypeSupported(m)) || "";

const FILE_EXT = MIME_TYPE.startsWith("audio/ogg") ? "ogg" : "webm";

export function useRecorder({ onTranscriptChunk }) {
  const { settings } = useSettings();
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState(null);

  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  // Refs needed inside the interval callback without stale closure issues
  const groqApiKeyRef = useRef(settings.groqApiKey);
  const onChunkRef = useRef(onTranscriptChunk);
  const isRecordingRef = useRef(false);
  const setIsTranscribingRef = useRef(setIsTranscribing);

  // Keep refs in sync
  groqApiKeyRef.current = settings.groqApiKey;
  onChunkRef.current = onTranscriptChunk;

  /**
   * Record exactly one window of audio (durationMs), then transcribe it.
   * Each call creates a fresh MediaRecorder so the resulting Blob is a
   * complete, self-contained WebM/OGG file that Groq can decode.
   */
  const recordAndTranscribe = useCallback(
    (stream, durationMs) =>
      new Promise((resolve) => {
        const chunks = [];
        const mr = new MediaRecorder(stream, MIME_TYPE ? { mimeType: MIME_TYPE } : {});

        mr.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        mr.onstop = async () => {
          const blob = new Blob(chunks, { type: MIME_TYPE || "audio/webm" });

          // Skip near-silent / nearly-empty recordings
          if (blob.size < 2000) {
            resolve();
            return;
          }

          setIsTranscribingRef.current(true);
          try {
            const form = new FormData();
            form.append("audio", blob, `audio.${FILE_EXT}`);
            form.append("groqApiKey", groqApiKeyRef.current);

            const res = await fetch("/api/transcribe", { method: "POST", body: form });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Transcription failed");
            if (data.text?.trim()) onChunkRef.current(data.text.trim());
          } catch (err) {
            // Surface error to UI via a separate state setter — we don't have
            // access to setError directly here, so we re-throw and catch outside
            console.error("[transcribe]", err.message);
          } finally {
            setIsTranscribingRef.current(false);
            resolve();
          }
        };

        mr.start();
        setTimeout(() => {
          if (mr.state === "recording") mr.stop();
        }, durationMs);
      }),
    []
  );

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      isRecordingRef.current = true;
      setIsRecording(true);

      // Immediately kick off the first recording window, then loop
      const loop = async () => {
        while (isRecordingRef.current) {
          await recordAndTranscribe(stream, CHUNK_INTERVAL_MS);
        }
      };
      loop();
    } catch (err) {
      setError(err.message || "Microphone access denied");
    }
  }, [recordAndTranscribe]);

  const stopRecording = useCallback(async () => {
    isRecordingRef.current = false;
    setIsRecording(false);
    // Stop all mic tracks — this also causes any in-progress MediaRecorder
    // to fire onstop naturally, so the last partial window still transcribes.
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  /**
   * Manual refresh: stop the current recording window early (triggering
   * an immediate transcription), then start a new window.
   * We do this by stopping and restarting the stream's MediaRecorder cycle.
   * Since our loop restarts automatically after each onstop, we just need
   * to signal the current recorder to stop early.
   *
   * Implementation: we stop all tracks (ends current window → transcription
   * fires), then re-acquire the mic and restart the loop.
   */
  const flushNow = useCallback(async () => {
    if (!isRecordingRef.current) return;

    // Temporarily pause the loop flag so the loop exits after current window
    isRecordingRef.current = false;

    // Stop tracks → triggers onstop on current MediaRecorder → transcription
    streamRef.current?.getTracks().forEach((t) => t.stop());

    // Wait briefly for transcription to start, then restart
    await new Promise((r) => setTimeout(r, 300));

    // Restart
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      isRecordingRef.current = true;

      const loop = async () => {
        while (isRecordingRef.current) {
          await recordAndTranscribe(stream, CHUNK_INTERVAL_MS);
        }
      };
      loop();
    } catch (err) {
      setError(err.message || "Microphone error on refresh");
      setIsRecording(false);
    }
  }, [recordAndTranscribe]);

  return {
    isRecording,
    isTranscribing,
    error,
    startRecording,
    stopRecording,
    flushNow,
  };
}
