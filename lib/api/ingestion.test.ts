import { afterEach, describe, expect, it, vi } from "vitest";
import { ingestionApi } from "./ingestion";

afterEach(() => vi.unstubAllGlobals());
describe("ingestion API", () => {
  it("sends a complete PDF, explicit corpus, and string range fields with cookies and a browser-generated boundary", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetch);
    const file = new File(["%PDF-1.7"], "guidelines.pdf", { type: "application/pdf" });
    const controller = new AbortController();
    await ingestionApi.start({ file, agentKey: "fha_handbook", version: "v2", fromPage: 2, toPage: 10 }, controller.signal);
    const [path, init] = fetch.mock.calls[0];
    expect(path).toBe("/api/v1/ingest/range");
    expect(init).toMatchObject({ method: "POST", credentials: "same-origin", signal: controller.signal });
    expect(init.headers.has("Content-Type")).toBe(false);
    expect(Object.fromEntries(init.body.entries())).toEqual({ file, agent_key: "fha_handbook", version: "v2", from_page: "2", to_page: "10", replace: "false" });
  });
  it("appends by document ID without sending another file, corpus, version, or split size", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetch);
    await ingestionApi.start({ documentId: "doc-1", fromPage: 1, toPage: 50, replace: true });
    expect(Object.fromEntries(fetch.mock.calls[0][1].body.entries())).toEqual({ document_id: "doc-1", from_page: "1", to_page: "50", replace: "true" });
  });
});
