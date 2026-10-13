import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminUser, guidelineDocument, ingestionAgents, rangeJob } from "../../../tests/fixtures/ingestion";
import { IngestionPanel } from "./ingestion-panel";

const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
let role = "admin";
let authStatus = 200;
let document = { ...guidelineDocument };
let job = { ...rangeJob };
let hasDocument = false;
let qualityError = false;
let postError = false;
let jobStatus = 200;
let requests: Array<{ path: string; init: RequestInit }>;
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

beforeEach(() => {
  role = "admin"; authStatus = 200; jobStatus = 200; qualityError = false; postError = false; hasDocument = false;
  document = { ...guidelineDocument }; job = { ...rangeJob }; requests = [];
  window.history.replaceState(null, "", "/admin/ingest");
  vi.stubGlobal("fetch", vi.fn(async (input: string, init: RequestInit = {}) => {
    const path = new URL(input, "http://localhost").pathname;
    requests.push({ path, init });
    if (path.endsWith("/auth/me")) return json({ ...adminUser, role }, authStatus);
    if (path.endsWith("/agents")) return json(ingestionAgents);
    if (path.endsWith("/documents")) return json(hasDocument ? [document] : []);
    if (path.endsWith("/ingest/jobs")) return json(hasDocument ? [job] : []);
    if (path.endsWith("/ingests")) return json([job]);
    if (path.endsWith("/status")) {
      if (qualityError) return json({ detail: { message: "Quality gate failed", errors: ["Missing embeddings", "Sparse content"], warnings: ["Review source"], metrics: { chunks: 0 } } }, 409);
      document = { ...document, status: "active" };
      return json(document);
    }
    if (path.endsWith(`/documents/${document.id}`)) return json(document);
    if (path.endsWith(`/jobs/${job.id}`)) return json(jobStatus === 200 ? job : { detail: "Progress unavailable" }, jobStatus);
    if (path.endsWith("/ingest/range")) {
      if (postError) throw new TypeError("Network connection lost");
      hasDocument = true;
      return json({ job_id: job.id, document_id: document.id, document_name: document.name, from_page: 1, to_page: 10, status: "pending" });
    }
    throw new Error(`Unhandled request ${path}`);
  }));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

async function loaded() {
  await screen.findByRole("button", { name: "Upload and start ingestion" });
  await waitFor(() => expect(screen.getByRole("button", { name: "Refresh data" })).toBeEnabled());
}
function restore() {
  hasDocument = true;
  window.history.replaceState(null, "", `/admin/ingest?document=${document.id}&job=${job.id}`);
}

describe("admin ingestion", () => {
  it.each([["user", 200], ["admin", 401], ["admin", 403]])("guards %s with session status %s before any admin data", async (nextRole, status) => {
    role = nextRole; authStatus = status;
    render(<IngestionPanel />);
    if (status === 401) await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login"));
    else await screen.findByRole("heading", { name: "Admin access required" });
    expect(requests.map((request) => request.path)).toEqual(["/api/v1/auth/me"]);
    expect(screen.queryByRole("button", { name: "Upload and start ingestion" })).not.toBeInTheDocument();
  });
  it("uploads an individual corpus, saves IDs and displays clamped bounds", async () => {
    render(<IngestionPanel />); await loaded();
    expect(within(screen.getByLabelText("Corpus")).queryByRole("option", { name: "Combined guidelines" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Corpus"), { target: { value: "fha_handbook" } });
    fireEvent.change(screen.getByLabelText("Complete source PDF"), { target: { files: [new File(["%PDF-1.7"], "guide.pdf", { type: "application/pdf" })] } });
    fireEvent.change(screen.getByLabelText("Last physical page"), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "Upload and start ingestion" }));
    await screen.findByText(/Accepted physical pages 1–10/);
    await waitFor(() => expect(window.location.search).toContain(`job=${job.id}`));
    expect(window.location.search).toContain(`document=${document.id}`);
    const posted = requests.filter((request) => request.init.method === "POST");
    expect(posted).toHaveLength(1);
    expect((posted[0].init.body as FormData).get("agent_key")).toBe("fha_handbook");
    expect(await screen.findByRole("link", { name: /Open source PDF/ })).toHaveAttribute("href", `/api/v1/documents/${document.id}/file#page=1`);
  });
  it("shows every structured activation quality error without optimistically activating", async () => {
    restore(); job.status = "done"; document.status = "ready"; qualityError = true;
    window.history.replaceState(null, "", `/admin/ingest?document=${document.id}`);
    render(<IngestionPanel />);
    const checkbox = await screen.findByRole("checkbox", { name: /I reviewed/ });
    await waitFor(() => expect(checkbox).toBeEnabled());
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole("button", { name: "Activate for Q&A" }));
    await screen.findByText("Quality gate failed");
    expect(screen.getByText("Missing embeddings")).toBeVisible();
    expect(screen.getByText("Sparse content")).toBeVisible();
    expect(screen.getByText("Review source")).toBeVisible();
    expect(screen.getByText("Document: ready")).toBeVisible();
  });
  it("requires reconciliation after an uncertain POST and never retries automatically", async () => {
    postError = true;
    render(<IngestionPanel />); await loaded();
    fireEvent.change(screen.getByLabelText("Complete source PDF"), { target: { files: [new File(["%PDF"], "guide.pdf", { type: "application/pdf" })] } });
    fireEvent.change(screen.getByLabelText("Last physical page"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Upload and start ingestion" }));
    await screen.findByText("Check history before submitting again");
    expect(screen.getByRole("button", { name: "Upload and start ingestion" })).toBeDisabled();
    expect(requests.filter((request) => request.init.method === "POST")).toHaveLength(1);
  });
  it("restores and polls sequentially, stops on done, and aborts on unmount", async () => {
    vi.useFakeTimers(); restore();
    const view = render(<IngestionPanel />);
    await act(async () => {});
    const count = () => requests.filter((request) => request.path.endsWith(`/jobs/${job.id}`)).length;
    expect(count()).toBe(1);
    job.status = "sectioning"; job.section_pages = 4;
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(screen.getByText("Section detection: 4 / 10")).toBeVisible();
    job.status = "done";
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(count()).toBe(3);
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(count()).toBe(3);
    const requestSignal = requests.find((request) => request.path.endsWith(`/jobs/${job.id}`))!.init.signal;
    view.unmount();
    expect(requestSignal?.aborted).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(count()).toBe(3);
  });
  it("aborts active polling on unmount and does not cancel backend ingestion", async () => {
    vi.useFakeTimers(); restore();
    const view = render(<IngestionPanel />); await act(async () => {});
    const progress = requests.find((request) => request.path.endsWith(`/jobs/${job.id}`))!;
    view.unmount();
    expect(progress.init.signal?.aborted).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(requests.filter((request) => request.path.endsWith(`/jobs/${job.id}`))).toHaveLength(1);
    expect(requests.some((request) => request.path.includes("cancel"))).toBe(false);
  });
  it("backs off progress failures and stops protected work on 403", async () => {
    vi.useFakeTimers(); restore(); jobStatus = 503;
    render(<IngestionPanel />); await act(async () => {});
    expect(screen.getByText(/does not mean ingestion failed/)).toBeVisible();
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(requests.filter((request) => request.path.endsWith(`/jobs/${job.id}`))).toHaveLength(1);
    jobStatus = 403;
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(screen.getByRole("heading", { name: "Admin access required" })).toBeVisible();
    const count = requests.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(requests).toHaveLength(count);
  });
  it("waits for the previous progress request before scheduling another", async () => {
    vi.useFakeTimers(); restore();
    const original = vi.mocked(fetch).getMockImplementation()!;
    let resolveJob!: (response: Response) => void;
    const progress = vi.fn(() => new Promise<Response>((resolve) => { resolveJob = resolve; }));
    vi.mocked(fetch).mockImplementation((input, init) => String(input).endsWith(`/jobs/${job.id}`) ? progress() : original(input, init));
    render(<IngestionPanel />); await act(async () => {});
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(progress).toHaveBeenCalledTimes(1);
    await act(async () => { resolveJob(json(job)); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1999); });
    expect(progress).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(progress).toHaveBeenCalledTimes(2);
  });
  it("surfaces unknown job states and pauses without claiming completion", async () => {
    vi.useFakeTimers(); restore(); job.status = "recovering";
    render(<IngestionPanel />); await act(async () => {});
    expect(within(screen.getByRole("region", { name: "Job monitor" })).getByText("Unknown state: recovering")).toBeVisible();
    expect(screen.getByRole("button", { name: "Resume monitoring" })).toBeVisible();
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(requests.filter((request) => request.path.endsWith(`/jobs/${job.id}`))).toHaveLength(1);
  });
});
