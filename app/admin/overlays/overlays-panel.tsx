"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { agentsApi, ApiError, authApi, overlaysApi, type Agent, type OverlaySet } from "../../../lib/api";
import styles from "../ingest/ingestion-panel.module.css";

// Overlays apply to the mortgage agents only.
const OVERLAY_AGENT_KEYS = ["fha_handbook", "mortgage_guidelines"];
const ACCEPTED = ".md,.txt,.docx,.pdf";

function errorText(cause: unknown, fallback: string) {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

function ruleCount(count: number) {
  return `${count} rule${count === 1 ? "" : "s"}`;
}

export function OverlaysPanel() {
  const router = useRouter();
  const [access, setAccess] = useState<"loading" | "admin" | "denied" | "error">("loading");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const request = new AbortController();
    authApi.me(request.signal).then((user) => {
      if (!request.signal.aborted) setAccess(user.role === "admin" ? "admin" : "denied");
    }).catch((cause) => {
      if (request.signal.aborted) return;
      if (cause instanceof ApiError && cause.status === 401) {
        router.replace("/login");
        return;
      }
      setError(errorText(cause, "Unable to check admin access."));
      setAccess("error");
    });
    return () => request.abort();
  }, [attempt, router]);

  if (access === "loading") return <div className={styles.panel} role="status">Checking admin access…</div>;
  if (access === "denied") return <div className={styles.panel}><h2>Admin access required</h2><p>Your account cannot manage lender overlays.</p></div>;
  if (access === "error") return <div className={styles.panel}><p role="alert" className={styles.error}>{error}</p><button onClick={() => { setAccess("loading"); setAttempt((value) => value + 1); }}>Retry access check</button></div>;
  return <AdminOverlays />;
}

