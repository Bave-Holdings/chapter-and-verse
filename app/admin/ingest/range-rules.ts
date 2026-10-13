import { ApiError, type DocumentIngest, type GuidelineDocument } from "../../../lib/api";

export type Interval = { start: number; end: number };
export const activeStates = new Set(["pending", "parsing", "sectioning", "embedding"]);
export const jobLabels: Record<string, string> = {
  pending: "Waiting", parsing: "Parsing", sectioning: "Section detection",
  embedding: "Embedding", done: "Done", failed: "Failed",
};
export const rangeLabel = (ranges: Interval[]) => ranges.length
  ? ranges.map(({ start, end }) => start === end ? String(start) : `${start}–${end}`).join(", ")
  : "None";

export function coverage(document: GuidelineDocument, jobs: DocumentIngest[]) {
  const start = Math.max(1, document.content_start_page);
  const total = document.total_pages;
  const completed: Interval[] = [];
  const intervals = jobs.filter((job) => job.status === "done")
    .map((job) => ({ start: Math.max(start, job.start_page), end: Math.min(total, job.end_page) }))
    .filter((range) => range.end >= range.start)
    .sort((a, b) => a.start - b.start);
  for (const interval of intervals) {
    const previous = completed.at(-1);
    if (previous && interval.start <= previous.end + 1) previous.end = Math.max(previous.end, interval.end);
    else completed.push({ ...interval });
  }
  const missing: Interval[] = [];
  let cursor = start;
  for (const interval of completed) {
    if (cursor < interval.start) missing.push({ start: cursor, end: interval.start - 1 });
    cursor = interval.end + 1;
  }
  if (cursor <= total) missing.push({ start: cursor, end: total });
  return { completed, missing, covered: completed.reduce((count, range) => count + range.end - range.start + 1, 0), required: Math.max(0, total - start + 1) };
}

export function validateRange(from: number, to: number, document?: GuidelineDocument | null, jobs: DocumentIngest[] = [], replace = false): string | null {
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 1 || to < from) return "Enter integer physical page numbers: first page must be at least 1 and last page must be at least the first.";
  if (!document) return null;
  if (from < document.content_start_page) return `Pages before ${document.content_start_page} were excluded. Create a new document version to ingest them.`;
  if (document.total_pages > 0 && from > document.total_pages) return `First page exceeds the PDF's ${document.total_pages} physical pages.`;
  if (jobs.some((job) => activeStates.has(job.status))) return "This document already has a job in progress. Wait for it to finish before submitting another range.";
  const end = document.total_pages > 0 ? Math.min(to, document.total_pages) : to;
  const overlaps = jobs.filter((job) => job.status === "done" && job.start_page <= end && job.end_page >= from);
  if (overlaps.length && !replace) return "These pages overlap completed ranges. Explicitly select replacement to continue.";
  if (overlaps.some((job) => from > job.start_page || end < job.end_page)) return `A replacement must cover every completed range it overlaps: ${rangeLabel(overlaps.map((job) => ({ start: job.start_page, end: job.end_page })))}.`;
  return null;
}

export function ingestionError(cause: unknown) {
  const fallback = cause instanceof Error ? cause.message : "The request could not be completed.";
  const details = cause instanceof ApiError ? cause.details : undefined;
  const detail = details && typeof details === "object" && "detail" in details ? details.detail : undefined;
  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    const value = detail as Record<string, unknown>;
    return {
      message: typeof value.message === "string" ? value.message : fallback,
      errors: Array.isArray(value.errors) ? value.errors.filter((item): item is string => typeof item === "string") : [],
      warnings: Array.isArray(value.warnings) ? value.warnings.filter((item): item is string => typeof item === "string") : [],
      metrics: value.metrics,
    };
  }
  return { message: fallback, errors: [], warnings: [], metrics: undefined };
}
