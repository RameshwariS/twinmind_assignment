import React from "react";
import styles from "./Header.module.css";

export default function Header({
  isRecording,
  isTranscribing,
  onStart,
  onStop,
  onSettings,
  onExport,
  hasKey,
}) {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.logo}>TM</span>
        <span className={styles.name}>TwinMind</span>
        <span className={styles.tagline}>live meeting copilot</span>
      </div>

      <div className={styles.status}>
        {isTranscribing && (
          <span className={styles.pill}>
            <span className={styles.spinner} />
            transcribing
          </span>
        )}
        {isRecording && !isTranscribing && (
          <span className={`${styles.pill} ${styles.recording}`}>
            <span className={styles.dot} />
            live
          </span>
        )}
      </div>

      <div className={styles.actions}>
        <button
          className={styles.iconBtn}
          onClick={onExport}
          title="Export session"
          aria-label="Export session"
        >
          <DownloadIcon />
        </button>

        <button
          className={styles.iconBtn}
          onClick={onSettings}
          title="Settings"
          aria-label="Settings"
        >
          <GearIcon />
          {!hasKey && <span className={styles.badge} />}
        </button>

        {isRecording ? (
          <button className={`${styles.micBtn} ${styles.active}`} onClick={onStop}>
            <StopIcon />
            <span>Stop</span>
          </button>
        ) : (
          <button className={styles.micBtn} onClick={onStart} disabled={!hasKey}>
            <MicIcon />
            <span>Record</span>
          </button>
        )}
      </div>
    </header>
  );
}

function MicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2"/>
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  );
}
