import { useState, useRef, useCallback } from "react";
import { useSettings } from "../context/SettingsContext";

const CHUNK_INTERVAL_MS = 30_000;

const MIME_TYPE = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg"]
  .find((m) => MediaRecorder.isTypeSupported(m)) || "";

const FILE_EXT = MIME_TYPE.startsWith("audio/ogg") ? "ogg" : "webm";
const VALID_AUDIO_SOURCES = new Set(["mic", "system", "both"]);

/**
 * Acquire a mixed audio stream.
 *
 * "mic"    → getUserMedia only (your voice)
 * "system" → getDisplayMedia tab audio only (what's playing in the tab)
 * "both"   → mic + tab audio merged via AudioContext
 *
 * IMPORTANT for "system" / "both":
 *   When the browser share picker appears, you MUST tick "Share tab audio"
 *   (Chrome) or "Share audio" (Edge). Without it, no system audio is captured.
 *
 * Every returned stream has a ._stop() method that cleanly tears down
 * all tracks and AudioContext nodes.
 */
async function getAudioStream(source) {
  if (source === "mic") {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    stream._stop = () => stream.getTracks().forEach((t) => t.stop());
    return stream;
  }

  if (source === "system") {
    const display = await navigator.mediaDevices.getDisplayMedia({
      video: true,   // required by spec to trigger the picker UI
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        sampleRate: 44100,
      },
    });

    // Drop video immediately — we only needed it to open the picker
    display.getVideoTracks().forEach((t) => t.stop());

    if (display.getAudioTracks().length === 0) {
      display.getTracks().forEach((t) => t.stop());
      throw new Error(
        'No system audio captured. In the share dialog, tick "Share tab audio" (Chrome) or "Share audio" (Edge).'
      );
    }

    display._stop = () => display.getTracks().forEach((t) => t.stop());
    return display;
  }

  if (source === "both") {
    let micStream = null;
    let displayStream = null;

    try {
      [micStream, displayStream] = await Promise.all([
        navigator.mediaDevices.getUserMedia({ audio: true, video: false }),
        navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            sampleRate: 44100,
          },
        }),
      ]);
    } catch (err) {
      micStream?.getTracks().forEach((t) => t.stop());
      displayStream?.getTracks().forEach((t) => t.stop());
      throw err;
    }

    displayStream.getVideoTracks().forEach((t) => t.stop());

    const hasSystemAudio = displayStream.getAudioTracks().length > 0;

    if (!hasSystemAudio) {
      // User did not tick "Share audio" — fall back to mic-only gracefully
      console.warn("[useRecorder] No system audio captured — falling back to mic only.");
      displayStream.getTracks().forEach((t) => t.stop());
      micStream._stop = () => micStream.getTracks().forEach((t) => t.stop());
      return micStream;
    }

    // Mix both into one stream
    const ctx = new AudioContext();
    const dest = ctx.createMediaStreamDestination();
    ctx.createMediaStreamSource(micStream).connect(dest);
    ctx.createMediaStreamSource(displayStream).connect(dest);

    const mixed = dest.stream;
    mixed._stop = () => {
      micStream.getTracks().forEach((t) => t.stop());
      displayStream.getTracks().forEach((t) => t.stop());
      ctx.close();
    };
    return mixed;
  }

  throw new Error(`Unknown audio source: ${source}`);
}

export function useRecorder({ onTranscriptChunk }) {
  const { settings } = useSettings();
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState(null);
  const [audioSource, setAudioSource] = useState("both");

  const streamRef = useRef(null);
  const groqApiKeyRef = useRef(settings.groqApiKey);
  const onChunkRef = useRef(onTranscriptChunk);
  const isRecordingRef = useRef(false);
  const audioSourceRef = useRef("both");
  const setIsTranscribingRef = useRef(setIsTranscribing);
  const setErrorRef = useRef(setError);

  // Keep refs in sync with latest render values
  groqApiKeyRef.current = settings.groqApiKey;
  onChunkRef.current = onTranscriptChunk;
  audioSourceRef.current = audioSource;

  /**
   * Record one fixed-length window then transcribe.
   * Fresh MediaRecorder per call = valid, self-contained audio file every time.
   */
  const recordAndTranscribe = useCallback(
    (stream, durationMs) =>
      new Promise((resolve) => {
        const chunks = [];
        let mr;
        try {
          mr = new MediaRecorder(stream, MIME_TYPE ? { mimeType: MIME_TYPE } : {});
        } catch {
          mr = new MediaRecorder(stream);
        }

        mr.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        mr.onstop = async () => {
          const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
          if (blob.size < 2000) { resolve(); return; }

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
            console.error("[transcribe]", err.message);
            setErrorRef.current(err.message);
          } finally {
            setIsTranscribingRef.current(false);
            resolve();
          }
        };

        mr.onerror = () => resolve();
        mr.start();
        setTimeout(() => { if (mr.state === "recording") mr.stop(); }, durationMs);
      }),
    []
  );

  const startRecording = useCallback(async (overrideSource) => {
    setError(null);
    const source = VALID_AUDIO_SOURCES.has(overrideSource)
      ? overrideSource
      : audioSourceRef.current;
    try {
      const stream = await getAudioStream(source);
      streamRef.current = stream;
      isRecordingRef.current = true;
      setIsRecording(true);

      (async () => {
        while (isRecordingRef.current) {
          await recordAndTranscribe(stream, CHUNK_INTERVAL_MS);
        }
      })();
    } catch (err) {
      setError(err.message || "Could not access audio");
    }
  }, [recordAndTranscribe]);

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;
    setIsRecording(false);
    streamRef.current?._stop?.();
    streamRef.current = null;
  }, []);

  const flushNow = useCallback(async () => {
    if (!isRecordingRef.current) return;
    const prev = streamRef.current;

    isRecordingRef.current = false;
    prev?._stop?.();

    await new Promise((r) => setTimeout(r, 400));

    try {
      const stream = await getAudioStream(audioSourceRef.current);
      streamRef.current = stream;
      isRecordingRef.current = true;

      (async () => {
        while (isRecordingRef.current) {
          await recordAndTranscribe(stream, CHUNK_INTERVAL_MS);
        }
      })();
    } catch (err) {
      setError(err.message || "Could not re-acquire audio");
      setIsRecording(false);
    }
  }, [recordAndTranscribe]);

  return {
    isRecording,
    isTranscribing,
    error,
    audioSource,
    setAudioSource,
    startRecording,
    stopRecording,
    flushNow,
  };
}
