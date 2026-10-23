"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { citationLabel } from "./citation-label";
import { SOURCE_KIND_LABELS, sourceKind } from "./source-kind";

import type {
  AnswerPresentation,
  AnswerUiState,
  Chip,
  CitationSource,
  SourceIds,
  SourceKind,
} from "../../lib/api";

type AnswerPresentationProps = {
  presentation: AnswerPresentation;
  sources: CitationSource[];
  uiState?: AnswerUiState;
  onUiStateChange?: (state: AnswerUiState) => void;
  onCitationSelect?: (
    source: CitationSource,
    visibleSources: CitationSource[],
  ) => void;
};

const EMPTY_UI_STATE: AnswerUiState = {
  completed_step_ids: [],
  checked_document_ids: [],
};

const statusOrder = {
  clear: 0,
  fixable: 1,
  blocker: 2,
} as const;

type LegacyStatus = keyof typeof statusOrder;

/** Eligibility Breakdown chips, worst first; the outlook is the worst chip. */
const CHIP_ORDER: Chip[] = ["ineligible", "not_yet", "open", "discretion", "condition", "met"];

const CHIP_LABELS: Record<Chip, string> = {
  ineligible: "Ineligible",
  not_yet: "Not yet",
  open: "Open",
  discretion: "Discretion",
  condition: "Condition",
  met: "Met",
};

// Kept in step with the backend's mapping for answers that arrive without a legacy type.
const LEGACY_TYPE: Record<Chip, LegacyStatus> = {
  met: "clear",
  condition: "fixable",
  open: "fixable",
  discretion: "fixable",
  not_yet: "blocker",
  ineligible: "blocker",
};

// Guideline citations first and lender overlays last, as before the source kinds.
const KIND_ORDER: Record<SourceKind, number> = {
  guideline: 0,
  comparison: 1,
  calculation: 2,
  practice: 3,
  overlay: 4,
};

type IconType = LegacyStatus | "notfound" | Chip;

