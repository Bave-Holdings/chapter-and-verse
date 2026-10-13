"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { agentsApi, ApiError, authApi, ingestionApi, type Agent, type CorpusKey, type DocumentIngest, type GuidelineDocument } from "../../../lib/api";
import { activeStates, coverage, ingestionError, jobLabels, rangeLabel, validateRange } from "./range-rules";
import styles from "./ingestion-panel.module.css";

type Failure = ReturnType<typeof ingestionError>;
type Selection = { documentId: string; jobId: string };
type ProtectedError = (cause: unknown) => boolean;
const corpusKeys = new Set(["mortgage_guidelines", "fha_handbook"]);

function ErrorNotice({ error }: { error: Failure }) {
  return <div role="alert" className={styles.error}>
    <p>{error.message}</p>
    {error.errors.length > 0 && <ul>{error.errors.map((message, index) => <li key={index}>{message}</li>)}</ul>}
    {error.warnings.length > 0 && <><strong>Warnings</strong><ul>{error.warnings.map((message, index) => <li key={index}>{message}</li>)}</ul></>}
    {error.metrics != null && <details><summary>Quality diagnostics</summary><pre>{JSON.stringify(error.metrics, null, 2)}</pre></details>}
  </div>;
}

function remember(selection: Selection) {
  const url = new URL(window.location.href);
  for (const [key, value] of [["document", selection.documentId], ["job", selection.jobId]]) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  window.history.replaceState(null, "", url);
}

export function IngestionPanel() {
  const router = useRouter();
  const controller = useRef<AbortController | null>(null);
  const [access, setAccess] = useState<"loading" | "admin" | "denied" | "expired" | "error">("loading");
  const [failure, setFailure] = useState<Failure | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [signal, setSignal] = useState<AbortSignal | null>(null);
  const protectedError = useCallback((cause: unknown) => {
    if (!(cause instanceof ApiError) || ![401, 403].includes(cause.status)) return false;
    controller.current?.abort();
    setAccess(cause.status === 401 ? "expired" : "denied");
    if (cause.status === 401) router.replace("/login");
    return true;
  }, [router]);

  useEffect(() => {
    const request = new AbortController();
    controller.current = request;
    authApi.me(request.signal).then((user) => {
      if (request.signal.aborted) return;
      setSignal(request.signal);
      setAccess(user.role === "admin" ? "admin" : "denied");
    }).catch((cause) => {
      if (request.signal.aborted || protectedError(cause)) return;
      setFailure(ingestionError(cause));
      setAccess("error");
    });
    return () => request.abort();
  }, [attempt, protectedError]);

  if (access === "loading") return <div className={styles.panel} role="status">Checking admin access…</div>;
  if (access === "denied") return <div className={styles.panel}><h2>Admin access required</h2><p>Your account cannot manage guideline ingestion.</p></div>;
  if (access === "expired") return <div className={styles.panel}><p>Your session expired. Please sign in again.</p><a href="/login">Sign in</a></div>;
  if (access === "error") return <div className={styles.panel}>{failure && <ErrorNotice error={failure} />}<button onClick={() => { setAccess("loading"); setAttempt((value) => value + 1); }}>Retry access check</button></div>;
  return signal && <AdminIngestion signal={signal} protectedError={protectedError} />;
}

