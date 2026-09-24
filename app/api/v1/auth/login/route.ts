const apiBaseUrl =
  process.env.API_BASE_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:8000";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LoginBody = {
  email?: unknown;
  password?: unknown;
  remember_me?: unknown;
};

function asSessionCookie(cookie: string) {
  return cookie
    .replace(/;\s*Max-Age=[^;]*/gi, "")
    .replace(/;\s*Expires=[^;]*/gi, "");
}

export async function POST(request: Request) {
  let body: LoginBody;
  try {
    body = await request.json() as LoginBody;
  } catch {
    return Response.json({ detail: "Invalid request body." }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${apiBaseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "accept": "application/json", "content-type": "application/json" },
      body: JSON.stringify({ email: body.email, password: body.password }),
      cache: "no-store",
      redirect: "manual",
      signal: request.signal,
    });
  } catch {
    return Response.json({ detail: "The authentication service is unavailable." }, { status: 502 });
  }

  const headers = new Headers();
  headers.set("content-type", upstream.headers.get("content-type") ?? "application/json");
  headers.set("cache-control", "no-store");
  const sessionCookie = upstream.headers.get("set-cookie");
  if (sessionCookie) {
    headers.append("set-cookie", body.remember_me === true ? sessionCookie : asSessionCookie(sessionCookie));
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}
