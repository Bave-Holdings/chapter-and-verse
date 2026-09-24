"use client";

import { useRef, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { CitationSource } from "../../lib/api";
import { MessageLink } from "../_components/message-link";
import { citationLabel } from "./citation-label";
import styles from "./workspace.module.css";

type MarkdownMessageProps = {
  content: string;
  sources: CitationSource[];
  onCitationSelect?: (
    source: CitationSource,
    visibleSources: CitationSource[],
  ) => void;
};

function withCitationLinks(markdown: string) {
  return markdown.replace(/\[(\d+)\](?!\s*\()/g, "[$1](#citation-$1)");
}

function citedIndexes(markdown: string) {
  return new Set(Array.from(markdown.matchAll(/\[(\d+)\](?!\s*\()/g), (match) => Number(match[1])));
}

export function MarkdownMessage({ content, sources, onCitationSelect }: MarkdownMessageProps) {
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const sourceList = useRef<HTMLDivElement>(null);
  const cited = citedIndexes(content);
  const citedSources = sources.filter((source) => cited.has(source.index));

  function citation(index: number) {
    setHighlighted(index);
    sourceList.current?.querySelector(`[data-source-index="${index}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    const source = citedSources.find((item) => item.index === index);
    if (source) onCitationSelect?.(source, citedSources);
  }

  return (
    <>
      <div className={styles.markdown}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a({ href, children }: { href?: string; children?: ReactNode }) {
              const match = href?.match(/^#citation-(\d+)$/);
              if (match) {
                const index = Number(match[1]);
                const exists = citedSources.some((source) => source.index === index);
                return <button type="button" className={styles.citationButton} disabled={!exists} onClick={() => citation(index)} aria-label={`Show source ${index}`}>{children}</button>;
              }
              return <MessageLink href={href}>{children}</MessageLink>;
            },
          }}
        >
          {withCitationLinks(content)}
        </ReactMarkdown>
      </div>
      {citedSources.length > 0 && (
        <div className={styles.sourceList} aria-label="Sources" ref={sourceList}>
          {citedSources.map((source) => (
            <button
              type="button"
              data-source-index={source.index}
              data-source-kind={source.source_kind}
              key={`${source.index}-${source.document_id}-${source.page_number}`}
              className={highlighted === source.index ? styles.highlightedSource : undefined}
              aria-pressed={highlighted === source.index}
              onClick={() => citation(source.index)}
            >
              <strong>{citationLabel(source)}</strong>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
