import type { CitationSource, SourceKind } from "../../lib/api";

const KINDS = new Set<SourceKind>(["guideline", "practice", "overlay", "comparison", "calculation"]);

/** Practice, overlay and calculation sources are not stored PDFs: there is no page to open. */
const NON_DOCUMENT_KINDS = new Set<SourceKind>(["practice", "overlay", "calculation"]);

/** Short chip prefix, so the LO always knows a guideline from everything else. */
export const SOURCE_KIND_LABELS: Record<SourceKind, string> = {
  guideline: "Guideline",
  practice: "Underwriter practice",
  overlay: "Overlay",
  comparison: "Conventional comparison",
  calculation: "Calculated",
};

/** Saved answers predate `kind`; they fall back to the older `source_kind`, then guideline. */
export function sourceKind(source: CitationSource): SourceKind {
  const kind = (source.kind ?? source.source_kind ?? "guideline") as SourceKind;
  return KINDS.has(kind) ? kind : "guideline";
}

export function isDocumentSource(source: CitationSource) {
  return !NON_DOCUMENT_KINDS.has(sourceKind(source));
}