function AdminOverlays() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentKey, setAgentKey] = useState("");
  const [current, setCurrent] = useState<OverlaySet | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [busy, setBusy] = useState<"upload" | "clear" | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [revision, setRevision] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const handle = useCallback((cause: unknown, fallback: string, report: (message: string) => void) => {
    if (cause instanceof ApiError && cause.status === 401) {
      router.replace("/login");
      return;
    }
    report(errorText(cause, fallback));
  }, [router]);

  useEffect(() => {
    const controller = new AbortController();
    agentsApi.list(controller.signal).then((list) => {
      if (controller.signal.aborted) return;
      const available = OVERLAY_AGENT_KEYS
        .map((key) => list.find((agent) => agent.key === key))
        .filter((agent): agent is Agent => Boolean(agent));
      setAgents(available);
      setAgentKey((key) => key || available.find((agent) => agent.live)?.key || available[0]?.key || "");
      if (!available.length) setLoading(false);
    }).catch((cause) => {
      if (controller.signal.aborted) return;
      handle(cause, "Unable to load agents.", setLoadError);
      setLoading(false);
    });
    return () => controller.abort();
  }, [handle]);

  useEffect(() => {
    if (!agentKey) return;
    // Callers set loading before changing the agent or the revision.
    const controller = new AbortController();
    overlaysApi.get(agentKey, controller.signal).then((set) => {
      if (!controller.signal.aborted) setCurrent(set);
    }).catch((cause) => {
      if (!controller.signal.aborted) handle(cause, "Unable to load the current overlays.", setLoadError);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [agentKey, revision, handle]);

  const agentName = agents.find((agent) => agent.key === agentKey)?.name ?? agentKey;
  const rules = current?.rules ?? [];

  function reload() {
    setLoading(true);
    setLoadError("");
    setRevision((value) => value + 1);
  }

  function chooseAgent(key: string) {
    setLoading(true);
    setLoadError("");
    setAgentKey(key);
    setCurrent(null);
    setNotice("");
    setActionError("");
    setConfirmClear(false);
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !agentKey) return;
    setActionError("");
    setNotice("");
    if (!file || file.size === 0) {
      setActionError("Choose a nonempty overlay document (.md, .txt, .docx or .pdf).");
      return;
    }
    if (!/\.(md|txt|docx|pdf)$/i.test(file.name)) {
      setActionError("Upload the overlay document as .md, .txt, .docx or .pdf.");
      return;
    }
    setBusy("upload");
    try {
      const result = await overlaysApi.load(agentKey, file, sourceName);
      setCurrent(result);
      setFile(null);
      setSourceName("");
      if (fileInput.current) fileInput.current.value = "";
      setConfirmClear(false);
      setNotice(`Loaded ${ruleCount(result.rules.length)} from ${result.source_name ?? file.name}. ${agentName} answers now apply them, labeled Overlay.`);
    } catch (cause) {
      handle(cause, "Unable to load the overlay document.", setActionError);
    } finally {
      setBusy(null);
    }
  }

  async function clear() {
    if (busy || !agentKey) return;
    setBusy("clear");
    setActionError("");
    setNotice("");
    try {
      const result = await overlaysApi.clear(agentKey);
      setConfirmClear(false);
      setNotice(`Stopped applying ${ruleCount(result.deactivated)}. ${agentName} answers show the generic overlay reminders again.`);
      reload();
    } catch (cause) {
      handle(cause, "Unable to clear the overlays.", setActionError);
    } finally {
      setBusy(null);
    }
  }

  return <div className={styles.panel}>
    <div className={styles.intro}>
      <div><span className={styles.eyebrow}>KNOWLEDGE ADMIN</span><h2>Lender overlays</h2><p>Load your company&apos;s overlay rules. Answers apply the matching rules and label them Overlay, never agency policy.</p></div>
      <button disabled={!!busy || loading || !agentKey} onClick={reload}>Refresh</button>
    </div>
    {actionError && <p role="alert" className={styles.error}>{actionError}</p>}
    {notice && <p className={styles.success} role="status">{notice}</p>}
    {agents.length === 0 && !loading && !loadError && <p>No mortgage agents are available for overlays.</p>}
    {agents.length === 0 && loadError && <p role="alert" className={styles.error}>{loadError}</p>}
    {agents.length > 0 && <div className={styles.columns}>
      <section className={styles.card} aria-labelledby="overlay-upload-title">
        <h2 id="overlay-upload-title">Load an overlay document</h2>
        <form onSubmit={(event) => void upload(event)}>
          <fieldset disabled={!!busy}>
            <label>Agent<select value={agentKey} onChange={(event) => chooseAgent(event.target.value)}>{agents.map((agent) => <option key={agent.key} value={agent.key}>{agent.name}</option>)}</select></label>
            <label>Overlay document<input ref={fileInput} type="file" accept={ACCEPTED} onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
            <label>Source name (optional)<input value={sourceName} maxLength={200} onChange={(event) => setSourceName(event.target.value)} placeholder="e.g. Acme Mortgage FHA overlays, September 2026" /></label>
            <p className={styles.muted}>Each heading becomes one rule; a document without headings is split by paragraph. Accepted: .md, .txt, .docx, .pdf.</p>
            {rules.length > 0 && <p className={styles.warning}>Loading a document replaces the {ruleCount(rules.length)} now applied to {agentName}.</p>}
            <button className={styles.primary} type="submit" disabled={!file}>{rules.length > 0 ? "Replace overlays" : "Load overlays"}</button>
          </fieldset>
        </form>
        {busy === "upload" && <p role="status" aria-live="polite">Reading the document and saving its rules…</p>}
      </section>
      <section className={styles.card} aria-labelledby="overlay-current-title">
        <div className={styles.cardHeading}>
          <h2 id="overlay-current-title">Applied to {agentName}</h2>
          <span className={styles.badge}>{loading ? "Loading" : rules.length > 0 ? ruleCount(rules.length) : "None loaded"}</span>
        </div>
        {loading && <p role="status">Loading the current overlays…</p>}
        {loadError && <><p role="alert" className={styles.error}>{loadError}</p><button onClick={reload}>Retry loading</button></>}
        {!loading && !loadError && rules.length === 0 && <p>No overlays are loaded. Answers show generic reminders to check the lender&apos;s overlays instead.</p>}
        {!loading && !loadError && rules.length > 0 && <>
          <p><strong>{current?.source_name ?? "Overlay document"}</strong>{current?.loaded_at && <> · loaded <time dateTime={current.loaded_at}>{new Date(current.loaded_at).toLocaleString()}</time></>}</p>
          <ol className={styles.overlayRules}>{rules.map((rule) => <li key={rule.id}><strong>{rule.title}</strong><p>{rule.body}</p></li>)}</ol>
          {confirmClear ? <div className={styles.warning}>
            <p>Stop applying these rules? Answers go back to the generic overlay reminders.</p>
            <button className={styles.primary} disabled={!!busy} onClick={() => void clear()}>{busy === "clear" ? "Stopping…" : "Yes, stop applying"}</button>{" "}
            <button disabled={!!busy} onClick={() => setConfirmClear(false)}>Cancel</button>
          </div> : <button disabled={!!busy} onClick={() => setConfirmClear(true)}>Stop applying overlays</button>}
        </>}
      </section>
    </div>}
  </div>;
}
