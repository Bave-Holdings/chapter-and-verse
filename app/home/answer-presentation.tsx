"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import type {
  AnswerPresentation,
  AnswerUiState,
  CitationSource,
  SourceIds,
} from "../../lib/api";

type AnswerPresentationProps = {
  presentation: AnswerPresentation;
  sources: CitationSource[];
  uiState?: AnswerUiState;
  onUiStateChange?: (state: AnswerUiState) => void;
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

function StatusIcon({ type }: { type: "clear" | "fixable" | "blocker" | "notfound" }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">
    {type === "clear" && <path d="M5 12l5 5 9-10" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />}
    {type === "fixable" && <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-2.5z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />}
    {type === "blocker" && <><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2.4" /><path d="M6.5 6.5l11 11" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></>}
    {type === "notfound" && <><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2.4" /><path d="M21 21l-4.3-4.3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></>}
  </svg>;
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
  const parts = [
    source.section_id || source.sub_section_id || source.title,
    source.doc_name,
    source.page_number ? `p. ${source.page_number}` : null,
  ].filter((part, index, values): part is string => Boolean(part) && values.indexOf(part) === index);
  return parts.join(" · ") || "Source";
}

function compactSourceLabel(source: CitationSource) {
  const heading = source.section_id || source.sub_section_id || source.title || source.doc_name || "Source";
  const colonIndex = heading.indexOf(":");
  const sectionCode = colonIndex > 0 && colonIndex <= 24 ? heading.slice(0, colonIndex) : heading;
  const shortened = sectionCode.length > 36 ? `${sectionCode.slice(0, 35).trimEnd()}…` : sectionCode;
  return `${shortened}${source.page_number ? ` · p. ${source.page_number}` : ""}`;
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
    .sort((a, b) => {
      const aOverlay = a.source_kind === "overlay" ? 1 : 0;
      const bOverlay = b.source_kind === "overlay" ? 1 : 0;
      return aOverlay - bOverlay || a.index - b.index;
    });

  if (!matched.length) return null;
  const Wrapper = inline ? "span" : "div";
  return <Wrapper className={`cv-cites${inline ? " cv-cites--inline" : ""}`}>
    {matched.map((source) => <button
      key={source.index}
      type="button"
      className={`cv-cite cv-cite--${source.source_kind === "overlay" ? "overlay" : "source"}`}
      aria-pressed={selectedSource === source.index}
      title={fullSourceLabel(source)}
      onClick={() => onSelect(source)}
    ><span className="cv-cite__label">{compactSourceLabel(source)}</span></button>)}
  </Wrapper>;
}

function Bullets({ items }: { items: string[] }) {
  const bullets = items.filter(Boolean);
  if (!bullets.length) return null;
  return <ul className="cv-bullets">{bullets.map((item, index) => <li key={index}><span>{item}</span></li>)}</ul>;
}

export function AnswerPresentationView({
  presentation,
  sources,
  uiState = EMPTY_UI_STATE,
  onUiStateChange,
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

  const sortedStatuses = useMemo(() => presentation.statuses
    .slice()
    .sort((a, b) => statusOrder[a.type] - statusOrder[b.type]), [presentation.statuses]);
  const counts = sortedStatuses.reduce((result, item) => {
    result[item.type] += 1;
    return result;
  }, { clear: 0, fixable: 0, blocker: 0 });
  const sectionCount = [
    presentation.borrower_script || presentation.key_callout,
    presentation.statuses.length,
    presentation.steps.length,
    presentation.plan_b.length || presentation.easiest_fix,
    presentation.donts.length,
    presentation.documents.length,
  ].filter(Boolean).length;
  const complex = sectionCount >= 4 || presentation.statuses.length >= 4 || presentation.steps.length >= 3;
  const byIndex = useMemo(() => new Map(sources.map((source) => [source.index, source])), [sources]);
  const allSourceIds = useMemo(() => collectSourceIds(presentation), [presentation]);
  const state = onUiStateChange ? uiState : localState;
  const completed = new Set(state.completed_step_ids);
  const checkedDocuments = new Set(state.checked_document_ids);
  const doneCount = presentation.steps.reduce((total, _step, index) => total + (completed.has(`step-${index}`) ? 1 : 0), 0);

  const sections = [
    (presentation.borrower_script || presentation.key_callout) && ["say", "Say this"],
    sortedStatuses.length && ["stand", "Where you stand"],
    presentation.steps.length && ["steps", "Steps"],
    (presentation.plan_b.length || presentation.easiest_fix) && ["plan", "If it’s a no"],
    presentation.donts.length && ["dont", "Don’t"],
    presentation.documents.length && ["docs", "Get these"],
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
    if (source.citation_url) window.open(source.citation_url, "_blank", "noopener,noreferrer");
  }

  const citationProps = { byIndex, selectedSource, onSelect: openSource };
  const documentText = presentation.documents.map((item) => item.label).filter(Boolean).join("\n");
  const mailto = `mailto:?subject=${encodeURIComponent("Documents needed")}&body=${encodeURIComponent(documentText)}`;
  const footerHasCitations = allSourceIds.some((id) => byIndex.has(id));

  return <article className={`cv-answer${complex ? "" : " cv-answer--short"}`} aria-label="Answer">
    {(presentation.scope.label || presentation.scope.detail) && <p className={`cv-scope${presentation.scope.not_found ? " cv-scope--notfound" : ""}`}>
      {presentation.scope.label && <strong>{presentation.scope.label}</strong>}
      {presentation.scope.label && presentation.scope.detail && <span aria-hidden="true"> · </span>}
      {presentation.scope.detail}
    </p>}

    {(presentation.verdict.kicker || presentation.verdict.text || presentation.verdict.reason) && <div className={`cv-verdict cv-verdict--${presentation.verdict.type}${complex ? "" : " cv-verdict--compact"}`}>
      <span className="cv-verdict__icon"><StatusIcon type={presentation.verdict.type} /></span>
      <div className="cv-verdict__body">
        {presentation.verdict.kicker && <span className="cv-verdict__kicker">{presentation.verdict.kicker}</span>}
        {presentation.verdict.text && <p className="cv-verdict__text">{presentation.verdict.text}</p>}
        {presentation.verdict.reason && <p className="cv-verdict__why">{presentation.verdict.reason}</p>}
      </div>
      {complex && sortedStatuses.length > 0 && <ul className="cv-verdict__counts">
        {counts.clear > 0 && <li className="is-clear">{counts.clear} clear</li>}
        {counts.fixable > 0 && <li className="is-fixable">{counts.fixable} fixable</li>}
        {counts.blocker > 0 && <li className="is-blocker">{counts.blocker} blocker{counts.blocker === 1 ? "" : "s"} to check</li>}
      </ul>}
    </div>}

    {complex && sections.length >= 4 && <nav className="cv-jump" aria-label="Jump to section">
      {sections.map(([id, label]) => <a key={id} href={`#${anchorPrefix}-${id}`}>{label}</a>)}
    </nav>}

    {(presentation.borrower_script || presentation.key_callout) && <section className="cv-section" id={`${anchorPrefix}-say`}>
      <h3 className="cv-section__title">Say this to the borrower</h3>
      {presentation.borrower_script && <div className="cv-script">
        <blockquote>{presentation.borrower_script}</blockquote>
        <div><button className="cv-btn cv-btn--primary" type="button" onClick={() => void copyText(presentation.borrower_script!, "script")}>{copied === "script" ? "Copied" : "Copy script"}</button></div>
      </div>}
      {presentation.key_callout && <div className="cv-callout cv-callout--key">{presentation.key_callout}</div>}
    </section>}

    {sortedStatuses.length > 0 && (complex ? <section className="cv-section" id={`${anchorPrefix}-stand`}>
      <h3 className="cv-section__title">Where you stand</h3>
      <ul className="cv-status cv-card">{sortedStatuses.map((item, index) => <li key={`${item.type}-${item.item}-${index}`}>
        <span className={`cv-badge cv-badge--${item.type}`}><StatusIcon type={item.type} />{item.type[0].toUpperCase() + item.type.slice(1)}</span>
        <span className="cv-status__item">{item.item}</span>
        <span className="cv-status__why">{item.reason}<Citations {...citationProps} source_ids={item.source_ids} inline /></span>
      </li>)}</ul>
    </section> : <ol className="cv-conditions">{sortedStatuses.map((item, index) => <li key={`${item.item}-${index}`}><span><strong>{item.item}.</strong> {item.reason}<Citations {...citationProps} source_ids={item.source_ids} inline /></span></li>)}</ol>)}

    {presentation.steps.length > 0 && (complex ? <section className="cv-section" id={`${anchorPrefix}-steps`}>
      <h3 className="cv-section__title">What to do, in order
        <span className="cv-progress" aria-hidden="true"><span style={{ width: `${(doneCount / presentation.steps.length) * 100}%` }} /></span>
        <span className="cv-progress-count" aria-live="polite">{doneCount} of {presentation.steps.length} done</span>
      </h3>
      <ol className="cv-steps">{presentation.steps.map((step, index) => {
        const id = `step-${index}`;
        const isDone = completed.has(id);
        return <li key={id} className={`cv-step${index === presentation.steps.length - 1 ? " cv-step--final" : ""}${isDone ? " is-done" : ""}`} data-cv-step={id}>
          <div className="cv-step__body">
            <div className="cv-step__head"><h4 className="cv-step__title">{step.title}</h4><label className="cv-done"><input type="checkbox" checked={isDone} onChange={() => toggleStep(id)} />Done</label></div>
            <Bullets items={step.bullets} />
            {step.stop_if && <div className="cv-callout cv-callout--stop"><span className="cv-callout__tag">Stop if</span><span>{step.stop_if}</span></div>}
            {step.watch_out && <div className="cv-callout cv-callout--watch"><span className="cv-callout__tag">Watch out</span><span>{step.watch_out}</span></div>}
            <Citations {...citationProps} source_ids={step.source_ids} />
          </div>
        </li>;
      })}</ol>
    </section> : <ol className="cv-conditions">{presentation.steps.map((step, index) => <li key={`short-step-${index}`}><span><strong>{step.title}.</strong> {step.bullets.find(Boolean) || step.watch_out || step.stop_if}<Citations {...citationProps} source_ids={step.source_ids} inline /></span></li>)}</ol>)}

    {(presentation.plan_b.length > 0 || presentation.easiest_fix) && <section className="cv-section" id={`${anchorPrefix}-plan`}>
      <h3 className="cv-section__title">If it’s a no: how we get to yes</h3>
      <div className="cv-card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
        {presentation.plan_b.length > 0 && <ol className="cv-timeline">{presentation.plan_b.map((item, index) => <li key={`${item.when}-${item.title}-${index}`}>
          <span className="cv-timeline__rail" /><span className="cv-timeline__when">{item.when}</span><h4 className="cv-timeline__what">{item.title}</h4>
          <Bullets items={item.bullets} /><Citations {...citationProps} source_ids={item.source_ids} />
        </li>)}</ol>}
        {presentation.easiest_fix && <div className="cv-callout cv-callout--path"><span className="cv-callout__tag">Easiest fix</span><span>{presentation.easiest_fix}</span></div>}
      </div>
    </section>}

    {presentation.donts.length > 0 && <section className="cv-section" id={`${anchorPrefix}-dont`}>
      <h3 className="cv-section__title">Don’t</h3>
      <ul className="cv-donts cv-card">{presentation.donts.map((item, index) => <li key={`${item.text}-${index}`}><span>{item.text}<Citations {...citationProps} source_ids={item.source_ids} inline /></span></li>)}</ul>
    </section>}

    {presentation.documents.length > 0 && <section className="cv-section" id={`${anchorPrefix}-docs`}>
      <h3 className="cv-section__title">Get these</h3>
      <div className="cv-card">
        <ul className="cv-checklist">{presentation.documents.map((item, index) => {
          const id = `document-${index}`;
          return <li key={id} data-cv-document={id}><label><input type="checkbox" checked={checkedDocuments.has(id)} onChange={() => toggleDocument(id)} /><span>{item.label}<Citations {...citationProps} source_ids={item.source_ids} inline /></span></label></li>;
        })}</ul>
        <div className="cv-actions">
          <button className="cv-btn cv-btn--primary" type="button" onClick={() => void copyText(documentText, "documents")}>{copied === "documents" ? "Copied" : "Copy list"}</button>
          <a className="cv-btn" href={mailto}>Email list to borrower</a>
        </div>
      </div>
    </section>}

    {presentation.next_fact_needed && <div className="cv-callout cv-callout--next"><span className="cv-callout__tag">Next fact needed</span><span>{presentation.next_fact_needed}</span></div>}

    {(presentation.verify_line || footerHasCitations) && <footer className="cv-footer">
      {presentation.verify_line && <p className="cv-footer__verify">{presentation.verify_line}</p>}
      <Citations {...citationProps} source_ids={allSourceIds} />
    </footer>}
  </article>;
}
