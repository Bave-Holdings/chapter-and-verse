import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MarkdownMessage } from "./markdown-message";

const source = {
  index: 1,
  document_id: "doc-1",
  doc_name: "Guide.pdf",
  page_number: 12,
  section_id: "A2-1-01",
  sub_section_id: null,
  citation_url: "/api/v1/documents/doc-1/file#page=12",
};
const uncitedSource = {
  ...source,
  index: 2,
  document_id: "doc-2",
  doc_name: "Uncited.pdf",
  citation_url: "/api/v1/documents/doc-2/file#page=8",
  page_number: 8,
};

describe("MarkdownMessage", () => {
  it("renders GFM tables without interpreting raw HTML", () => {
    render(<MarkdownMessage content={"| Rule | Value |\n| --- | --- |\n| LTV | 80% |\n\n<script>alert(1)</script>"} sources={[]} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("<script>alert(1)</script>")).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
  });

  it("selects numeric citations without navigating and highlights the matching source", () => {
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    const select = vi.fn();
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<MarkdownMessage content="See the rule [1]." sources={[source, uncitedSource]} onCitationSelect={select} />);
    fireEvent.click(screen.getByRole("button", { name: "Show source 1" }));
    const sourceButton = screen.getByRole("button", { name: "A2-1-01" });
    expect(sourceButton.className).toMatch(/highlightedSource/);
    expect(select).toHaveBeenCalledWith(source, [source]);
    expect(open).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Uncited\.pdf/i })).not.toBeInTheDocument();
    expect(scroll).toHaveBeenCalled();
  });

  it("does not render a source list when the answer has no citations", () => {
    render(<MarkdownMessage content="The answer does not cite a document." sources={[source]} />);
    expect(screen.queryByLabelText("Sources")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Guide\.pdf/i })).not.toBeInTheDocument();
  });
});
