import { ApiError } from "./client";
import type { AskResult, StreamEvent } from "./types";

type StreamHandlers = {
  onEvent: (event: StreamEvent) => void;
};

function parseFrame(frame: string): StreamEvent | null {
  let event = "message";
  const data: string[] = [];
  for (const line of frame.split(/\r?\n/)) {
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  if (!data.length) return null;
  if (!["status", "sources", "token", "done", "error"].includes(event)) return null;
  return { event, data: JSON.parse(data.join("\n")) } as StreamEvent;
}

export async function parseSseStream(
  stream: ReadableStream<Uint8Array>,
  onEvent: StreamHandlers["onEvent"],
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const parsed = parseFrame(frame);
        if (parsed) onEvent(parsed);
      }
      if (done) break;
    }
    if (buffer.trim()) {
      const parsed = parseFrame(buffer);
      if (parsed) onEvent(parsed);
    }
  } finally {
    reader.releaseLock();
  }
}

export async function streamQuestion(
  question: string,
  chatId: string,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch("/api/v1/ask/stream", {
    method: "POST",
    credentials: "same-origin",
    headers: { Accept: "text/event-stream", "Content-Type": "application/json" },
    body: JSON.stringify({ question, chat_id: chatId }),
    signal,
  });

  if (!response.ok) {
    let body: { detail?: unknown } | undefined;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
    const detail = typeof body?.detail === "string" ? body.detail : `Unable to stream an answer (${response.status}).`;
    throw new ApiError(detail, response.status, body);
  }
  if (!response.body) throw new ApiError("The answer stream was empty.", 502);

  let terminal = false;
  await parseSseStream(response.body, (event) => {
    if (event.event === "done" || event.event === "error") terminal = true;
    handlers.onEvent(event);
  });
  if (!terminal) {
    handlers.onEvent({
      event: "error",
      data: { status: "error", error: "The answer stream ended unexpectedly." } satisfies AskResult,
    });
  }
}
