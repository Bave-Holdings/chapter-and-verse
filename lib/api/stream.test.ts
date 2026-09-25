import { describe, expect, it, vi } from "vitest";

import { parseSseStream, streamQuestion } from "./stream";
import type { StreamEvent } from "./types";

function chunkedStream(chunks: string[]) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  });
}

describe("parseSseStream", () => {
  it("parses CRLF frames split across arbitrary network chunks", async () => {
    const events: StreamEvent[] = [];
    await parseSseStream(chunkedStream([
      "event: sta",
      "tus\r\ndata: {\"message\":\"Searching\"}\r\n\r",
      "\nevent: token\ndata: {\"text\":\"Hel",
      "lo\"}\n\nevent: done\ndata: {\"status\":\"answered\",\"answer\":\"Hello\"}\n\n",
    ]), (event) => events.push(event));

    expect(events).toEqual([
      { event: "status", data: { message: "Searching" } },
      { event: "token", data: { text: "Hello" } },
      { event: "done", data: { status: "answered", answer: "Hello" } },
    ]);
  });

  it("supports multiline data and ignores comments and unknown events", async () => {
    const events: StreamEvent[] = [];
    await parseSseStream(chunkedStream([
      ": heartbeat\n\nevent: other\ndata: {}\n\n",
      "event: token\ndata: {\"text\":\ndata: \"ok\"}\n\n",
    ]), (event) => events.push(event));
    expect(events).toEqual([{ event: "token", data: { text: "ok" } }]);
  });

  it("parses a presentation frame without requiring token events", async () => {
    const events: StreamEvent[] = [];
    const presentation = {
      scope: { label: "Mortgage", detail: "Guide", not_found: false },
      verdict: { type: "clear", kicker: "Verdict", text: "Yes", reason: "Allowed", source_ids: [1] },
      borrower_script: null,
      key_callout: null,
      statuses: [],
      steps: [],
      plan_b: [],
      easiest_fix: null,
      donts: [],
      documents: [],
      next_fact_needed: null,
      verify_line: null,
    } as const;

    await parseSseStream(chunkedStream([
      `event: presentation\ndata: ${JSON.stringify({ presentation })}\n\n`,
      "event: done\ndata: {\"status\":\"answered\"}\n\n",
    ]), (event) => events.push(event));

    expect(events).toEqual([
      { event: "presentation", data: { presentation } },
      { event: "done", data: { status: "answered" } },
    ]);
  });
});

describe("streamQuestion", () => {
  it("posts the chat-scoped payload and surfaces an SSE error on HTTP 200", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      chunkedStream(["event: error\ndata: {\"status\":\"error\",\"error\":\"model failed\"}\n\n"]),
      { status: 200, headers: { "content-type": "text/event-stream" } },
    )));
    const events: StreamEvent[] = [];
    await streamQuestion("Question", "chat-1", { onEvent: (event) => events.push(event) });

    expect(fetch).toHaveBeenCalledWith("/api/v1/ask/stream", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ question: "Question", chat_id: "chat-1" }),
    }));
    expect(events[0]).toEqual({ event: "error", data: { status: "error", error: "model failed" } });
  });

  it("emits a client error if the stream closes without a terminal event", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      chunkedStream(["event: token\ndata: {\"text\":\"partial\"}\n\n"]),
      { status: 200 },
    )));
    const events: StreamEvent[] = [];
    await streamQuestion("Question", "chat-1", { onEvent: (event) => events.push(event) });
    expect(events.at(-1)?.event).toBe("error");
  });
});
