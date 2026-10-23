import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

function shortAnswer(overrides: Partial<AnswerPresentation> = {}): AnswerPresentation {
  return {
    ...presentation,
    borrower_script: null,
    statuses: [],
    steps: [],
    documents: [],
    verify_line: null,
    ...overrides,
  };
}

describe("AnswerPresentationView", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses the full scenario layout with a short headline even with only a script and documents", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", Object.create(navigator, { clipboard: { value: { writeText } } }));
    const conclusion = "The funds can be used if the lender documents the donor and transfer.";
    const script = "We can consider the gift once its source and transfer are documented.";
    const { container } = render(<AnswerPresentationView presentation={shortAnswer({
      answer_kind: "borrower_scenario",
      verdict: { ...presentation.verdict, text: conclusion },
      borrower_script: script,
      documents: [{ label: "Signed gift letter", source_ids: [1] }],
    })} sources={[source]} />);

    expect(screen.getByRole("article")).not.toHaveClass("cv-answer--short");
    expect(container.querySelector(".cv-verdict")).not.toHaveClass("cv-verdict--compact");
    expect(container.querySelector(".cv-verdict__text")).toHaveTextContent("Possibly doable");
    expect(screen.getByText(conclusion)).toHaveClass("cv-verdict__why");
    expect(screen.getByText("Check the details.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Borrower Talking Points" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Signed gift letter" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copy script" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument());
    expect(writeText).toHaveBeenCalledWith(script);
    expect(container.querySelector(".cv-timeline, .cv-donts, .cv-status, .cv-steps")).toBeNull();
  });

  it("shows component findings and actions in full scenario sections below the conditional verdict", () => {
    const { container } = render(<AnswerPresentationView presentation={shortAnswer({
      answer_kind: "borrower_scenario",
      borrower_script: "The gift needs documentation before it can be used.",
      statuses: [{ type: "fixable", item: "Gift documentation", reason: "A signed letter is needed.", source_ids: [1] }],
      steps: [{ title: "Document the gift", bullets: ["Obtain the signed letter"], stop_if: null, watch_out: null, source_ids: [1] }],
    })} sources={[source]} />);
    expect(screen.getByRole("heading", { name: "Eligibility Breakdown" })).toBeInTheDocument();
    expect(screen.getByText("1 fixable")).toBeInTheDocument();
    expect(container.querySelector(".cv-verdict")).toHaveClass("cv-verdict--fixable", "cv-verdict--with-counts");
    expect(within(container.querySelector(".cv-steps")!).getByText("Obtain the signed letter")).toBeInTheDocument();
    expect(container.querySelector(".cv-progress")).toBeInTheDocument();
  });

  it("keeps a general policy answer compact with its direct answer as the headline", () => {
    const directAnswer = "Yes, with documented gift funds.";
    const { container } = render(<AnswerPresentationView presentation={shortAnswer({
      answer_kind: "simple", verdict: { ...presentation.verdict, text: directAnswer },
    })} sources={[source]} />);
    expect(screen.getByRole("article")).toHaveClass("cv-answer--short");
    expect(container.querySelector(".cv-verdict__text")).toHaveTextContent(directAnswer);
    expect(screen.queryByRole("button", { name: "Copy script" })).not.toBeInTheDocument();
  });

  it("keeps every bullet, stop rule, warning, and citation in a single Next step", () => {
    const select = vi.fn();
    const { container } = render(<AnswerPresentationView presentation={shortAnswer({ steps: [{
      title: "Verify the income",
      bullets: ["Obtain current paystubs", "Confirm the employment history"],
      stop_if: "The employment cannot be verified",
      watch_out: "Do not count unverified overtime",
      source_ids: [1],
    }] })} sources={[source]} onCitationSelect={select} />);

    expect(screen.getByRole("article")).toHaveClass("cv-answer--short");
    const next = within(container.querySelector(".cv-callout--next")!);
    for (const text of ["Recommended next step", "Verify the income", "Obtain current paystubs", "Confirm the employment history", "Stop if", "The employment cannot be verified", "Watch out", "Do not count unverified overtime"]) {
      expect(next.getByText(text)).toBeInTheDocument();
    }
    expect(container.querySelector(".cv-callout--stop")).toBeInTheDocument();
    expect(container.querySelector(".cv-callout--watch")).toBeInTheDocument();
    expect(container.querySelector(".cv-conditions, .cv-progress, .cv-jump, .cv-verdict__counts")).toBeNull();
    fireEvent.click(next.getByRole("button", { name: "B3-6-02" }));
    expect(select).toHaveBeenCalledWith(source, [source]);
  });

  it("preserves all details of multiple short steps in numbered conditions", () => {
    const steps = [
      { title: "First action", bullets: ["First requirement", "Second requirement"], stop_if: "First stop rule", watch_out: "First caution", source_ids: [1] },
      { title: "Second action", bullets: ["Third requirement", "Fourth requirement"], stop_if: "Second stop rule", watch_out: "Second caution", source_ids: [1] },
    ];
    const { container } = render(<AnswerPresentationView presentation={shortAnswer({ steps })} sources={[source]} />);

    expect(screen.getByRole("article")).toHaveClass("cv-answer--short");
    const conditions = container.querySelectorAll(".cv-conditions > li");
    expect(conditions).toHaveLength(2);
    steps.forEach((step, index) => {
      const condition = within(conditions[index] as HTMLElement);
      for (const text of [step.title, ...step.bullets, step.stop_if, step.watch_out]) {
        expect(condition.getByText(text)).toBeInTheDocument();
      }
      expect(condition.getByRole("button", { name: "B3-6-02" })).toBeInTheDocument();
    });
    expect(container.querySelector(".cv-steps, .cv-progress, .cv-callout--next")).toBeNull();
  });

  it("keeps all alternatives and cautions with their citations in compact callouts", () => {
    const { container } = render(<AnswerPresentationView presentation={shortAnswer({
      plan_b: [
        { when: "Now", title: "Document the gap", bullets: ["Request an explanation", "Verify the dates"], source_ids: [1] },
        { when: "After verification", title: "Reassess", bullets: ["Use the verified figures"], source_ids: [1] },
      ],
      easiest_fix: "Resolve the missing documentation first",
      donts: [
        { text: "Do not assume approval", source_ids: [1] },
        { text: "Do not omit liabilities", source_ids: [1] },
      ],
    })} sources={[source]} />);

    expect(screen.getByRole("article")).toHaveClass("cv-answer--short");
    const plan = within(container.querySelector(".cv-callout--path")!);
    for (const text of ["Alternative paths", "Document the gap", "Request an explanation", "Verify the dates", "Reassess", "Use the verified figures"]) {
      expect(plan.getByText(text)).toBeInTheDocument();
    }
    expect(plan.getByText(/Now:/)).toBeInTheDocument();
    expect(plan.getByText(/After verification:/)).toBeInTheDocument();
    expect(plan.getByText(/Resolve the missing documentation first/)).toBeInTheDocument();
    expect(plan.getAllByRole("button", { name: "B3-6-02" })).toHaveLength(2);
    expect(container.querySelectorAll(".cv-callout--watch")).toHaveLength(1);
    const watch = within(container.querySelector(".cv-callout--watch")!);
    expect(watch.getByText("Do not assume approval")).toBeInTheDocument();
    expect(watch.getByText("Do not omit liabilities")).toBeInTheDocument();
    expect(watch.getAllByRole("button", { name: "B3-6-02" })).toHaveLength(2);
    expect(container.querySelector(".cv-timeline, .cv-donts")).toBeNull();
  });

  it("renders a minimal answer without empty sections or a borrower heading", () => {
    const { container } = render(<AnswerPresentationView presentation={shortAnswer()} sources={[source]} />);

    expect(container.querySelector(".cv-verdict")).toHaveClass("cv-verdict--compact");
    expect(screen.getByText("Possibly doable")).toBeInTheDocument();
    expect(screen.getByText("Check the details.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "B3-6-02" })).toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(container.querySelector(".cv-section, .cv-callout, .cv-status, .cv-script, .cv-checklist")).toBeNull();
  });

  it("does not label a standalone key callout as a borrower script", () => {
    render(<AnswerPresentationView presentation={shortAnswer({ key_callout: "Confirm the applicable policy first" })} sources={[source]} />);
    expect(screen.getByText("Confirm the applicable policy first")).toBeInTheDocument();
    expect(screen.queryByText("Borrower Talking Points")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy script" })).not.toBeInTheDocument();
  });

  it("retains the full timeline and don't list for complex answers", () => {
    const { container } = render(<AnswerPresentationView presentation={{ ...presentation,
      plan_b: [{ when: "Later", title: "Review again", bullets: ["Confirm the new evidence"], source_ids: [1] }],
      donts: [{ text: "Do not assume approval", source_ids: [1] }],
    }} sources={[source]} />);
    expect(screen.getByRole("article")).not.toHaveClass("cv-answer--short");
    expect(within(container.querySelector(".cv-timeline")!).getByText("Confirm the new evidence")).toBeInTheDocument();
    expect(within(container.querySelector(".cv-donts")!).getByText("Do not assume approval")).toBeInTheDocument();
  });

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
    const statuses = screen.getByRole("heading", { name: "Eligibility Breakdown" }).parentElement!;
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

  describe("Stage 2 contract", () => {
    const practice: CitationSource = {
      index: 2, document_id: "playbook", doc_name: "Intellence Underwriter Playbook (FHA)", page_number: 0,
      section_id: "Employment gaps", sub_section_id: null, citation_url: "", kind: "practice",
      text_preview: "Underwriters ask for a letter for any gap over 30 days.",
    };
    const overlay: CitationSource = { ...practice, index: 3, doc_name: "Acme FHA overlays", section_id: "Minimum credit score", kind: "overlay" };
    const comparison: CitationSource = { ...source, index: 4, section_id: "B3-3.2-02", kind: "comparison" };
    const calculation: CitationSource = { ...practice, index: 5, doc_name: "Chapter & Verse calculator", section_id: "Borrower calculations", kind: "calculation" };
    const sources = [source, practice, overlay, comparison, calculation];

    const scenario = (overrides: Partial<AnswerPresentation> = {}): AnswerPresentation => shortAnswer({
      answer_kind: "borrower_scenario",
      verdict: { type: "fixable", kicker: "Eligibility Outlook", text: "The salary works; the bonus waits.", reason: "", source_ids: [1] },
      outlook: { chip: "open", label: "Pending: relocation distance", basis: "Based on HUD 4000.1 and the facts provided. Not a credit decision.", items: ["Departing residence"] },
      statuses: [
        { chip: "met", type: "clear", item: "Employment gap", reason: "Under six months.", source_ids: [1] },
        { chip: "open", type: "fixable", decides: "relocation distance", item: "Departing residence", reason: "Depends on the move.", source_ids: [2] },
        { chip: "condition", type: "fixable", item: "Gift funds", reason: "Needs a gift letter.", source_ids: [3] },
        { chip: "discretion", type: "fixable", item: "Chapter 7", reason: "Extenuating circumstances.", source_ids: [1] },
      ],
      ...overrides,
    });

    it("leads with the Eligibility Outlook label, its chip and the fixed basis line", () => {
      const { container } = render(<AnswerPresentationView presentation={scenario()} sources={sources} />);
      const outlook = screen.getByRole("group", { name: "Eligibility Outlook" });
      expect(outlook).toHaveClass("cv-outlook--open");
      expect(within(outlook).getByText("Eligibility Outlook")).toBeInTheDocument();
      expect(within(outlook).getByText("Pending: relocation distance")).toHaveClass("cv-verdict__text");
      expect(within(outlook).getByText("The salary works; the bonus waits.")).toBeInTheDocument();
      expect(within(outlook).getByText("Based on HUD 4000.1 and the facts provided. Not a credit decision.")).toBeInTheDocument();
      expect(within(outlook).getByLabelText("Breakdown summary")).toHaveTextContent("1 open1 discretion1 condition1 met");
      expect(container.textContent).not.toMatch(/Possibly doable|Verdict/);
    });

    it("lists the breakdown worst first with a chip, icon and word per item", () => {
      const { container } = render(<AnswerPresentationView presentation={scenario()} sources={sources} />);
      const rows = Array.from(container.querySelectorAll(".cv-status > li"));
      expect(rows.map((row) => row.getAttribute("data-cv-chip"))).toEqual(["open", "discretion", "condition", "met"]);
      expect(rows.map((row) => row.querySelector(".cv-chip")!.textContent)).toEqual(["Open", "Discretion", "Condition", "Met"]);
      rows.forEach((row) => expect(row.querySelector(".cv-chip svg")).not.toBeNull());
      expect(within(rows[0] as HTMLElement).getByText("Depends on: relocation distance")).toBeInTheDocument();
    });

    it("uses the client's section headers in order, ending with the open question", () => {
      render(<AnswerPresentationView presentation={scenario({
        borrower_script: "We can likely use your salary.",
        steps: [{ title: "Confirm the move", bullets: [], stop_if: "Under 100 miles", watch_out: null, source_ids: [1] }],
        plan_b: [{ when: "Now", title: "Consider conventional", bullets: [], source_ids: [4] }],
        donts: [{ text: "Do not count the bonus yet", source_ids: [1] }],
        documents: [{ label: "Written VOE", source_ids: [1] }],
        next_fact_needed: "How far is the new job from the current home?",
      })} sources={sources} />);
      expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.firstChild?.textContent?.trim())).toEqual([
        "Borrower Talking Points", "Eligibility Breakdown", "Recommended Next Steps", "Alternative Paths", "Common Pitfalls", "Documentation Required",
      ]);
      expect(screen.getByText("Open Question for Borrower")).toBeInTheDocument();
      expect(screen.getByRole("navigation", { name: "Jump to section" })).toHaveTextContent(/Talking points.*Breakdown.*Next steps.*Alternative paths.*Pitfalls.*Documents.*Open question/);
    });

    it("labels every non-guideline source and keeps guideline citations first", () => {
      const select = vi.fn();
      render(<AnswerPresentationView presentation={scenario({ statuses: [], outlook: null, steps: [
        { title: "Check everything", bullets: [], stop_if: null, watch_out: null, source_ids: [3, 5, 2, 4, 1] },
      ] })} sources={sources} onCitationSelect={select} />);
      const step = screen.getByText("Check everything").closest("li")!;
      const chips = within(step).getAllByRole("button");
      ["source", "comparison", "calculation", "practice", "overlay"].forEach((kind, index) => expect(chips[index]).toHaveClass(`cv-cite--${kind}`));
      expect(chips[0]).not.toHaveClass("cv-cite--labeled");
      chips.slice(1).forEach((chip) => expect(chip).toHaveClass("cv-cite--labeled"));
      expect(chips.map((chip) => chip.textContent)).toEqual([
        "B3-6-02", "Conventional comparisonB3-3.2-02", "CalculatedBorrower calculations", "Underwriter practiceEmployment gaps", "OverlayMinimum credit score",
      ]);
      expect(chips[3]).toHaveAttribute("title", "Underwriter practice · Employment gaps · Intellence Underwriter Playbook (FHA)");
      fireEvent.click(chips[3]);
      expect(select).toHaveBeenCalledWith(practice, expect.any(Array));
    });

    it("shows a letter of explanation with what it covers and its basis", () => {
      render(<AnswerPresentationView presentation={scenario({ documents: [{
        label: "Letter of explanation: Employment gap",
        detail: "Covers the reason for the gap. Supporting documents: a written VOE.",
        basis: "Underwriter practice",
        source_ids: [2],
      }] })} sources={sources} />);
      expect(screen.getByRole("checkbox", { name: "Letter of explanation: Employment gap" })).toBeInTheDocument();
      expect(screen.getByText("Covers the reason for the gap. Supporting documents: a written VOE.")).toHaveClass("cv-checklist__detail");
      expect(screen.getByText("Underwriter practice", { selector: ".cv-checklist__basis" })).toBeInTheDocument();
    });

    it("never shows the retired headline for a new scenario answer without chips", () => {
      const { container } = render(<AnswerPresentationView presentation={scenario({ outlook: null, statuses: [], borrower_script: "Script", documents: [{ label: "VOE", source_ids: [] }] })} sources={sources} />);
      expect(container.querySelector(".cv-verdict__kicker")).toHaveTextContent("Eligibility Outlook");
      expect(container.querySelector(".cv-verdict__text")).toHaveTextContent("The salary works; the bonus waits.");
      expect(container.textContent).not.toContain("Possibly doable");
    });

    it("renders an ineligible outlook as a stop", () => {
      render(<AnswerPresentationView presentation={scenario({
        outlook: { chip: "ineligible", label: "Ineligible under FHA: consider conventional", basis: "", items: ["Second job"] },
        statuses: [{ chip: "ineligible", decides: "conventional", item: "Second job", reason: "One year only.", source_ids: [1] }],
      })} sources={sources} />);
      expect(screen.getByRole("group", { name: "Eligibility Outlook" })).toHaveClass("cv-outlook--ineligible");
      expect(screen.getByText("Ineligible", { selector: ".cv-chip" })).toHaveClass("cv-chip--ineligible");
    });
  });
});
