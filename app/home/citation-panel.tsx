"use client";

import { useId, useState, type KeyboardEvent } from "react";

import type { CitationSource } from "../../lib/api";
import { citationLabel } from "./citation-label";
import styles from "./workspace.module.css";

export type CitationPanelProps = {
  source: CitationSource;
  sources: CitationSource[];
  agentName: string;
  onSelect: (source: CitationSource) => void;
  onClose: () => void;
};

export function cleanDocumentName(name: string) {
  return name
    .replace(/^(?:[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}|[a-f\d]{12,})[-_\s]+/i, "")
    .replace(/\s*\(\d+\)(?=\.pdf$)/i, "")
    .replace(/\.pdf$/i, "")
    .trim() || "Source document";
}

function sourceType(source: CitationSource) {
  return source.source_kind === "overlay" ? "Firm overlay" : "Source document";
}

function CloseIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}

export function CitationPanel({ source, sources, agentName, onSelect, onClose }: CitationPanelProps) {
  const panelId = useId();
  const [copyResult, setCopyResult] = useState<{ index: number; text: string } | null>(null);
  const overlay = source.source_kind === "overlay";
  const citedPassages = source.cited_passages ?? [];
  const openAtPage = () => {
    if (source.citation_url) {
      window.open(source.citation_url, "_blank", "noopener,noreferrer");
    }
  };

  async function copyCitation() {
    try {
      const text = `${cleanDocumentName(source.doc_name)} — ${citationLabel(source)}, p. ${source.page_number}${source.citation_url ? `\n${new URL(source.citation_url, window.location.origin).href}` : ""}`;
      await navigator.clipboard.writeText(text);
      setCopyResult({ index: source.index, text: "Citation copied" });
    } catch {
      setCopyResult({ index: source.index, text: "Unable to copy citation. Please try again." });
    }
  }

  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === "ArrowRight" ? (index + 1) % sources.length
      : event.key === "ArrowLeft" ? (index - 1 + sources.length) % sources.length
      : event.key === "Home" ? 0 : event.key === "End" ? sources.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    onSelect(sources[next]);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }

  return <aside className={styles.citationPanel} aria-label="Citation details">
    <div className={styles.citationPanelHeader}>
      <div className={styles.citationTabs} role="tablist" aria-label="Answer citations">
        {sources.map((item, index) => <button
          key={`${item.index}-${item.document_id}-${item.page_number}`}
          type="button"
          role="tab"
          id={`${panelId}-tab-${item.index}`}
          aria-controls={`${panelId}-content`}
          aria-selected={item.index === source.index}
          tabIndex={item.index === source.index ? 0 : -1}
          className={item.source_kind === "overlay" ? styles.overlayCitationTab : undefined}
          onClick={() => onSelect(item)}
          onKeyDown={(event) => navigateTabs(event, index)}
        >
          <span aria-hidden="true" />
          <span title={`${cleanDocumentName(item.doc_name)} · ${citationLabel(item)}`}>{cleanDocumentName(item.doc_name)}</span>
        </button>)}
      </div>
      <button type="button" className={styles.citationClose} aria-label="Close citation details" onClick={onClose}><CloseIcon /></button>
    </div>

    <div className={styles.citationPanelScroll} id={`${panelId}-content`} role="tabpanel" aria-labelledby={`${panelId}-tab-${source.index}`} tabIndex={0}>
      <header className={styles.citationDocumentHeader}>
        <span>{sourceType(source)} · {agentName}</span>
        <h2>{cleanDocumentName(source.doc_name)}</h2>
        <p>{citationLabel(source)}</p>
      </header>

      <dl className={styles.citationMetadata}>
        <div><dt>Page</dt><dd>{source.page_number}</dd></div>
        {source.document_version && <div><dt>Edition / effective</dt><dd>{source.document_version}</dd></div>}
        <div><dt>Library</dt><dd>{agentName}</dd></div>
      </dl>

      <section className={`${styles.citationExcerpt} ${overlay ? styles.citationExcerptOverlay : ""}`} aria-labelledby="cited-passage-heading">
        <h3 id="cited-passage-heading">{citedPassages.length > 1 ? "Cited passages" : "Cited passage"}</h3>
        {citedPassages.length > 0
          ? citedPassages.map((item, index) => <div key={`${item.page_number}-${index}`}>
            {citedPassages.length > 1 && <strong>{item.claim}</strong>}
            <p>{item.passage}</p>
          </div>)
          : <p>An exact cited passage is unavailable for this citation.</p>}
      </section>
    </div>

    <div className={styles.citationActions}>
      {copyResult?.index === source.index && <p className={styles.copyStatus} role="status">{copyResult.text}</p>}
      <button type="button" onClick={openAtPage} disabled={!source.citation_url}>
        <span>Open at page</span>
      </button>
      <button type="button" className={styles.copyCitation} onClick={() => void copyCitation()} aria-label="Copy citation" title="Copy citation"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M8 8h12v12H8zM16 8V4H4v12h4" /></svg></button>
    </div>
  </aside>;
}