function JobMonitor({ selection, signal, protectedError, onResolved, onTerminal }: {
  selection: Selection; signal: AbortSignal; protectedError: ProtectedError;
  onResolved: (job: DocumentIngest) => void; onTerminal: () => void;
}) {
  const [job, setJob] = useState<DocumentIngest | null>(null);
  const [error, setError] = useState<Failure | null>(null);
  const [paused, setPaused] = useState(false);
  const [checkedAt, setCheckedAt] = useState(0);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const requestSignal = AbortSignal.any([signal, controller.signal]);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let trailingRefresh: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    async function poll() {
      try {
        const next = await ingestionApi.job(selection.jobId, requestSignal);
        if (requestSignal.aborted) return;
        if (selection.documentId && selection.documentId !== next.document_id) throw new Error("This job belongs to a different document. Select it from recent jobs to resume.");
        setJob(next);
        setCheckedAt(Date.now());
        setError(null);
        setPaused(false);
        failures = 0;
        if (!selection.documentId) onResolved(next);
        if (next.status === "done" || next.status === "failed") {
          onTerminal();
          // The worker updates document metadata immediately after marking the job done.
          trailingRefresh = setTimeout(onTerminal, 2500);
        } else if (activeStates.has(next.status)) {
          timer = setTimeout(poll, 2000);
        } else {
          setPaused(true);
        }
      } catch (cause) {
        if (requestSignal.aborted || protectedError(cause)) return;
        setError(ingestionError(cause));
        failures += 1;
        if ((cause instanceof ApiError && [404, 422].includes(cause.status)) || failures >= 3 || !(cause instanceof ApiError || cause instanceof TypeError)) {
          setPaused(true);
          onTerminal();
        } else {
          timer = setTimeout(poll, Math.min(2000 * 2 ** failures, 30000));
        }
      }
    }
    void poll();
    return () => { controller.abort(); clearTimeout(timer); clearTimeout(trailingRefresh); };
  }, [selection.documentId, selection.jobId, signal, protectedError, onResolved, onTerminal, attempt]);

  const stalled = job && activeStates.has(job.status) && checkedAt - Date.parse(job.updated_at) > 10 * 60_000;
  return <section className={styles.card} aria-label="Job monitor">
    <div className={styles.cardHeading}><h2>Job progress</h2><span className={styles.badge}>{job ? jobLabels[job.status] ?? `Unknown state: ${job.status}` : "Connecting"}</span></div>
    <p className={styles.identifier}>Job {selection.jobId}</p>
    {job && <>
      <p><strong>{job.document_name ?? "Document"}</strong> · Physical pages {job.start_page}–{job.end_page}</p>
      <p>{job.pages} parsed pages · {job.chunks} chunks · {job.sections} sections</p>
      {job.status === "sectioning" && job.section_pages_total > 0 && <label>Section detection: {job.section_pages} / {job.section_pages_total}<progress max={job.section_pages_total} value={job.section_pages} /></label>}
      <p className={styles.muted}>Last updated: <time dateTime={job.updated_at}>{new Date(job.updated_at).toLocaleString()}</time></p>
      {job.status === "failed" && <p role="alert" className={styles.error}>{job.error || "The job failed without an error description."} Refresh coverage, then deliberately submit the failed pages as a new range.</p>}
      {job.status === "done" && <p>Range completed. Review the document and its coverage before activating it for Q&amp;A.</p>}
      {stalled && <p className={styles.warning}>No update for at least 10 minutes. Processing may be slow, or a backend restart may have stranded this job. Ask the backend operator to inspect worker logs and recover the job before submitting more ranges. The browser cannot reset it.</p>}
    </>}
    {error && <><ErrorNotice error={error} /><p>A progress request failed; this does not mean ingestion failed. {paused ? "Monitoring is paused." : "Reconnecting with backoff…"}</p></>}
    {paused && <button onClick={() => { setPaused(false); setAttempt((value) => value + 1); }}>Resume monitoring</button>}
    <p className={styles.muted}>Leaving this page stops monitoring. It does not cancel the backend job.</p>
  </section>;
}

