import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import styles from "./ChatPanel.module.css";

export default function ChatPanel({ messages, isLoading, error, onSend }) {
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    onSend(text);
    setInput("");
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <span className={styles.label}>Chat</span>
        {messages.length > 0 && (
          <span className={styles.count}>{messages.length} messages</span>
        )}
      </div>

      <div className={styles.messages}>
        {isEmpty && !isLoading && (
          <div className={styles.empty}>
            <ChatIcon />
            <p>Tap a suggestion or type a question</p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        {isLoading && (
          <div className={styles.thinkingRow}>
            <span className={styles.thinkingDot} />
            <span className={styles.thinkingDot} style={{ animationDelay: "0.18s" }} />
            <span className={styles.thinkingDot} style={{ animationDelay: "0.36s" }} />
          </div>
        )}

        {error && (
          <div className={styles.error}>
            <span>⚠</span> {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className={styles.inputRow}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything about the conversation…"
          rows={1}
          disabled={isLoading}
        />
        <button
          className={styles.sendBtn}
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          aria-label="Send message"
        >
          <SendIcon />
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`${styles.bubble} ${isUser ? styles.userBubble : styles.aiBubble}`}>
      <div className={styles.bubbleHeader}>
        <span className={styles.bubbleRole}>{isUser ? "You" : "TwinMind"}</span>
        <span className={styles.bubbleTime}>{formatTime(msg.timestamp)}</span>
      </div>
      <div className={`${styles.bubbleContent} ${!isUser ? "md" : ""}`}>
        {isUser ? (
          <p className={styles.userText}>{msg.content}</p>
        ) : (
          <ReactMarkdown>{msg.content}</ReactMarkdown>
        )}
      </div>
    </div>
  );
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function ChatIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  );
}
