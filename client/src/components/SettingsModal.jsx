import React, { useState } from "react";
import { useSettings } from "../context/SettingsContext";
import styles from "./SettingsModal.module.css";

const TABS = ["API Key", "Prompts", "Context Windows"];

export default function SettingsModal({ onClose }) {
  const { settings, updateSettings, DEFAULT_SETTINGS } = useSettings();
  const [tab, setTab] = useState(0);
  const [localKey, setLocalKey] = useState(settings.groqApiKey);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    updateSettings({ groqApiKey: localKey });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleReset = () => {
    updateSettings({ ...DEFAULT_SETTINGS, groqApiKey: settings.groqApiKey });
  };

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>Settings</h2>
            <p className={styles.modalSub}>Configure your TwinMind session</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          {TABS.map((t, i) => (
            <button
              key={t}
              className={`${styles.tab} ${tab === i ? styles.activeTab : ""}`}
              onClick={() => setTab(i)}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className={styles.body}>
          {tab === 0 && (
            <ApiKeyTab
              apiKey={localKey}
              onChange={setLocalKey}
              onSave={handleSave}
              saved={saved}
            />
          )}
          {tab === 1 && <PromptsTab settings={settings} updateSettings={updateSettings} />}
          {tab === 2 && <ContextTab settings={settings} updateSettings={updateSettings} />}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button className={styles.resetBtn} onClick={handleReset}>
            Reset to defaults
          </button>
          <button className={styles.doneBtn} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── API Key Tab ─────────────────────────────────────────────────────────── */
function ApiKeyTab({ apiKey, onChange, onSave, saved }) {
  const [show, setShow] = useState(false);
  return (
    <div className={styles.section}>
      <label className={styles.fieldLabel}>
        Groq API Key
        <span className={styles.required}>required</span>
      </label>
      <p className={styles.fieldHint}>
        Get your key from{" "}
        <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className={styles.link}>
          console.groq.com/keys
        </a>
        . Your key is stored locally in the browser only.
      </p>
      <div className={styles.keyRow}>
        <input
          type={show ? "text" : "password"}
          className={styles.input}
          value={apiKey}
          onChange={(e) => onChange(e.target.value)}
          placeholder="gsk_…"
          spellCheck={false}
          autoComplete="off"
        />
        <button className={styles.toggleBtn} onClick={() => setShow((s) => !s)}>
          {show ? "Hide" : "Show"}
        </button>
      </div>
      <button
        className={`${styles.saveBtn} ${saved ? styles.savedBtn : ""}`}
        onClick={onSave}
        disabled={!apiKey.trim()}
      >
        {saved ? "✓ Saved" : "Save Key"}
      </button>
    </div>
  );
}

/* ─── Prompts Tab ─────────────────────────────────────────────────────────── */
function PromptsTab({ settings, updateSettings }) {
  return (
    <div className={styles.section}>
      <PromptField
        label="Live Suggestion Prompt"
        hint="System prompt for generating the 3 live suggestion cards. Leave blank to use the default."
        value={settings.suggestionPrompt}
        onChange={(v) => updateSettings({ suggestionPrompt: v })}
        rows={5}
      />
      <PromptField
        label="Expand Answer Prompt"
        hint="System prompt used when a suggestion card is tapped to generate the detailed answer."
        value={settings.expandPrompt}
        onChange={(v) => updateSettings({ expandPrompt: v })}
        rows={4}
      />
      <PromptField
        label="Chat Prompt"
        hint="System prompt for the open-ended chat panel on the right."
        value={settings.chatPrompt}
        onChange={(v) => updateSettings({ chatPrompt: v })}
        rows={4}
      />
      <div className={styles.refreshRow}>
        <label className={styles.fieldLabel} style={{ marginBottom: 0 }}>
          Auto-refresh interval (seconds)
        </label>
        <input
          type="number"
          className={styles.numInput}
          value={settings.refreshInterval}
          min={10}
          max={120}
          onChange={(e) =>
            updateSettings({ refreshInterval: Number(e.target.value) })
          }
        />
      </div>
    </div>
  );
}

/* ─── Context Windows Tab ─────────────────────────────────────────────────── */
function ContextTab({ settings, updateSettings }) {
  return (
    <div className={styles.section}>
      <ContextField
        label="Suggestions context window"
        hint="Characters of transcript tail fed into suggestion generation. More = richer context, higher latency."
        value={settings.suggestionContextWindow}
        onChange={(v) => updateSettings({ suggestionContextWindow: v })}
        min={500}
        max={8000}
      />
      <ContextField
        label="Expand answer context window"
        hint="Characters of transcript fed when a suggestion is tapped for a detailed answer."
        value={settings.expandContextWindow}
        onChange={(v) => updateSettings({ expandContextWindow: v })}
        min={1000}
        max={12000}
      />
      <ContextField
        label="Chat context window"
        hint="Characters of transcript injected into the system prompt for open-ended chat."
        value={settings.chatContextWindow}
        onChange={(v) => updateSettings({ chatContextWindow: v })}
        min={1000}
        max={12000}
      />
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────────────────────────── */
function PromptField({ label, hint, value, onChange, rows = 4 }) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>{label}</label>
      <p className={styles.fieldHint}>{hint}</p>
      <textarea
        className={styles.promptArea}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder="Leave blank to use the built-in default prompt…"
        spellCheck={false}
      />
    </div>
  );
}

function ContextField({ label, hint, value, onChange, min, max }) {
  return (
    <div className={styles.field}>
      <div className={styles.refreshRow}>
        <div>
          <label className={styles.fieldLabel} style={{ marginBottom: 2 }}>{label}</label>
          <p className={styles.fieldHint} style={{ marginBottom: 0 }}>{hint}</p>
        </div>
        <input
          type="number"
          className={styles.numInput}
          value={value}
          min={min}
          max={max}
          step={500}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
      <input
        type="range"
        className={styles.range}
        value={value}
        min={min}
        max={max}
        step={500}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className={styles.rangeLabels}>
        <span>{min.toLocaleString()} chars</span>
        <span>{max.toLocaleString()} chars</span>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
