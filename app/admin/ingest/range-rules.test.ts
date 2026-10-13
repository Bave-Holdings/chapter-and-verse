import { describe, expect, it } from "vitest";
import { ApiError } from "../../../lib/api";
import { guidelineDocument, rangeJob } from "../../../tests/fixtures/ingestion";
import { coverage, ingestionError, validateRange } from "./range-rules";

describe("range coverage and conflicts", () => {
  it("unions completed ranges, clips to required bounds, and preserves gaps", () => {
    const jobs = [
      { ...rangeJob, status: "done", start_page: 1, end_page: 4 },
      { ...rangeJob, status: "done", start_page: 3, end_page: 5 },
      { ...rangeJob, status: "done", start_page: 8, end_page: 20 },
      { ...rangeJob, status: "failed", start_page: 6, end_page: 7 },
      { ...rangeJob, status: "embedding", start_page: 6, end_page: 7 },
    ];
    expect(coverage({ ...guidelineDocument, content_start_page: 3, page_count: 10 }, jobs)).toEqual({
      completed: [{ start: 3, end: 5 }, { start: 8, end: 10 }], missing: [{ start: 6, end: 7 }], covered: 6, required: 8,
    });
  });
  it.each(["pending", "parsing", "sectioning", "embedding"])("blocks even nonoverlapping ranges while %s", (status) => {
    expect(validateRange(8, 10, guidelineDocument, [{ ...rangeJob, status, end_page: 3 }])).toContain("in progress");
  });
  it("requires explicit replacement of entire overlapping completed ranges", () => {
    const completed = [{ ...rangeJob, status: "done", end_page: 5 }];
    expect(validateRange(1, 5, guidelineDocument, completed)).toContain("Explicitly");
    expect(validateRange(2, 5, guidelineDocument, completed, true)).toContain("every completed range");
    expect(validateRange(1, 50, guidelineDocument, completed, true)).toBeNull();
    expect(validateRange(1, 5, guidelineDocument, [{ ...rangeJob, status: "failed" }])).toBeNull();
  });
  it("rejects invalid physical pages and excluded starts", () => {
    expect(validateRange(1.5, 10)).toContain("integer");
    expect(validateRange(0, 10)).toContain("integer");
    expect(validateRange(5, 4)).toContain("integer");
    expect(validateRange(11, 20, guidelineDocument)).toContain("exceeds");
    expect(validateRange(1, 10, { ...guidelineDocument, content_start_page: 3 })).toContain("excluded");
  });
  it("preserves structured quality errors and warnings without trusting arbitrary values", () => {
    expect(ingestionError(new ApiError("Conflict", 409, { detail: {
      message: "Quality gate failed", errors: ["No embeddings", { invalid: true }], warnings: ["Review OCR"], metrics: { chunks: 0 },
    } }))).toEqual({ message: "Quality gate failed", errors: ["No embeddings"], warnings: ["Review OCR"], metrics: { chunks: 0 } });
  });
});
