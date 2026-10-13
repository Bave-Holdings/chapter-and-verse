import { apiRequest } from "./client";
import type { DocumentIngest, GuidelineDocument, IngestRangeResponse } from "./types";

export type CorpusKey = "mortgage_guidelines" | "fha_handbook";
export type RangeInput = {
  fromPage: number;
  toPage: number;
  replace?: boolean;
} & (
  | { file: File; agentKey: CorpusKey; version: string; documentId?: never }
  | { documentId: string; file?: never; agentKey?: never; version?: never }
);

export const ingestionApi = {
  start(input: RangeInput, signal?: AbortSignal) {
    const body = new FormData();
    body.set("from_page", String(input.fromPage));
    body.set("to_page", String(input.toPage));
    body.set("replace", String(input.replace ?? false));
    if (input.file !== undefined) {
      body.set("file", input.file);
      body.set("agent_key", input.agentKey);
      body.set("version", input.version);
    } else {
      body.set("document_id", input.documentId);
    }
    return apiRequest<IngestRangeResponse>("/ingest/range", { method: "POST", body, signal });
  },
  job: (id: string, signal?: AbortSignal) =>
    apiRequest<DocumentIngest>(`/ingest/jobs/${encodeURIComponent(id)}`, { cache: "no-store", signal }),
  jobs: (documentId?: string, signal?: AbortSignal) =>
    apiRequest<DocumentIngest[]>(`/ingest/jobs?limit=${documentId ? 200 : 40}${documentId ? `&document_id=${encodeURIComponent(documentId)}` : ""}`, { cache: "no-store", signal }),
  documents: (signal?: AbortSignal) =>
    apiRequest<GuidelineDocument[]>("/documents?limit=500", { cache: "no-store", signal }),
  document: (id: string, signal?: AbortSignal) =>
    apiRequest<GuidelineDocument>(`/documents/${encodeURIComponent(id)}`, { cache: "no-store", signal }),
  ranges: (id: string, signal?: AbortSignal) =>
    apiRequest<DocumentIngest[]>(`/documents/${encodeURIComponent(id)}/ingests`, { cache: "no-store", signal }),
  setStatus: (id: string, status: "active" | "inactive", signal?: AbortSignal) =>
    apiRequest<GuidelineDocument>(`/documents/${encodeURIComponent(id)}/status`, {
      method: "PATCH", body: JSON.stringify({ status }), signal,
    }),
};
