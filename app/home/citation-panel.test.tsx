import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CitationSource } from "../../lib/api";
import { CitationPanel } from "./citation-panel";

const sources: CitationSource[] = [
  {
    index: 1,
    document_id: "hud-1",
    doc_name: "a3f21c7890ab_HUD Handbook 4000.1 (2).pdf",
    page_number: 212,
    section_id: "II.A.4.c",
    sub_section_id: "II.A.4.c · Self-employment income",
    title: "Employment income",
    document_version: "2026.2",
    text_preview: "FHA permits income from self-employment when the borrower has been self-employed.",
    cited_passages: [{
      claim: "Self-employment income may be used.",
      passage: "FHA permits income from self-employment when the borrower has been self-employed.",
      page_number: 212,
    }],
    citation_url: "/api/v1/documents/hud-1/file#page=212",
    source_kind: "source",
  },
  {
    index: 2,
    document_id: "overlay-1",
    doc_name: "Credit Policy 4.2.pdf",
    page_number: 8,
    section_id: "4.2",
    sub_section_id: null,
    document_version: "4.2",
    text_preview: "Apply the firm overlay after the agency guidance.",
    cited_passages: [{
      claim: "The firm overlay applies.",
      passage: "Apply the firm overlay after the agency guidance.",
      page_number: 8,
    }],
    citation_url: "/api/v1/documents/overlay-1/file#page=8",
    source_kind: "overlay",
  },
];

describe("CitationPanel", () => {
  it("shows returned metadata and switches citation tabs", () => {
    const select = vi.fn();
    const { rerender } = render(<CitationPanel source={sources[0]} sources={sources} agentName="FHA Handbook 4000.1" onSelect={select} onClose={vi.fn()} />);
    const panel = screen.getByRole("complementary", { name: "Citation details" });

    expect(within(panel).getByRole("heading", { name: "HUD Handbook 4000.1" })).toBeInTheDocument();
    expect(panel).toHaveTextContent("II.A.4.c · Self-employment income");
    expect(panel).toHaveTextContent("212");
    expect(panel).toHaveTextContent("2026.2");
    expect(panel).toHaveTextContent("FHA Handbook 4000.1");
    expect(panel).toHaveTextContent(sources[0].cited_passages![0].passage);

    expect(within(panel).getByRole("tab", { name: "HUD Handbook 4000.1" })).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("tab", { name: "Credit Policy 4.2" }));
    expect(select).toHaveBeenCalledWith(sources[1]);
    rerender(<CitationPanel source={sources[1]} sources={sources} agentName="FHA Handbook 4000.1" onSelect={select} onClose={vi.fn()} />);
    expect(screen.getByRole("tab", { name: "Credit Policy 4.2" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Apply the firm overlay after the agency guidance.")).toBeInTheDocument();
  });

  it("opens the returned URL and closes on request", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const close = vi.fn();
    render(<CitationPanel source={sources[0]} sources={sources} agentName="Mortgage" onSelect={vi.fn()} onClose={close} />);

    fireEvent.click(screen.getByRole("button", { name: "Open at page" }));
    expect(open).toHaveBeenCalledWith(sources[0].citation_url, "_blank", "noopener,noreferrer");
    fireEvent.click(screen.getByRole("button", { name: "Close citation details" }));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("handles missing excerpt and URL safely", () => {
    const source = { ...sources[0], cited_passages: [], citation_url: null };
    render(<CitationPanel source={source} sources={[source]} agentName="Mortgage" onSelect={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByText("An exact cited passage is unavailable for this citation.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open at page" })).toBeDisabled();
  });

  it("copies a source reference and supports keyboard navigation between documents", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const select = vi.fn();
    render(<CitationPanel source={sources[0]} sources={sources} agentName="Mortgage" onSelect={select} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Copy citation" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Citation copied");
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("HUD Handbook 4000.1 — II.A.4.c · Self-employment income, p. 212"));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("/api/v1/documents/hud-1/file#page=212"));

    const first = screen.getByRole("tab", { name: "HUD Handbook 4000.1" });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(select).toHaveBeenCalledWith(sources[1]);
    expect(screen.getByRole("tab", { name: "Credit Policy 4.2" })).toHaveFocus();
  });

  it("shows a playbook source's own text instead of a PDF page", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const practice: CitationSource = {
      index: 3, document_id: "playbook", doc_name: "Intellence Underwriter Playbook (FHA)", page_number: 0,
      section_id: "Employment gaps", sub_section_id: null, citation_url: "", kind: "practice",
      text_preview: "Underwriters ask for a letter for any gap over 30 days.", cited_passages: [],
    };
    render(<CitationPanel source={practice} sources={[practice]} agentName="FHA Handbook 4000.1" onSelect={vi.fn()} onClose={vi.fn()} />);
    const panel = screen.getByRole("complementary", { name: "Citation details" });

    expect(panel).toHaveTextContent("Underwriter practice · FHA Handbook 4000.1");
    expect(panel).toHaveTextContent("Underwriter practice, not agency policy.");
    expect(within(panel).getByText("Underwriters ask for a letter for any gap over 30 days.")).toBeInTheDocument();
    expect(within(panel).queryByText("Page")).not.toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: "Open at page" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copy citation" }));
    await screen.findByRole("status");
    expect(writeText).toHaveBeenCalledWith("Intellence Underwriter Playbook (FHA) — Employment gaps");
  });

  it("labels a conventional comparison and keeps its PDF page", () => {
    const comparison: CitationSource = { ...sources[0], index: 4, doc_name: "Fannie Mae Selling Guide.pdf", section_id: "B3-3.2-02", sub_section_id: null, kind: "comparison" };
    render(<CitationPanel source={comparison} sources={[comparison]} agentName="FHA Handbook 4000.1" onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole("complementary")).toHaveTextContent("Conventional comparison · FHA Handbook 4000.1");
    expect(screen.getByRole("complementary")).toHaveTextContent("never changes this program's outlook");
    expect(screen.getByRole("button", { name: "Open at page" })).toBeEnabled();
  });
});
