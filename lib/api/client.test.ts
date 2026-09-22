import { afterEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "./client";

describe("apiRequest", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("normalizes FastAPI validation errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      detail: [{ loc: ["body", "email"], msg: "value is not a valid email" }],
    }), { status: 422, headers: { "content-type": "application/json" } })));

    await expect(apiRequest("/auth/signup", { method: "POST", body: "{}" }))
      .rejects.toEqual(expect.objectContaining({
        status: 422,
        message: "email: value is not a valid email",
      }));
  });

  it("uses same-origin credentials and JSON headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await apiRequest("/test", { method: "POST", body: JSON.stringify({ value: 1 }) });
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/test", expect.objectContaining({
      credentials: "same-origin",
      headers: expect.any(Headers),
    }));
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get("Content-Type")).toBe("application/json");
  });
});
