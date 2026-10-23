import { apiRequest } from "./client";
import type { OverlayClear, OverlaySet } from "./types";

/** Lender overlays per agent (admin only). Loading a document replaces the active set. */
export const overlaysApi = {
  get: (agentKey: string, signal?: AbortSignal) =>
    apiRequest<OverlaySet>(`/overlays/${encodeURIComponent(agentKey)}`, { cache: "no-store", signal }),
  load(agentKey: string, file: File, sourceName?: string, signal?: AbortSignal) {
    const body = new FormData();
    body.set("file", file);
    if (sourceName?.trim()) body.set("source_name", sourceName.trim());
    return apiRequest<OverlaySet>(`/overlays/${encodeURIComponent(agentKey)}`, { method: "PUT", body, signal });
  },
  clear: (agentKey: string, signal?: AbortSignal) =>
    apiRequest<OverlayClear>(`/overlays/${encodeURIComponent(agentKey)}`, { method: "DELETE", signal }),
};
