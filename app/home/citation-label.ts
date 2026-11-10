import type { CitationSource } from "../../lib/api";
import { sourceKind } from "./source-kind";

/** Use the same section-only label in the answer and the citation panel. */
export function citationLabel(source: CitationSource): string {
  const label = [source.sub_section_id, source.section_id, source.title]
    .find((value) => value?.trim())?.trim() || "Source";
  const seen = new Set<string>();

  // Some sources repeat the section heading as both the identifier and title.
  // Keep distinct parent/child headings, but never show the same heading twice.
  return label.split(/\s*:\s*/).filter((part) => {
    const key = part.trim().replace(/\s+/g, " ").toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).join(": ") || "Source";
}

/**
 * The backend numbers every retrieved chunk as its own source, so one section
 * can arrive as several sources ([2] and [3] both "II.A.4.a.v"). Map every source
 * index to one source per section (the first, by index), carrying the other
 * chunks' cited passages, so each section shows a single chip.
 */
export function sourcesBySection(sources: CitationSource[]): Map<number, CitationSource> {
  const kept = new Map<string, CitationSource>();
  const byIndex = new Map<number, CitationSource>();
  for (const source of [...sources].sort((a, b) => a.index - b.index)) {
    const key = `${sourceKind(source)}|${citationLabel(source).toLowerCase()}`;
    const first = kept.get(key);
    if (!first) {
      const copy = { ...source };
      kept.set(key, copy);
      byIndex.set(source.index, copy);
      continue;
    }
    if (source.cited_passages?.length) {
      first.cited_passages = [...(first.cited_passages ?? []), ...source.cited_passages];
    }
    byIndex.set(source.index, first);
  }
  return byIndex;
}

/** The distinct sources behind a list of source indexes, in index order. */
export function distinctSources(ids: Iterable<number>, byIndex: Map<number, CitationSource>): CitationSource[] {
  const found = new Map<number, CitationSource>();
  for (const id of ids) {
    const source = byIndex.get(id);
    if (source) found.set(source.index, source);
  }
  return [...found.values()].sort((a, b) => a.index - b.index);
}
