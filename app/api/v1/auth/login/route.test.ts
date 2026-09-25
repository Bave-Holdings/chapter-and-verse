import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const persistentCookie = "session=secret; HttpOnly; Max-Age=1209600; Path=/; SameSite=lax";

describe("POST /api/v1/auth/login", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses a browser-session cookie when remember me is not selected", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(
      { id: "user-1", email: "user@example.com" },
      { headers: { "set-cookie": persistentCookie } },
    ));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(new Request("http://localhost/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com", password: "secret", remember_me: false }),
    }));

    expect(response.headers.get("set-cookie")).toBe("session=secret; HttpOnly; Path=/; SameSite=lax");
    const forwarded = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(forwarded).toEqual({ email: "user@example.com", password: "secret" });
  });

  it("keeps the persistent backend cookie when remember me is selected", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(
      { id: "user-1", email: "user@example.com" },
      { headers: { "set-cookie": persistentCookie } },
    )));

    const response = await POST(new Request("http://localhost/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com", password: "secret", remember_me: true }),
    }));

    expect(response.headers.get("set-cookie")).toBe(persistentCookie);
  });

  it("returns a stable error when authentication is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    const response = await POST(new Request("http://localhost/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com", password: "secret" }),
    }));
    expect(response.status).toBe(502);
  });
});
