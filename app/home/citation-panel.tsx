"use client";

import { useId, useState, type KeyboardEvent } from "react";

import type { CitationSource, SourceKind } from "../../lib/api";
import { citationLabel } from "./citation-label";
import { isDocumentSource, sourceKind } from "./source-kind";
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
    // Storage upload prefix, e.g. "b71f79b2_FHA Single Family Housing Policy Handbook.pdf".
    .replace(/^[a-f\d]{8}_(?=\S)/i, "")
    .replace(/\s*\(\d+\)(?=\.pdf$)/i, "")
    .replace(/\.pdf$/i, "")
    .trim() || "Source document";
}

const SOURCE_TYPES: Record<SourceKind, string> = {
  guideline: "Source document",
  practice: "Underwriter practice",
  overlay: "Firm overlay",
  comparison: "Conventional comparison",
  calculation: "Calculated",
};

// Every source that is not the program's own guideline says what it is.
const SOURCE_NOTES: Partial<Record<SourceKind, string>> = {
  practice: "What an underwriter will commonly ask for. Underwriter practice, not agency policy.",
  overlay: "Your lender's own rule. It is stricter than, or in addition to, the agency guideline.",
  comparison: "Another program's rule, offered as an alternative path. It never changes this program's outlook.",
  calculation: "Computed by code from the numbers given in the question. Check them against the file.",
};

const TAB_CLASSES: Partial<Record<SourceKind, string>> = {
  overlay: styles.overlayCitationTab,
  practice: styles.practiceCitationTab,
  comparison: styles.comparisonCitationTab,
  calculation: styles.calculationCitationTab,
};

const EXCERPT_CLASSES: Partial<Record<SourceKind, string>> = {
  overlay: styles.citationExcerptOverlay,
  practice: styles.citationExcerptPractice,
  comparison: styles.citationExcerptComparison,
  calculation: styles.citationExcerptCalculation,
};

function CloseIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}

export function CitationPanel({ source, sources, agentName, onSelect, onClose }: CitationPanelProps) {
  const panelId = useId();
  const [copyResult, setCopyResult] = useState<{ index: number; text: string } | null>(null);
  const kind = sourceKind(source);
  // Playbook, overlay and calculator sources normally have no PDF; a saved source with a link keeps it.
  const hasDocument = isDocumentSource(source) || Boolean(source.citation_url);
  const citedPassages = source.cited_passages ?? [];
  const fallbackPassage = !hasDocument && source.text_preview?.trim() ? source.text_preview.trim() : null;
  const openAtPage = () => {
    if (source.citation_url) {
      window.open(source.citation_url, "_blank", "noopener,noreferrer");
    }
  };

  async function copyCitation() {
    try {
      const page = hasDocument && source.page_number ? `, p. ${source.page_number}` : "";
      const text = `${cleanDocumentName(source.doc_name)} — ${citationLabel(source)}${page}${source.citation_url ? `\n${new URL(source.citation_url, window.location.origin).href}` : ""}`;
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
          className={TAB_CLASSES[sourceKind(item)]}
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
        <span>{SOURCE_TYPES[kind]} · {agentName}</span>
        <h2>{cleanDocumentName(source.doc_name)}</h2>
        <p>{citationLabel(source)}</p>
      </header>

      {SOURCE_NOTES[kind] && <p className={styles.citationKindNote}>{SOURCE_NOTES[kind]}</p>}

      <dl className={styles.citationMetadata}>
        {hasDocument && <div><dt>Page</dt><dd>{source.page_number}</dd></div>}
        {source.document_version && <div><dt>Edition / effective</dt><dd>{source.document_version}</dd></div>}
        <div><dt>Library</dt><dd>{agentName}</dd></div>
      </dl>

      <section className={`${styles.citationExcerpt} ${EXCERPT_CLASSES[kind] ?? ""}`} aria-labelledby={`${panelId}-passage-heading`}>
        <h3 id={`${panelId}-passage-heading`}>{citedPassages.length > 1 ? "Cited passages" : "Cited passage"}</h3>
        {citedPassages.length > 0
          ? citedPassages.map((item, index) => <div key={`${item.page_number}-${index}`}>
            {citedPassages.length > 1 && <strong>{item.claim}</strong>}
            <p>{item.passage}</p>
          </div>)
          : fallbackPassage
            ? <p>{fallbackPassage}</p>
            : <p>An exact cited passage is unavailable for this citation.</p>}
      </section>
    </div>

    <div className={`${styles.citationActions} ${hasDocument ? "" : styles.citationActionsNoPdf}`}>
      {copyResult?.index === source.index && <p className={styles.copyStatus} role="status">{copyResult.text}</p>}
      {hasDocument && <button type="button" onClick={openAtPage} disabled={!source.citation_url}>
        <span>Open at page</span>
      </button>}
      {/* Without a PDF to open, copying is the panel's only action, so it is labeled. */}
      <button type="button" className={hasDocument ? styles.copyCitation : undefined} onClick={() => void copyCitation()} aria-label="Copy citation" title="Copy citation"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M8 8h12v12H8zM16 8V4H4v12h4" /></svg>{!hasDocument && <span>Copy citation</span>}</button>
    </div>
  </aside>;
}
