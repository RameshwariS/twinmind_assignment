import React, { useEffect, useRef } from "react";
import styles from "./TranscriptPanel.module.css";

export default function TranscriptPanel({ lines, isRecording, isTranscribing, error }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const isEmpty = lines.length === 0;

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <span className={styles.label}>Transcript</span>
        {isRecording && (
          <span className={styles.liveTag}>
            <span className={styles.liveDot} />
            REC
          </span>
        )}
      </div>

      <div className={styles.content}>
        {isEmpty && !isRecording && (
          <div className={styles.empty}>
            <MicOffIcon />
            <p>Click Record to begin capturing audio</p>
          </div>
        )}

        {isEmpty && isRecording && (
          <div className={styles.empty}>
            <WaveIcon />
            <p>Listening… transcript appears every ~30s</p>
          </div>
        )}

        {lines.map((line, i) => (
          <div
            key={line.id}
            className={styles.line}
            style={{ animationDelay: `${i === lines.length - 1 ? 0 : 0}ms` }}
          >
            <span className={styles.timestamp}>
              {formatTime(line.timestamp)}
            </span>
            <p className={styles.lineText}>{line.text}</p>
          </div>
        ))}

        {isTranscribing && (
          <div className={styles.transcribingRow}>
            <span className={styles.dot} />
            <span className={styles.dot} style={{ animationDelay: "0.15s" }} />
            <span className={styles.dot} style={{ animationDelay: "0.3s" }} />
          </div>
        )}

        {error && (
          <div className={styles.error}>
            <span>⚠</span> {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function MicOffIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="1" y1="1" x2="23" y2="23"/>
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  );
}

function WaveIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 10 Q4 2 6 10 Q8 18 10 10 Q12 2 14 10 Q16 18 18 10 Q20 2 22 10"/>
    </svg>
  );
}
