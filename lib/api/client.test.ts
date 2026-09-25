import { afterEach, describe, expect, it, vi } from "vitest";

import { apiRequest, authApi, chatsApi } from "./client";

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

  it("sends only full_name, email, and password when signing up", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "user-1", email: "taylor@example.com", role: "user", created_at: "now",
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await authApi.signup("Taylor Smith", "taylor@example.com", "password8");

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({
      full_name: "Taylor Smith",
      email: "taylor@example.com",
      password: "password8",
    });
    expect(String(request.body)).not.toContain("confirm_password");
  });

  it("patches message UI state with the exact checklist payload", async () => {
    const uiState = {
      completed_step_ids: ["step-0"],
      checked_document_ids: ["document-0"],
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      message_id: "message/1",
      ui_state: uiState,
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await chatsApi.updateMessageUiState("chat/1", "message/1", uiState);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/chats/chat%2F1/messages/message%2F1/ui-state",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify(uiState),
      }),
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual(uiState);
  });
});
