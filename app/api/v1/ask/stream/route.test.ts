import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

describe("POST /api/v1/ask/stream", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("forwards the cookie and streams the upstream SSE body", async () => {
    const encoder = new TextEncoder();
    const upstreamBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode("event: token\ndata: {\"text\":\"Hi\"}\n\n"));
        controller.enqueue(encoder.encode("event: done\ndata: {\"status\":\"answered\"}\n\n"));
        controller.close();
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(upstreamBody, {
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        connection: "keep-alive",
        "transfer-encoding": "chunked",
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("http://localhost:3000/api/v1/ask/stream", {
      method: "POST",
      headers: { cookie: "session=secret", "content-type": "application/json" },
      body: JSON.stringify({ question: "Hello", chat_id: "chat-1" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("connection")).toBeNull();
    expect(response.headers.get("transfer-encoding")).toBeNull();
    expect(await response.text()).toContain("event: done");
    const forwarded = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(forwarded.headers).get("cookie")).toBe("session=secret");
    expect(new Headers(forwarded.headers).get("host")).toBeNull();
  });

  it("returns a stable 502 when the backend connection fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("socket closed")));
    const request = new Request("http://localhost:3000/api/v1/ask/stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const response = await POST(request);
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ detail: "The answer service is unavailable." });
  });
});
