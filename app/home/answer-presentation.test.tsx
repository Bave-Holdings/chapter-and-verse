import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AnswerPresentation, CitationSource } from "../../lib/api";
import { AnswerPresentationView } from "./answer-presentation";

const source: CitationSource = {
  index: 1,
  document_id: "doc-1",
  doc_name: "Selling Guide.pdf",
  page_number: 12,
  section_id: "B3-6-02",
  sub_section_id: null,
  citation_url: "/api/v1/documents/doc-1/file#page=12",
};

const presentation: AnswerPresentation = {
  scope: { label: "Mortgage › Conventional", detail: "Selling Guide", not_found: false },
  verdict: { type: "fixable", kicker: "Verdict", text: "Possibly doable", reason: "Check the details.", source_ids: [1] },
  borrower_script: "Please send the requested documents.",
  key_callout: null,
  statuses: [
    { type: "blocker", item: "Condo", reason: "Review needed", source_ids: [999] },
    { type: "clear", item: "Credit", reason: "Strong", source_ids: [1] },
    { type: "fixable", item: "Gift", reason: "Needs a letter", source_ids: [] },
    { type: "clear", item: "Assets", reason: "Enough", source_ids: [] },
  ],
  steps: [
    { title: "Calculate DTI", bullets: ["Use verified payments"], stop_if: null, watch_out: null, source_ids: [1] },
    { title: "Review condo", bullets: [], stop_if: "Structural repairs are planned", watch_out: null, source_ids: [] },
    { title: "Run DU", bullets: [], stop_if: null, watch_out: "Use verified figures", source_ids: [] },
  ],
  plan_b: [],
  easiest_fix: null,
  donts: [],
  documents: [{ label: "Paystubs", source_ids: [1] }],
  next_fact_needed: null,
  verify_line: "Verify against the current guide.",
};

describe("AnswerPresentationView", () => {
  it("keeps document selection separate from opening its compact citation", () => {
    const select = vi.fn();
    const change = vi.fn();
    const repeated = { ...source, sub_section_id: "Documentation Requirements: Documentation Requirements" };
    const { container, rerender } = render(<AnswerPresentationView presentation={presentation} sources={[repeated]} onCitationSelect={select} onUiStateChange={change} />);
    const document = within(container.querySelector('[data-cv-document="document-0"]')!);

    fireEvent.click(document.getByRole("button", { name: "Documentation Requirements" }));
    expect(select).toHaveBeenCalledWith(repeated, [repeated]);
    expect(change).not.toHaveBeenCalled();
    expect(document.getByRole("checkbox", { name: "Paystubs" })).not.toBeChecked();

    fireEvent.click(document.getByText("Paystubs"));
    expect(change).toHaveBeenLastCalledWith({ completed_step_ids: [], checked_document_ids: ["document-0"] });
    rerender(<AnswerPresentationView presentation={presentation} sources={[repeated]} onCitationSelect={select} onUiStateChange={change} uiState={change.mock.lastCall![0]} />);
    expect(document.getByRole("checkbox", { name: "Paystubs" })).toBeChecked();
  });

  it("renders deterministic ordering, computed counts, and restored checklist state", () => {
    const onUiStateChange = vi.fn();
    const { container } = render(<AnswerPresentationView
      presentation={presentation}
      sources={[source]}
      uiState={{ completed_step_ids: ["step-0"], checked_document_ids: ["document-0"] }}
      onUiStateChange={onUiStateChange}
    />);

    expect(screen.getByText("2 clear")).toBeInTheDocument();
    expect(screen.getByText("1 fixable")).toBeInTheDocument();
    expect(screen.getByText("1 blocker to check")).toBeInTheDocument();
    const statuses = screen.getByRole("heading", { name: "Where you stand" }).parentElement!;
    expect(within(statuses).getAllByText(/Clear|Fixable|Blocker/).map((node) => node.textContent)).toEqual(["Clear", "Clear", "Fixable", "Blocker"]);
    expect(container.querySelector('[data-cv-step="step-0"]')).toHaveClass("is-done");
    expect(container.querySelector('[data-cv-step="step-2"]')).toHaveClass("cv-step--final");
    expect(container.querySelector<HTMLInputElement>('[data-cv-document="document-0"] input')).toBeChecked();
    expect(screen.queryByText("999")).not.toBeInTheDocument();

    fireEvent.click(within(container.querySelector('[data-cv-step="step-1"]')!).getByRole("checkbox"));
    expect(onUiStateChange).toHaveBeenLastCalledWith({
      completed_step_ids: ["step-0", "step-1"],
      checked_document_ids: ["document-0"],
    });
  });

  it("selects only matched citation sources without navigating and never interprets presentation text as HTML", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const select = vi.fn();
    const unsafe = { ...presentation, key_callout: "<img src=x onerror=alert(1)>" };
    const { container } = render(<AnswerPresentationView presentation={unsafe} sources={[source]} onCitationSelect={select} />);

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
    const citation = screen.getAllByRole("button", { name: "B3-6-02" })[0];
    expect(citation).toHaveAttribute("title", "B3-6-02 · Selling Guide.pdf · p. 12");
    fireEvent.click(citation);
    expect(citation).toHaveAttribute("aria-pressed", "true");
    expect(select).toHaveBeenCalledWith(source, [source]);
    expect(open).not.toHaveBeenCalled();
  });
});
