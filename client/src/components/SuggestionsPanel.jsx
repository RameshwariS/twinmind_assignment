import React from "react";
import styles from "./SuggestionsPanel.module.css";

const TYPE_META = {
  QUESTION: { label: "Question", color: "var(--type-question)" },
  ANSWER: { label: "Answer", color: "var(--type-answer)" },
  FACT_CHECK: { label: "Fact-Check", color: "var(--type-fact_check)" },
  TALKING_POINT: { label: "Talking Point", color: "var(--type-talking_point)" },
  CLARIFICATION: { label: "Clarification", color: "var(--type-clarification)" },
};

export default function SuggestionsPanel({
  batches,
  isLoading,
  error,
  onRefresh,
  onSuggestionClick,
  isRecording,
}) {
  const isEmpty = batches.length === 0;

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <span className={styles.label}>Live Suggestions</span>
        <button
          className={`${styles.refreshBtn} ${isLoading ? styles.spinning : ""}`}
          onClick={onRefresh}
          disabled={isLoading}
          title="Refresh suggestions"
        >
          <RefreshIcon />
          {isLoading ? "Thinking…" : "Refresh"}
        </button>
      </div>

      <div className={styles.content}>
        {isEmpty && !isLoading && (
          <div className={styles.empty}>
            <BrainIcon />
            <p>
              {isRecording
                ? "Suggestions appear after audio is captured"
                : "Start recording to get live suggestions"}
            </p>
          </div>
        )}

        {isLoading && isEmpty && (
          <div className={styles.loadingPlaceholder}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {batches.map((batch, bi) => (
          <div key={batch.id} className={styles.batch}>
            <div className={styles.batchHeader}>
              <span className={styles.batchTime}>{formatTime(batch.timestamp)}</span>
              {bi === 0 && <span className={styles.newTag}>new</span>}
            </div>

            <div className={styles.cards}>
              {batch.items.map((item, ii) => (
                <SuggestionCard
                  key={ii}
                  item={item}
                  delay={ii * 60}
                  onClick={() => onSuggestionClick(item)}
                />
              ))}
            </div>
          </div>
        ))}

        {isLoading && batches.length > 0 && (
          <div className={styles.inlineLoading}>
            <span className={styles.spinner} />
            Generating suggestions…
          </div>
        )}

        {error && (
          <div className={styles.error}>
            <span>⚠</span> {error}
          </div>
        )}
      </div>
    </div>
  );
}

function SuggestionCard({ item, delay, onClick }) {
  const meta = TYPE_META[item.type] || TYPE_META.TALKING_POINT;

  return (
    <button
      className={styles.card}
      onClick={onClick}
      style={{ animationDelay: `${delay}ms`, "--type-color": meta.color }}
    >
      <div className={styles.cardTop}>
        <span className={styles.typeChip}>{meta.label}</span>
      </div>
      <p className={styles.cardTitle}>{item.title}</p>
      <p className={styles.cardPreview}>{item.preview}</p>
      <span className={styles.tapHint}>tap for details →</span>
    </button>
  );
}

function SkeletonCard() {
  return (
    <div className={styles.skeleton}>
      <div className={styles.skeletonChip} />
      <div className={styles.skeletonLine} style={{ width: "70%" }} />
      <div className={styles.skeletonLine} style={{ width: "90%" }} />
      <div className={styles.skeletonLine} style={{ width: "60%" }} />
    </div>
  );
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function RefreshIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="23 4 23 10 17 10"/>
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
    </svg>
  );
}
