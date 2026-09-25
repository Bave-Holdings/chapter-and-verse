"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import type { Chat } from "../../lib/api";
import styles from "./history-search.module.css";

type HistorySearchProps = {
  chats: Chat[];
  loading: boolean;
  error: string;
  disabled: boolean;
  activeChatId: string | null;
  onSelect: (chatId: string) => void;
  onClose: () => void;
};

export function HistorySearch({ chats, loading, error, disabled, activeChatId, onSelect, onClose }: HistorySearchProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const resultsList = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState("");
  const search = query.trim().toLocaleLowerCase();
  const results = chats.filter((chat) => chat.title.toLocaleLowerCase().includes(search));

  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement;
    element?.showModal();
    searchInput.current?.focus();
    return () => {
      element?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);

  function navigateResults(event: KeyboardEvent<HTMLElement>) {
    const buttons = Array.from(resultsList.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
    if (!buttons.length) return;
    const inSearch = event.target === searchInput.current;
    const index = buttons.indexOf(event.target as HTMLButtonElement);
    let target: HTMLElement | undefined;
    if (event.key === "ArrowDown") target = buttons[(index + 1) % buttons.length];
    else if (event.key === "ArrowUp") target = inSearch ? buttons.at(-1) : buttons[index - 1] ?? searchInput.current!;
    else if (!inSearch && event.key === "Home") target = buttons[0];
    else if (!inSearch && event.key === "End") target = buttons.at(-1);
    else if (inSearch && event.key === "Enter") {
      event.preventDefault();
      onSelect(results[0].id);
      return;
    }
    if (target) {
      event.preventDefault();
      target.focus();
    }
  }

  return <dialog
    ref={dialog}
    className={styles.dialog}
    aria-label="Search chat history"
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClose={(event) => { if (!event.currentTarget.open) onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
  >
    <div className={styles.panel}>
      <div className={styles.searchRow}>
        <input
          ref={searchInput}
          type="search"
          aria-label="Search chats"
          aria-controls="history-search-results"
          placeholder="Search..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={navigateResults}
          autoComplete="off"
        />
        <button type="button" className={styles.close} aria-label="Close history search" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
        </button>
      </div>
      <div className={styles.results}>
        <h2 id="history-search-heading">{search ? "Search results" : "Recent chats"}</h2>
        <div role="status" className={styles.status}>
          {loading && <p>Loading recent chats…</p>}
          {error && <p>{error}</p>}
          {!loading && !error && chats.length === 0 && <p>No conversations yet.</p>}
          {search && results.length === 0 && chats.length > 0 && <p>No chats match “{query.trim()}”.</p>}
          {disabled && <p>Finish or cancel the current answer to open another chat.</p>}
        </div>
        <ul ref={resultsList} id="history-search-results" aria-labelledby="history-search-heading" onKeyDown={navigateResults}>
          {results.map((chat) => <li key={chat.id}>
            <button type="button" disabled={disabled} aria-current={chat.id === activeChatId ? "true" : undefined} onClick={() => onSelect(chat.id)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" /></svg>
              <span>{chat.title}</span>
            </button>
          </li>)}
        </ul>
      </div>
    </div>
  </dialog>;
}