function AdminIngestion({ signal, protectedError }: { signal: AbortSignal; protectedError: ProtectedError }) {
  const [selection, setSelection] = useState<Selection>(() => {
    const query = new URLSearchParams(window.location.search);
    return { documentId: query.get("document") ?? "", jobId: query.get("job") ?? "" };
  });
  const [mode, setMode] = useState<"new" | "existing">(selection.documentId || selection.jobId ? "existing" : "new");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [documents, setDocuments] = useState<GuidelineDocument[]>([]);
  const [jobs, setJobs] = useState<DocumentIngest[]>([]);
  const [document, setDocument] = useState<GuidelineDocument | null>(null);
  const [ranges, setRanges] = useState<DocumentIngest[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<Failure | null>(null);
  const [actionError, setActionError] = useState<Failure | null>(null);
  const [revision, setRevision] = useState(0);
  const [corpus, setCorpus] = useState<CorpusKey>("mortgage_guidelines");
  const [filter, setFilter] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState("v1");
  const [from, setFrom] = useState("1");
  const [to, setTo] = useState("");
  const [replace, setReplace] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState<"upload" | "range" | "status" | null>(null);
  const inFlight = useRef(false);
  const [notice, setNotice] = useState("");
  const [reconcile, setReconcile] = useState(false);
  const refresh = useCallback(() => { setLoading(true); setLoadError(null); setRevision((value) => value + 1); setReviewed(false); }, []);
  const onResolved = useCallback((job: DocumentIngest) => {
    setLoading(true);
    setLoadError(null);
    setSelection({ documentId: job.document_id, jobId: job.id });
  }, []);

  useEffect(() => { remember(selection); }, [selection]);
  useEffect(() => {
    const controller = new AbortController();
    const requestSignal = AbortSignal.any([signal, controller.signal]);
    Promise.all([
      agentsApi.list(requestSignal), ingestionApi.documents(requestSignal), ingestionApi.jobs(undefined, requestSignal),
      selection.documentId ? ingestionApi.document(selection.documentId, requestSignal) : Promise.resolve(null),
      selection.documentId ? ingestionApi.ranges(selection.documentId, requestSignal) : Promise.resolve([]),
    ]).then(([nextAgents, nextDocuments, nextJobs, nextDocument, nextRanges]) => {
      if (requestSignal.aborted) return;
      setAgents(nextAgents);
      setCorpus((current) => nextAgents.some((agent) => agent.key === current && agent.live) ? current : (nextAgents.find((agent) => corpusKeys.has(agent.key) && agent.live)?.key as CorpusKey ?? current));
      setDocuments(nextDocuments);
      setJobs(nextJobs);
      setDocument(nextDocument);
      setRanges(nextRanges);
      setLoaded(true);
    }).catch((cause) => {
      if (!requestSignal.aborted && !protectedError(cause)) setLoadError(ingestionError(cause));
    }).finally(() => { if (!requestSignal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [selection.documentId, revision, signal, protectedError]);

  const destinations = agents.filter((agent) => corpusKeys.has(agent.key) && agent.live);
  const currentDocument = document?.id === selection.documentId ? document : null;
  const currentRanges = currentDocument ? ranges : [];
  const currentCoverage = currentDocument && currentRanges.length > 0 ? coverage(currentDocument, currentRanges) : null;
  const activeJob = currentRanges.find((job) => activeStates.has(job.status));
  const overlaps = currentRanges.filter((job) => job.status === "done" && job.start_page <= Number(to) && job.end_page >= Number(from));
  const available = loaded && !loading && !loadError && !busy;
  const labelFor = (key: string) => agents.find((agent) => agent.key === key)?.name ?? key;

  function selectDocument(id: string, jobId = "") {
    if (inFlight.current) return;
    refresh();
    setSelection({ documentId: id, jobId });
    setMode("existing");
    setReplace(false);
    setReviewed(false);
    setActionError(null);
    setNotice("");
    const target = documents.find((item) => item.id === id);
    setFrom(String(target?.content_start_page ?? 1));
    setTo("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!available || inFlight.current || reconcile || signal.aborted) return;
    setActionError(null);
    setNotice("");
    const fromPage = Number(from);
    const toPage = Number(to);
    let problem = validateRange(fromPage, toPage, mode === "existing" ? currentDocument : null, mode === "existing" ? currentRanges : [], replace);
    if (mode === "new") {
      if (!file || file.size === 0 || !/\.pdf$/i.test(file.name) || (file.type && file.type !== "application/pdf")) problem = "Choose a nonempty PDF file.";
      else if (!version.trim()) problem = "Enter a version label.";
      else if (!destinations.some((agent) => agent.key === corpus)) problem = "Select an available individual corpus.";
    } else if (!currentDocument) problem = "Select an existing document first.";
    if (problem) { setActionError(ingestionError(new Error(problem))); return; }
    inFlight.current = true;
    setBusy(mode === "new" ? "upload" : "range");
    let posted = false;
    try {
      if (mode === "existing" && currentDocument) {
        const [freshDocument, freshRanges] = await Promise.all([ingestionApi.document(currentDocument.id, signal), ingestionApi.ranges(currentDocument.id, signal)]);
        if (signal.aborted) return;
        setDocument(freshDocument);
        setRanges(freshRanges);
        const conflict = validateRange(fromPage, toPage, freshDocument, freshRanges, replace);
        if (conflict) throw new Error(conflict);
      }
      posted = true;
      const result = await ingestionApi.start(mode === "new"
        ? { file: file!, agentKey: corpus, version: version.trim(), fromPage, toPage }
        : { documentId: currentDocument!.id, fromPage, toPage, replace }, signal);
      if (signal.aborted) return;
      setSelection({ documentId: result.document_id, jobId: result.job_id });
      setMode("existing");
      setReplace(false);
      setNotice(`Accepted physical pages ${result.from_page}–${result.to_page} for ${result.document_name}. ${result.to_page !== toPage ? "The backend clamped the last page to the source PDF." : ""}`);
      refresh();
    } catch (cause) {
      if (signal.aborted || protectedError(cause)) return;
      setActionError(ingestionError(cause));
      if (posted && (!(cause instanceof ApiError) || cause.status >= 500 || [408, 413, 504].includes(cause.status))) setReconcile(true);
      refresh();
    } finally {
      inFlight.current = false;
      if (!signal.aborted) setBusy(null);
    }
  }

  async function changeStatus(status: "active" | "inactive") {
    if (!currentDocument || !available || inFlight.current || signal.aborted || (status === "active" && !reviewed)) return;
    inFlight.current = true;
    setBusy("status");
    setActionError(null);
    try {
      const result = await ingestionApi.setStatus(currentDocument.id, status, signal);
      if (signal.aborted) return;
      setDocument(result);
      setNotice(status === "active" ? "This version is now active for Q&A. Other versions in this corpus are inactive." : "This version is inactive for Q&A.");
      refresh();
    } catch (cause) {
      if (!signal.aborted && !protectedError(cause)) { setActionError(ingestionError(cause)); refresh(); }
    } finally {
      inFlight.current = false;
      if (!signal.aborted) setBusy(null);
    }
  }

  return <div className={styles.panel}>
    <div className={styles.intro}><div><span className={styles.eyebrow}>KNOWLEDGE ADMIN</span><h2>Guideline ingestion</h2><p>Upload, review, and activate the source documents used for answers.</p></div><button disabled={!!busy || loading} onClick={refresh}>Refresh data</button></div>
    {loading && <p role="status">{loaded ? "Refreshing documents and coverage…" : "Loading agents, documents, and recent jobs…"}</p>}
    {loadError && <><ErrorNotice error={loadError} /><button disabled={!!busy} onClick={refresh}>Retry loading</button>{selection.documentId && <button onClick={() => { selectDocument(""); setMode("new"); }}>Clear document selection</button>}</>}
    {actionError && <ErrorNotice error={actionError} />}
    {notice && <p className={styles.success} role="status">{notice}</p>}
    {reconcile && <div className={styles.warning}><strong>Check history before submitting again</strong><p>The upload response was unsuccessful or uncertain. A job may already exist. Review the refreshed documents and jobs below and select any matching job. For a 413 or proxy timeout, ask the deployment operator to check upload size and timeout limits.</p><button disabled={!available} onClick={() => { setReconcile(false); setNotice("History reviewed. If a document already exists, continue it using its stored PDF."); }}>I checked history; allow a deliberate submission</button></div>}
    {loaded && <>
      <div className={styles.columns}>
        <section className={styles.card} aria-labelledby="range-title">
          <h2 id="range-title">Ingest a page range</h2>
          <div className={styles.tabs} role="group" aria-label="Ingestion mode">
            <button aria-pressed={mode === "new"} disabled={!!busy} onClick={() => { if (mode !== "new") setFile(null); setMode("new"); setReplace(false); setFrom("1"); setTo(""); }}>New document</button>
            <button aria-pressed={mode === "existing"} disabled={!!busy} onClick={() => { setMode("existing"); setReplace(false); setFrom(String(currentDocument?.content_start_page ?? 1)); setTo(""); }}>Continue existing document</button>
          </div>
          <form onSubmit={submit}>
            <fieldset disabled={!available || reconcile}>
              {mode === "new" ? <>
                <label>Corpus<select value={corpus} onChange={(event) => setCorpus(event.target.value as CorpusKey)}><option value="" disabled>Select corpus</option>{destinations.map((agent) => <option key={agent.key} value={agent.key}>{agent.name}</option>)}</select></label>
                {destinations.length === 0 && <p>No individual corpora are currently available for upload.</p>}
                <label>Complete source PDF<input type="file" accept="application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
                <label>Version label<input value={version} onChange={(event) => setVersion(event.target.value)} placeholder="e.g. 2026-10" /></label>
              </> : <>
                <label>Existing document<select value={selection.documentId} onChange={(event) => selectDocument(event.target.value)}><option value="">Select a document</option>{documents.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.version} · {labelFor(item.agent_key)}</option>)}{currentDocument && !documents.some((item) => item.id === currentDocument.id) && <option value={currentDocument.id}>{currentDocument.name} · {currentDocument.version}</option>}</select></label>
                {currentDocument && <p>Fixed corpus: {labelFor(currentDocument.agent_key)}<br />Version: {currentDocument.version}. The stored PDF is reused.</p>}
              </>}
              <div className={styles.bounds}>
                <label>First physical page<input type="number" min="1" step="1" value={from} onChange={(event) => { setFrom(event.target.value); setReplace(false); }} /></label>
                <label>Last physical page<input type="number" min="1" step="1" value={to} onChange={(event) => { setTo(event.target.value); setReplace(false); }} /></label>
              </div>
              <p className={styles.muted}>Use physical PDF pages starting at 1, not printed page labels. For the whole document, enter 1 through its known physical page count. The backend clamps the last page to the PDF length.</p>
              {mode === "new" && <p className={styles.warning}>The first range permanently sets the content start page. Choosing a page after 1 excludes earlier pages from required coverage. To ingest those pages later, create a new document version.</p>}
              {mode === "existing" && overlaps.length > 0 && <label className={styles.check}><input type="checkbox" checked={replace} onChange={(event) => setReplace(event.target.checked)} /><span>Replace completed pages {rangeLabel(overlaps.map((job) => ({ start: job.start_page, end: job.end_page })))}. My range must fully cover each affected range.</span></label>}
              {mode === "existing" && activeJob && <p className={styles.warning}>A job is in progress for this document ({jobLabels[activeJob.status]}). Another range cannot start until it finishes.</p>}
              <button className={styles.primary} type="submit" disabled={mode === "existing" ? !currentDocument || !!activeJob : destinations.length === 0}>{replace ? "Replace selected ranges" : mode === "new" ? "Upload and start ingestion" : "Start range ingestion"}</button>
            </fieldset>
          </form>
          {busy && <p role="status" aria-live="polite">{busy === "upload" ? "Uploading complete PDF and preparing job…" : busy === "range" ? "Checking coverage and preparing range…" : "Updating document status…"}{busy === "upload" && <progress aria-label="Uploading PDF" />}</p>}
        </section>
        <div className={styles.stack}>
          {selection.jobId ? <JobMonitor key={selection.jobId} selection={selection} signal={signal} protectedError={protectedError} onResolved={onResolved} onTerminal={refresh} /> : <section className={styles.card}><h2>Job progress</h2><p>Start ingestion or select a recent job to monitor its progress.</p></section>}
          <section className={styles.card} aria-label="Document review">
            <div className={styles.cardHeading}><h2>Review &amp; activate</h2>{currentDocument && <span className={styles.badge}>Document: {currentDocument.status}</span>}</div>
            {!currentDocument ? <p>Select a document to inspect coverage and activate a version.</p> : <>
              <h3>{currentDocument.name}</h3><p>{labelFor(currentDocument.agent_key)} · {currentDocument.version}</p>
              <p className={styles.identifier}>Document {currentDocument.id}</p>
              <p>{currentDocument.total_pages} physical pages · Required start: {currentDocument.content_start_page}</p>
              {currentCoverage && <>
                <p><strong>{currentCoverage.covered} / {currentCoverage.required} required pages covered</strong></p>
                <p>Completed pages: {rangeLabel(currentCoverage.completed)}<br />Missing pages: {rangeLabel(currentCoverage.missing)}</p>
                {currentCoverage.missing[0] && <button disabled={!available} onClick={() => { setMode("existing"); setFrom(String(currentCoverage.missing[0].start)); setTo(String(currentCoverage.missing[0].end)); setReplace(false); }}>Use next missing range</button>}
              </>}
              {currentRanges.length === 0 && <p>No range history exists. Coverage is unknown for a document ingested through the full-ingestion endpoint; activation still requires the backend quality check.</p>}
              <a className={styles.pdfLink} href={`/api/v1/documents/${encodeURIComponent(currentDocument.id)}/file#page=${Number.isSafeInteger(Number(from)) && Number(from) >= currentDocument.content_start_page && Number(from) <= currentDocument.total_pages ? Number(from) : currentDocument.content_start_page}`} target="_blank" rel="noopener noreferrer">Open source PDF for review ↗</a>
              <p>Job completion and document status are separate. Q&amp;A uses only active documents. A later successful ingest resets the document to ready or partial and requires activation again.</p>
              {currentDocument.status !== "active" ? <>
                <p className={styles.warning}>Activating this version makes every other active document in {labelFor(currentDocument.agent_key)} inactive, including documents with different filenames.</p>
                <label className={styles.check}><input type="checkbox" checked={reviewed} disabled={!available || !!activeJob} onChange={(event) => setReviewed(event.target.checked)} /><span>I reviewed the source PDF and coverage and intend to switch Q&amp;A to this version.</span></label>
                <button className={styles.primary} disabled={!available || !reviewed || !!activeJob} onClick={() => void changeStatus("active")}>Activate for Q&amp;A</button>
              </> : <button disabled={!available || !!activeJob} onClick={() => void changeStatus("inactive")}>Deactivate for Q&amp;A</button>}
            </>}
          </section>
        </div>
      </div>
      <section className={styles.card} aria-label="Documents">
        <div className={styles.cardHeading}><h2>Documents</h2><label>Filter corpus<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="">All corpora</option>{agents.filter((agent) => corpusKeys.has(agent.key)).map((agent) => <option key={agent.key} value={agent.key}>{agent.name}</option>)}</select></label></div>
        <p className={styles.muted}>Showing up to 500 documents returned by the server; this is a capped catalog. Corpus filtering applies to these results.</p>
        {documents.length === 0 ? <p>No documents have been uploaded.</p> : documents.filter((item) => !filter || item.agent_key === filter).length === 0 ? <p>No returned documents match this corpus.</p> : <div className={styles.tableScroll}><table><thead><tr><th>Document / version</th><th>Corpus</th><th>Document status</th><th>Physical pages</th><th>Review</th></tr></thead><tbody>{documents.filter((item) => !filter || item.agent_key === filter).map((item) => <tr key={item.id}><td><strong>{item.name}</strong><br />{item.version}</td><td>{labelFor(item.agent_key)}</td><td>{item.status}</td><td>{item.total_pages}</td><td><button disabled={!!busy} onClick={() => selectDocument(item.id)}>Review {item.name}</button></td></tr>)}</tbody></table></div>}
        <div className={styles.agentCounts}>{destinations.map((agent) => <span key={agent.key}>{agent.name}: {agent.document_count} documents · {agent.has_documents ? "Q&A available" : "Q&A unavailable"}</span>)}</div>
      </section>
      <section className={styles.card} aria-label="Ingestion history">
        <h2>{currentDocument ? "Document range history" : "Recent jobs"}</h2>
        <p className={styles.muted}>{currentDocument ? "All ranges for the selected document. Failed jobs can be submitted again after refreshing coverage." : "The 40 most recent range jobs. Select a job to resume monitoring."}</p>
        <JobHistory jobs={currentDocument ? currentRanges : jobs} disabled={!!busy} onSelect={selectDocument} />
        {currentDocument && <details><summary>Recent jobs across all documents</summary><JobHistory jobs={jobs} disabled={!!busy} onSelect={selectDocument} /></details>}
      </section>
    </>}
  </div>;
}

function JobHistory({ jobs, disabled, onSelect }: { jobs: DocumentIngest[]; disabled: boolean; onSelect: (id: string, jobId: string) => void }) {
  if (!jobs.length) return <p>No range jobs found.</p>;
  return <div className={styles.tableScroll}><table><thead><tr><th>Document</th><th>Physical pages</th><th>Job state</th><th>Updated</th><th>Monitor</th></tr></thead><tbody>{jobs.map((job) => <tr key={job.id}><td>{job.document_name ?? job.document_id}</td><td>{job.start_page}–{job.end_page}</td><td>{jobLabels[job.status] ?? `Unknown state: ${job.status}`}{job.error && <p>{job.error}</p>}</td><td><time dateTime={job.updated_at}>{new Date(job.updated_at).toLocaleString()}</time></td><td><button disabled={disabled} onClick={() => onSelect(job.document_id, job.id)}>Monitor pages {job.start_page}–{job.end_page}</button></td></tr>)}</tbody></table></div>;
}
