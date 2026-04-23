import React, { createContext, useContext, useState } from "react";

const DEFAULT_SETTINGS = {
  groqApiKey: "",
  suggestionPrompt: "", // empty = use server default
  expandPrompt: "",
  chatPrompt: "",
  suggestionContextWindow: 3000,
  expandContextWindow: 6000,
  chatContextWindow: 6000,
  refreshInterval: 30, // seconds
};

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem("twinmind_settings");
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const updateSettings = (patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem("twinmind_settings", JSON.stringify(next));
      return next;
    });
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, DEFAULT_SETTINGS }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
