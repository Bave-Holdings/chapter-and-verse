import type { CitationSource } from "../../lib/api";

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
