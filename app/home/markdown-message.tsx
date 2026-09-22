"use client";

import { useRef, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { CitationSource } from "../../lib/api";
import styles from "./workspace.module.css";

function withCitationLinks(markdown: string) {
  return markdown.replace(/\[(\d+)\](?!\s*\()/g, "[$1](#citation-$1)");
}

function citedIndexes(markdown: string) {
  return new Set(Array.from(markdown.matchAll(/\[(\d+)\](?!\s*\()/g), (match) => Number(match[1])));
}

export function MarkdownMessage({ content, sources }: { content: string; sources: CitationSource[] }) {
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const sourceList = useRef<HTMLDivElement>(null);
  const cited = citedIndexes(content);
  const citedSources = sources.filter((source) => cited.has(source.index));

  function citation(index: number) {
    setHighlighted(index);
    sourceList.current?.querySelector(`[data-source-index="${index}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
              return <a href={href} target="_blank" rel="noreferrer">{children}</a>;
            },
          }}
        >
          {withCitationLinks(content)}
        </ReactMarkdown>
      </div>
      {citedSources.length > 0 && (
        <div className={styles.sourceList} aria-label="Sources" ref={sourceList}>
          {citedSources.map((source) => (
            <a
              data-source-index={source.index}
              key={`${source.index}-${source.document_id}-${source.page_number}`}
              className={highlighted === source.index ? styles.highlightedSource : undefined}
              href={source.citation_url}
              target="_blank"
              rel="noreferrer"
              onClick={() => setHighlighted(source.index)}
            >
              <strong>[{source.index}] {source.title || source.section_id || source.doc_name}</strong>
              <span>{source.doc_name} · page {source.page_number}</span>
            </a>
          ))}
        </div>
      )}
    </>
  );
}
