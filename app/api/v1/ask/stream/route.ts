const apiBaseUrl =
  process.env.API_BASE_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:8000";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const hopByHopHeaders = [
  "connection",
  "content-length",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
];

export async function POST(request: Request) {
  const requestHeaders = new Headers(request.headers);
  for (const header of hopByHopHeaders) requestHeaders.delete(header);
  requestHeaders.delete("host");
  requestHeaders.delete("expect");
  requestHeaders.set("accept", "text/event-stream");

  let requestBody: ArrayBuffer;
  try {
    requestBody = await request.arrayBuffer();
  } catch {
    return Response.json({ detail: "Invalid request body." }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${apiBaseUrl}/api/v1/ask/stream`, {
      method: "POST",
      headers: requestHeaders,
      body: requestBody,
      signal: request.signal,
      cache: "no-store",
      redirect: "manual",
    });
  } catch (cause) {
    const nested = cause instanceof Error && "cause" in cause
      ? (cause as Error & { cause?: unknown }).cause
      : undefined;
    console.error("[ask-stream-proxy] Upstream request failed", cause, nested);
    return Response.json(
      { detail: "The answer service is unavailable." },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers(upstream.headers);
  for (const header of hopByHopHeaders) responseHeaders.delete(header);
  // Node fetch decodes an encoded upstream body before it is re-streamed.
  responseHeaders.delete("content-encoding");
  responseHeaders.set("content-type", upstream.headers.get("content-type") ?? "text/event-stream; charset=utf-8");
  responseHeaders.set("cache-control", "no-cache, no-transform");
  responseHeaders.set("x-accel-buffering", "no");

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}
