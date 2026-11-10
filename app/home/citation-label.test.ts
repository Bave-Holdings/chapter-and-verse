import { describe, expect, it } from "vitest";
import type { CitationSource } from "../../lib/api";
import { citationLabel, distinctSources, sourcesBySection } from "./citation-label";

const source: CitationSource = {
  index: 1, document_id: "guide", doc_name: "Selling Guide.pdf",
  page_number: 212, section_id: "B3-4.3-04", sub_section_id: null,
  citation_url: "/documents/guide#page=212",
};

describe("citationLabel", () => {
  it("removes repeated section headings without adding document or page metadata", () => {
    expect(citationLabel({ ...source, sub_section_id: "Documentation Requirements: Documentation Requirements" }))
      .toBe("Documentation Requirements");
    expect(citationLabel({ ...source, sub_section_id: "Minimum Borrower Contribution Requirements: minimum borrower contribution requirements" }))
      .toBe("Minimum Borrower Contribution Requirements");
  });

  it("preserves section codes and distinct subsection titles", () => {
    expect(citationLabel({ ...source, sub_section_id: "B3-4.3-04: Personal Gifts" })).toBe("B3-4.3-04: Personal Gifts");
    expect(citationLabel({ ...source, sub_section_id: "Income: Documentation" })).toBe("Income: Documentation");
    expect(citationLabel(source)).toBe("B3-4.3-04");
  });

  it("ignores blank identifiers and falls back to a title or Source", () => {
    expect(citationLabel({ ...source, sub_section_id: " ", section_id: null, title: "Personal Gifts" })).toBe("Personal Gifts");
    expect(citationLabel({ ...source, section_id: null })).toBe("Source");
  });
});

describe("sourcesBySection", () => {
  const downgrade = "II.A.4.a.v: Accept Risk Classifications Requiring a Downgrade to Manual Underwriting (TOTAL)";
  const sources: CitationSource[] = [
    { ...source, index: 1, sub_section_id: "II.A.5.d.viii: Approvable Ratio Requirements (Manual)" },
    { ...source, index: 2, sub_section_id: downgrade, page_number: 203, cited_passages: [{ claim: "a", passage: "first", page_number: 203 }] },
    { ...source, index: 3, sub_section_id: downgrade, page_number: 204, cited_passages: [{ claim: "b", passage: "second", page_number: 204 }] },
    { ...source, index: 4, sub_section_id: downgrade, kind: "practice" },
  ];

  it("shows a section once and keeps every cited passage", () => {
    const byIndex = sourcesBySection(sources);
    expect(byIndex.get(3)).toBe(byIndex.get(2));
    expect(byIndex.get(2)?.cited_passages?.map((item) => item.passage)).toEqual(["first", "second"]);
    expect(distinctSources([1, 2, 3, 4], byIndex).map((item) => item.index)).toEqual([1, 2, 4]);
    // The caller's sources are not changed.
    expect(sources[1].cited_passages).toHaveLength(1);
  });
});