function StatusIcon({ type }: { type: IconType }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">
    {(type === "clear" || type === "met") && <path d="M5 12l5 5 9-10" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />}
    {type === "fixable" && <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-2.5z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />}
    {(type === "blocker" || type === "ineligible") && <><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2.4" /><path d="M6.5 6.5l11 11" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></>}
    {type === "notfound" && <><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2.4" /><path d="M21 21l-4.3-4.3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></>}
    {type === "condition" && <><rect x="6" y="4" width="12" height="17" rx="2" fill="none" stroke="currentColor" strokeWidth="2.2" /><path d="M9 4.5V3h6v1.5M9 11h6M9 15h4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></>}
    {type === "open" && <><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.2" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.6v.6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /><circle cx="12" cy="17.2" r="1.2" fill="currentColor" /></>}
    {type === "discretion" && <path d="M12 4v16M7 20h10M5 8h14M5 8l-3 6a3 3 0 0 0 6 0zM19 8l-3 6a3 3 0 0 0 6 0z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
    {type === "not_yet" && <><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.2" /><path d="M12 7v5l3.5 2" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></>}
  </svg>;
}

type StatusItem = AnswerPresentation["statuses"][number];

function legacyType(item: StatusItem): LegacyStatus {
  return item.type ?? (item.chip ? LEGACY_TYPE[item.chip] : "fixable");
}

function uniqueSourceIds(ids: number[]) {
  return [...new Set(ids.filter(Number.isInteger))];
}

function collectSourceIds(value: unknown, output: number[] = []): number[] {
  if (Array.isArray(value)) {
    value.forEach((item) => collectSourceIds(item, output));
  } else if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.source_ids)) {
      output.push(...record.source_ids.filter((id): id is number => Number.isInteger(id)));
    }
    Object.values(record).forEach((item) => collectSourceIds(item, output));
  }
  return uniqueSourceIds(output);
}

function fullSourceLabel(source: CitationSource) {
  const kind = sourceKind(source);
  const parts = [
    kind === "guideline" ? null : SOURCE_KIND_LABELS[kind],
    source.sub_section_id || source.section_id || source.title,
    source.doc_name,
    source.page_number ? `p. ${source.page_number}` : null,
  ].filter((part, index, values): part is string => Boolean(part) && values.indexOf(part) === index);
  return parts.join(" · ") || "Source";
}

type CitationProps = SourceIds & {
  byIndex: Map<number, CitationSource>;
  selectedSource: number | null;
  onSelect: (source: CitationSource) => void;
  inline?: boolean;
};

function Citations({ source_ids, byIndex, selectedSource, onSelect, inline = false }: CitationProps) {
  const matched = uniqueSourceIds(source_ids)
    .map((id) => byIndex.get(id))
    .filter((source): source is CitationSource => Boolean(source))
    .sort((a, b) => KIND_ORDER[sourceKind(a)] - KIND_ORDER[sourceKind(b)] || a.index - b.index);

  if (!matched.length) return null;
  const Wrapper = inline ? "span" : "div";
  return <Wrapper className={`cv-cites${inline ? " cv-cites--inline" : ""}`}>
    {matched.map((source) => {
      const kind = sourceKind(source);
      return <button
        key={source.index}
        type="button"
        className={`cv-cite cv-cite--${kind === "guideline" ? "source" : `${kind} cv-cite--labeled`}`}
        aria-pressed={selectedSource === source.index}
        title={fullSourceLabel(source)}
        onClick={() => onSelect(source)}
      >{kind !== "guideline" && <span className="cv-cite__kind">{SOURCE_KIND_LABELS[kind]}</span>}<span className="cv-cite__label">{citationLabel(source)}</span></button>;
    })}
  </Wrapper>;
}

function ChipBadge({ chip }: { chip: Chip }) {
  return <span className={`cv-badge cv-chip cv-chip--${chip}`}><StatusIcon type={chip} />{CHIP_LABELS[chip]}</span>;
}

function Bullets({ items }: { items: string[] }) {
  const bullets = items.filter(Boolean);
  if (!bullets.length) return null;
  return <ul className="cv-bullets">{bullets.map((item, index) => <li key={index}><span>{item}</span></li>)}</ul>;
}

function StepDetails({ step, citationProps }: {
  step: AnswerPresentation["steps"][number];
  citationProps: Omit<CitationProps, "source_ids">;
}) {
  return <>
    <Bullets items={step.bullets} />
    {step.stop_if && <div className="cv-callout cv-callout--stop"><span className="cv-callout__tag">Stop if</span><span>{step.stop_if}</span></div>}
    {step.watch_out && <div className="cv-callout cv-callout--watch"><span className="cv-callout__tag">Watch out</span><span>{step.watch_out}</span></div>}
    <Citations {...citationProps} source_ids={step.source_ids} />
  </>;
}

export function AnswerPresentationView({
  presentation,
  sources,
  uiState = EMPTY_UI_STATE,
  onUiStateChange,
  onCitationSelect,
}: AnswerPresentationProps) {
  const reactId = useId();
  const anchorPrefix = `cv-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [localState, setLocalState] = useState<AnswerUiState>(uiState);
  const [copied, setCopied] = useState<"script" | "documents" | null>(null);
  const [selectedSource, setSelectedSource] = useState<number | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  const outlook = presentation.outlook ?? null;
  // Chipped answers list the worst item first, matching the outlook above them.
  // Saved answers keep their original best-first legacy order.
  const chipped = presentation.statuses.some((item) => item.chip);
  const sortedStatuses = useMemo(() => presentation.statuses
    .slice()
    .sort((a, b) => chipped
      ? CHIP_ORDER.indexOf(a.chip ?? "condition") - CHIP_ORDER.indexOf(b.chip ?? "condition")
      : statusOrder[legacyType(a)] - statusOrder[legacyType(b)]), [chipped, presentation.statuses]);
  const counts = sortedStatuses.reduce((result, item) => {
    result[legacyType(item)] += 1;
    return result;
  }, { clear: 0, fixable: 0, blocker: 0 });
  const chipCounts = CHIP_ORDER
    .map((chip) => [chip, sortedStatuses.filter((item) => item.chip === chip).length] as const)
    .filter(([, count]) => count > 0);
  // New answers never fall back to the retired "Possibly doable" headline.
  const modern = Boolean(outlook) || chipped || presentation.verdict.kicker === "Eligibility Outlook";
  const sectionCount = [
    presentation.borrower_script || presentation.key_callout,
    presentation.statuses.length,
    presentation.steps.length,
    presentation.plan_b.length || presentation.easiest_fix,
    presentation.donts.length,
    presentation.documents.length,
  ].filter(Boolean).length;
  // Saved answers without answer_kind retain their original layout heuristic.
  const complex = presentation.answer_kind === "borrower_scenario" ||
    (presentation.answer_kind == null && (sectionCount >= 4 || presentation.statuses.length >= 4 || presentation.steps.length >= 3));
  const verdictHeadline = {
    clear: "Yes",
    fixable: "Possibly doable",
    blocker: "Blocker to check",
    notfound: "Not in your documents",
  }[presentation.verdict.type];
  const byIndex = useMemo(() => new Map(sources.map((source) => [source.index, source])), [sources]);
  const allSourceIds = useMemo(() => collectSourceIds(presentation), [presentation]);
  const visibleSources = useMemo(() => {
    const visibleIds = new Set(allSourceIds);
    return sources.filter((source) => visibleIds.has(source.index));
  }, [allSourceIds, sources]);
  const state = onUiStateChange ? uiState : localState;
  const completed = new Set(state.completed_step_ids);
  const checkedDocuments = new Set(state.checked_document_ids);
  const doneCount = presentation.steps.reduce((total, _step, index) => total + (completed.has(`step-${index}`) ? 1 : 0), 0);

  const sections = [
    (presentation.borrower_script || presentation.key_callout) && ["say", "Talking points"],
    sortedStatuses.length && ["stand", "Breakdown"],
    presentation.steps.length && ["steps", "Next steps"],
    (presentation.plan_b.length || presentation.easiest_fix) && ["plan", "Alternative paths"],
    presentation.donts.length && ["dont", "Pitfalls"],
    presentation.documents.length && ["docs", "Documents"],
    presentation.next_fact_needed && ["ask", "Open question"],
  ].filter((section): section is string[] => Boolean(section));

  function updateState(nextState: AnswerUiState) {
    setLocalState(nextState);
    onUiStateChange?.(nextState);
  }

  function toggleStep(id: string) {
    const ids = new Set(state.completed_step_ids);
    if (ids.has(id)) ids.delete(id);
    else ids.add(id);
    updateState({ ...state, completed_step_ids: [...ids] });
  }

  function toggleDocument(id: string) {
    const ids = new Set(state.checked_document_ids);
    if (ids.has(id)) ids.delete(id);
    else ids.add(id);
    updateState({ ...state, checked_document_ids: [...ids] });
  }

  async function copyText(text: string, target: "script" | "documents") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(target);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  function openSource(source: CitationSource) {
    setSelectedSource(source.index);
    onCitationSelect?.(source, visibleSources);
  }

  const citationProps = { byIndex, selectedSource, onSelect: openSource };
  const documentText = presentation.documents
    .map((item) => [item.label, item.detail].filter(Boolean).join("\n  "))
    .filter(Boolean)
    .join("\n");
  const mailto = `mailto:?subject=${encodeURIComponent("Documents needed")}&body=${encodeURIComponent(documentText)}`;
  const footerHasCitations = allSourceIds.some((id) => byIndex.has(id));

  return <article className={`cv-answer${complex ? "" : " cv-answer--short"}`} aria-label="Answer">
    {(presentation.scope.label || presentation.scope.detail) && <p className={`cv-scope${presentation.scope.not_found ? " cv-scope--notfound" : ""}`}>
      <span>
        {presentation.scope.label && <strong>{presentation.scope.label}</strong>}
        {presentation.scope.label && presentation.scope.detail && <span aria-hidden="true"> · </span>}
        {presentation.scope.detail}
      </span>
    </p>}

    {outlook ? <div className={`cv-verdict cv-outlook cv-outlook--${outlook.chip}${chipCounts.length ? " cv-verdict--with-counts" : ""}`} role="group" aria-label="Eligibility Outlook">
      <span className="cv-verdict__icon"><StatusIcon type={outlook.chip} /></span>
      <div className="cv-verdict__body">
        <span className="cv-verdict__kicker">Eligibility Outlook</span>
        <p className="cv-verdict__text">{outlook.label}</p>
        {presentation.verdict.text && presentation.verdict.text !== outlook.label && <p className="cv-verdict__why">{presentation.verdict.text}</p>}
        {presentation.verdict.reason && <p className="cv-verdict__why">{presentation.verdict.reason}</p>}
        {outlook.basis && <p className="cv-outlook__basis">{outlook.basis}</p>}
      </div>
      {chipCounts.length > 0 && <ul className="cv-verdict__counts" aria-label="Breakdown summary">
        {chipCounts.map(([chip, count]) => <li key={chip} className={`is-${chip}`}>{count} {CHIP_LABELS[chip].toLowerCase()}</li>)}
      </ul>}
    </div> : (presentation.verdict.kicker || presentation.verdict.text || presentation.verdict.reason) && <div className={`cv-verdict cv-verdict--${presentation.verdict.type}${complex ? "" : " cv-verdict--compact"}${complex && sortedStatuses.length ? " cv-verdict--with-counts" : ""}`}>
      <span className="cv-verdict__icon"><StatusIcon type={presentation.verdict.type} /></span>
      <div className="cv-verdict__body">
        {(complex || presentation.verdict.kicker) && <span className="cv-verdict__kicker">{complex ? (modern ? presentation.verdict.kicker : "Verdict") : presentation.verdict.kicker}</span>}
        <p className="cv-verdict__text">{complex && !modern ? verdictHeadline : presentation.verdict.text}</p>
        {complex && !modern && presentation.verdict.text !== verdictHeadline && <p className="cv-verdict__why">{presentation.verdict.text}</p>}
        {presentation.verdict.reason && <p className="cv-verdict__why">{presentation.verdict.reason}</p>}
      </div>
      {complex && sortedStatuses.length > 0 && (chipped ? <ul className="cv-verdict__counts" aria-label="Breakdown summary">
        {chipCounts.map(([chip, count]) => <li key={chip} className={`is-${chip}`}>{count} {CHIP_LABELS[chip].toLowerCase()}</li>)}
      </ul> : <ul className="cv-verdict__counts">
        {counts.clear > 0 && <li className="is-clear">{counts.clear} clear</li>}
        {counts.fixable > 0 && <li className="is-fixable">{counts.fixable} fixable</li>}
        {counts.blocker > 0 && <li className="is-blocker">{counts.blocker} blocker{counts.blocker === 1 ? "" : "s"} to check</li>}
      </ul>)}
    </div>}

    {complex && sections.length >= 4 && <nav className="cv-jump" aria-label="Jump to section">
      {sections.map(([id, label]) => <a key={id} href={`#${anchorPrefix}-${id}`}>{label}</a>)}
    </nav>}

    {(presentation.borrower_script || presentation.key_callout) && <section className="cv-section" id={`${anchorPrefix}-say`}>
      {presentation.borrower_script && <h3 className="cv-section__title">Borrower Talking Points</h3>}
      {presentation.borrower_script && <div className="cv-script">
        <blockquote>{presentation.borrower_script}</blockquote>
        <div><button className="cv-btn cv-btn--primary" type="button" onClick={() => void copyText(presentation.borrower_script!, "script")}>{copied === "script" ? "Copied" : "Copy script"}</button></div>
      </div>}
      {presentation.key_callout && <div className="cv-callout cv-callout--key">{presentation.key_callout}</div>}
    </section>}

    {sortedStatuses.length > 0 && (complex ? <section className="cv-section" id={`${anchorPrefix}-stand`}>
      <h3 className="cv-section__title">Eligibility Breakdown</h3>
      <ul className="cv-status cv-card">{sortedStatuses.map((item, index) => {
        const type = legacyType(item);
        return <li key={`${item.chip ?? type}-${item.item}-${index}`} data-cv-chip={item.chip ?? undefined}>
          {item.chip ? <ChipBadge chip={item.chip} /> : <span className={`cv-badge cv-badge--${type}`}><StatusIcon type={type} />{type[0].toUpperCase() + type.slice(1)}</span>}
          <span className="cv-status__item">{item.item}{item.decides && (item.chip === "open" || item.chip === "not_yet") && <small className="cv-status__decides">{item.chip === "open" ? "Depends on" : "Clears"}: {item.decides}</small>}</span>
          <span className="cv-status__why">{item.reason}<Citations {...citationProps} source_ids={item.source_ids} inline /></span>
        </li>;
      })}</ul>
    </section> : <ol className="cv-conditions">{sortedStatuses.map((item, index) => <li key={`${item.item}-${index}`}><span>{item.chip && <ChipBadge chip={item.chip} />}<strong>{item.item}.</strong> {item.reason}<Citations {...citationProps} source_ids={item.source_ids} inline /></span></li>)}</ol>)}

    {presentation.steps.length > 0 && (complex ? <section className="cv-section" id={`${anchorPrefix}-steps`}>
      <h3 className="cv-section__title">Recommended Next Steps
        <span className="cv-progress" aria-hidden="true"><span style={{ width: `${(doneCount / presentation.steps.length) * 100}%` }} /></span>
        <span className="cv-progress-count" aria-live="polite">{doneCount} of {presentation.steps.length} done</span>
      </h3>
      <ol className="cv-steps">{presentation.steps.map((step, index) => {
        const id = `step-${index}`;
        const isDone = completed.has(id);
        return <li key={id} className={`cv-step${index === presentation.steps.length - 1 ? " cv-step--final" : ""}${isDone ? " is-done" : ""}`} data-cv-step={id}>
          <div className="cv-step__body">
            <div className="cv-step__head"><h4 className="cv-step__title">{step.title}</h4><label className="cv-done"><input type="checkbox" checked={isDone} onChange={() => toggleStep(id)} />Done</label></div>
            <StepDetails step={step} citationProps={citationProps} />
          </div>
        </li>;
      })}</ol>
    </section> : presentation.steps.length === 1 ? <div className="cv-callout cv-callout--next">
      <span className="cv-callout__tag">Recommended next step</span>
      <div className="cv-step__body">
        <strong>{presentation.steps[0].title}</strong>
        <StepDetails step={presentation.steps[0]} citationProps={citationProps} />
      </div>
    </div> : <ol className="cv-conditions">{presentation.steps.map((step, index) => <li key={`short-step-${index}`}>
      <div className="cv-step__body">
        <strong>{step.title}</strong>
        <StepDetails step={step} citationProps={citationProps} />
      </div>
    </li>)}</ol>)}

    {(presentation.plan_b.length > 0 || presentation.easiest_fix) && (complex ? <section className="cv-section" id={`${anchorPrefix}-plan`}>
      <h3 className="cv-section__title">Alternative Paths</h3>
      <div className="cv-card cv-plan">
        {presentation.plan_b.length > 0 && <ol className="cv-timeline">{presentation.plan_b.map((item, index) => <li key={`${item.when}-${item.title}-${index}`}>
          <span className="cv-timeline__rail" /><span className="cv-timeline__when">{item.when}</span><h4 className="cv-timeline__what">{item.title}</h4>
          <Bullets items={item.bullets} /><Citations {...citationProps} source_ids={item.source_ids} />
        </li>)}</ol>}
        {presentation.easiest_fix && <div className="cv-callout cv-callout--path"><span className="cv-callout__tag">Easiest fix</span><span>{presentation.easiest_fix}</span></div>}
      </div>
    </section> : <div className="cv-callout cv-callout--path" id={`${anchorPrefix}-plan`}>
      <span className="cv-callout__tag">Alternative paths</span>
      <div className="cv-step__body">
        {presentation.plan_b.map((item, index) => <div className="cv-step__body" key={`short-plan-${index}`}>
          <span>{item.when}: <strong>{item.title}</strong></span>
          <Bullets items={item.bullets} />
          <Citations {...citationProps} source_ids={item.source_ids} />
        </div>)}
        {presentation.easiest_fix && <span><strong>Easiest fix: </strong>{presentation.easiest_fix}</span>}
      </div>
    </div>)}

    {presentation.donts.length > 0 && (complex ? <section className="cv-section" id={`${anchorPrefix}-dont`}>
      <h3 className="cv-section__title">Common Pitfalls</h3>
      <ul className="cv-donts cv-card">{presentation.donts.map((item, index) => <li key={`${item.text}-${index}`}><span>{item.text}<Citations {...citationProps} source_ids={item.source_ids} inline /></span></li>)}</ul>
    </section> : <div className="cv-callout cv-callout--watch">
      <span className="cv-callout__tag">Common pitfalls</span>
      <div className="cv-step__body">{presentation.donts.map((item, index) => <span key={`short-dont-${index}`}>
        {item.text}<Citations {...citationProps} source_ids={item.source_ids} inline />
      </span>)}</div>
    </div>)}

    {presentation.documents.length > 0 && <section className="cv-section" id={`${anchorPrefix}-docs`}>
      <h3 className="cv-section__title">Documentation Required</h3>
      <div className="cv-card">
        <ul className="cv-checklist">{presentation.documents.map((item, index) => {
          const id = `document-${index}`;
          const inputId = `${anchorPrefix}-${id}`;
          return <li key={id} data-cv-document={id}>
            <input id={inputId} type="checkbox" checked={checkedDocuments.has(id)} onChange={() => toggleDocument(id)} />
            <div>
              <label htmlFor={inputId}>{item.label}</label>
              {item.detail && <p className="cv-checklist__detail">{item.detail}</p>}
              {item.basis && <p className="cv-checklist__basis"><span>Basis</span>{item.basis}</p>}
              <Citations {...citationProps} source_ids={item.source_ids} />
            </div>
          </li>;
        })}</ul>
        <div className="cv-actions">
          <button className="cv-btn cv-btn--primary" type="button" onClick={() => void copyText(documentText, "documents")}>{copied === "documents" ? "Copied" : "Copy list"}</button>
          <a className="cv-btn" href={mailto}>Email list to borrower</a>
        </div>
      </div>
    </section>}

    {presentation.next_fact_needed && <div className="cv-callout cv-callout--next cv-callout--ask" id={`${anchorPrefix}-ask`}><span className="cv-callout__tag">Open Question for Borrower</span><span>{presentation.next_fact_needed}</span></div>}

    {(presentation.verify_line || footerHasCitations) && <footer className="cv-footer">
      {presentation.verify_line && <p className="cv-footer__verify">{presentation.verify_line}</p>}
      {footerHasCitations && <span className="cv-footer__label">Sources</span>}
      <Citations {...citationProps} source_ids={allSourceIds} />
    </footer>}
  </article>;
}
