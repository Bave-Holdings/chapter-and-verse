import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OverlaySet } from "../../../lib/api";
import { adminUser, ingestionAgents } from "../../../tests/fixtures/ingestion";
import { OverlaysPanel } from "./overlays-panel";

const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const empty = (agentKey: string): OverlaySet => ({ agent_key: agentKey, source_name: null, rules: [], loaded_at: null });
const acme: OverlaySet = {
  agent_key: "fha_handbook",
  source_name: "Acme FHA overlays",
  loaded_at: "2026-10-23T12:00:00Z",
  rules: [
    { id: "r1", title: "Minimum credit score", body: "Acme requires a 620 minimum decision credit score.", position: 0 },
    { id: "r2", title: "Manual underwriting", body: "Acme does not offer manual underwriting.", position: 1 },
  ],
};

let role = "admin";
let stored: Record<string, OverlaySet>;
let requests: Array<{ path: string; method: string; body?: BodyInit | null }>;
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

beforeEach(() => {
  role = "admin";
  stored = {};
  requests = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string, init: RequestInit = {}) => {
    const path = new URL(input, "http://localhost").pathname;
    const method = init.method ?? "GET";
    requests.push({ path, method, body: init.body });
    if (path.endsWith("/auth/me")) return json({ ...adminUser, role });
    if (path.endsWith("/agents")) return json(ingestionAgents);
    const overlay = path.match(/\/overlays\/(\w+)$/);
    if (overlay) {
      const key = overlay[1];
      if (method === "PUT") {
        stored[key] = { ...acme, agent_key: key };
        return json(stored[key]);
      }
      if (method === "DELETE") {
        const count = stored[key]?.rules.length ?? 0;
        delete stored[key];
        return json({ agent_key: key, deactivated: count });
      }
      return json(stored[key] ?? empty(key));
    }
    throw new Error(`Unhandled request ${path}`);
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("OverlaysPanel", () => {
  it("blocks non-admin accounts", async () => {
    role = "user";
    render(<OverlaysPanel />);
    expect(await screen.findByRole("heading", { name: "Admin access required" })).toBeInTheDocument();
    expect(requests.some((request) => request.path.includes("/overlays/"))).toBe(false);
  });

  it("loads a document for the chosen agent, lists its rules and can stop applying them", async () => {
    render(<OverlaysPanel />);
    // FHA is listed first; switching agents loads that agent's set.
    const current = await screen.findByRole("region", { name: "Applied to FHA" });
    expect(await within(current).findByText(/No overlays are loaded/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Agent" }), { target: { value: "mortgage_guidelines" } });
    expect(await screen.findByRole("region", { name: "Applied to Fannie Mae" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Agent" }), { target: { value: "fha_handbook" } });
    await within(await screen.findByRole("region", { name: "Applied to FHA" })).findByText(/No overlays are loaded/);
    const file = new File(["# Minimum credit score\nAcme requires 620."], "acme.md", { type: "text/markdown" });
    fireEvent.change(screen.getByLabelText("Overlay document"), { target: { files: [file] } });
    fireEvent.change(screen.getByRole("textbox", { name: "Source name (optional)" }), { target: { value: "Acme FHA overlays" } });
    fireEvent.click(screen.getByRole("button", { name: "Load overlays" }));

    expect(await screen.findByText(/Loaded 2 rules from Acme FHA overlays\. FHA answers now apply them, labeled Overlay\./)).toBeInTheDocument();
    const put = requests.find((request) => request.method === "PUT")!;
    expect(put.path).toBe("/api/v1/overlays/fha_handbook");
    expect((put.body as FormData).get("source_name")).toBe("Acme FHA overlays");
    expect(((put.body as FormData).get("file") as File).name).toBe("acme.md");
    const applied = screen.getByRole("region", { name: "Applied to FHA" });
    expect(within(applied).getByText("2 rules")).toBeInTheDocument();
    expect(within(applied).getByText("Minimum credit score")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Replace overlays" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Stop applying overlays" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, stop applying" }));
    expect(await screen.findByText(/Stopped applying 2 rules\./)).toBeInTheDocument();
    await waitFor(() => expect(within(screen.getByRole("region", { name: "Applied to FHA" })).getByText(/No overlays are loaded/)).toBeInTheDocument());
  });

  it("rejects an unsupported file before uploading", async () => {
    render(<OverlaysPanel />);
    await screen.findByRole("region", { name: "Applied to FHA" });
    fireEvent.change(screen.getByLabelText("Overlay document"), { target: { files: [new File(["x"], "rules.xlsx")] } });
    fireEvent.click(screen.getByRole("button", { name: "Load overlays" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Upload the overlay document as .md, .txt, .docx or .pdf.");
    expect(requests.some((request) => request.method === "PUT")).toBe(false);
  });
});
