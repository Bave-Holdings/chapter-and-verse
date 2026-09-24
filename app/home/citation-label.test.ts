import { describe, expect, it } from "vitest";
import type { CitationSource } from "../../lib/api";
import { citationLabel } from "./citation-label";

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
